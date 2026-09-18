// Package workshop connects net/http to the published Toggly SDK. Keep this
// wiring separate from the pages so beginners can find the integration first.
package workshop

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"html/template"
	"net/http"
	"sync"
	"time"

	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/toggly"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/toggly/session"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/togglyctx"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/togglyhttp"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/togglytemplate"
	"github.com/ops-ai/Toggly.Samples/go-sdk/internal/fixture"
)

//go:embed templates/page.html templates/style.css
var assets embed.FS

type Config struct {
	AppKey, Environment, DefinitionsURL string
	Offline                             bool
	RefreshInterval                     time.Duration
}
type App struct {
	client    *toggly.Client
	variants  map[string]*toggly.Client
	fixture   *fixture.Server
	template  *template.Template
	handler   http.Handler
	closeOnce sync.Once
}
type Row struct {
	Key, Note string
	Enabled   bool
}
type Page struct {
	Path, Title, Mode, Status, Snapshot, VariantStatus string
	Context                                            toggly.Context
	Rows                                               []Row
	Orders                                             []Row
	// Variant is only the latest GetVariant assignment. VariantEnabled is a
	// separate IsEnabled read. Published v0.8.1 has no atomic pair: VariantResult
	// is {Name, ConfigurationValue}, and each call takes its own snapshot.
	Variant                                            *toggly.VariantResult
	VariantEnabled                                     bool
	All, Any, Negated                                  bool
	Configured, Offline                                bool
}

func (p Page) TogglyContext() toggly.Context { return p.Context }

var demoFlags = []string{"new-dashboard", "api-v2", "enhanced-submit", "ExpressCheckout", "beta-access"}
var filterRows = []Row{
	{Key: "filter-always-on", Note: "AlwaysOn: on for both presets."},
	{Key: "filter-percentage", Note: "50% rollout: stable identity hash; either result is valid."},
	{Key: "filter-targeting", Note: "Targeting: alice is included."},
	{Key: "filter-user-claims", Note: "UserClaims: role equals admin."},
	{Key: "filter-time-window", Note: "2020–2099: on for both presets while the window is open."},
	{Key: "filter-country", Note: "Country US; synthetic cf-ipcountry input."},
	{Key: "filter-browser-family", Note: "BrowserFamily Chrome."},
	{Key: "filter-browser-language", Note: "BrowserLanguage includes en."},
	{Key: "filter-device-type", Note: "Known parser gap: Go reports Other for this Macintosh desktop UA; the shared Macintosh rule stays unchanged and is OFF."},
	{Key: "filter-os", Note: "OperatingSystem includes Mac."},
	{Key: "filter-context-property", Note: "Order.Vip equals true."},
}

func New(cfg Config) (*App, error) {
	registerOrder()
	if cfg.Environment == "" {
		cfg.Environment = "Production"
	}
	if cfg.RefreshInterval == 0 {
		cfg.RefreshInterval = 30 * time.Second
	}
	a := &App{variants: map[string]*toggly.Client{}}
	// No key means no client and no network. Offline practice is an explicit
	// opt-in with a labelled local service, not a fabricated dashboard app key.
	key := cfg.AppKey
	if cfg.Offline {
		f, err := fixture.New()
		if err != nil {
			return nil, err
		}
		a.fixture = f
		cfg.DefinitionsURL = f.URL + "/"
		key = "offline-fixture"
	}
	if key != "" {
		sdkCfg := toggly.Config{
			AppKey:                           key,
			Environment:                      cfg.Environment,
			DefinitionsURL:                   cfg.DefinitionsURL,
			UseSignedDefinitions:             true,
			RefreshInterval:                  cfg.RefreshInterval,
			HTTPTimeout:                      3 * time.Second,
			DisableEntityContextRegistration: true,
			SessionStore:                     session.NewMemoryStore(),
		}
		// Dashboard schema creation is documented manually, so merely running this
		// teaching app never writes schema metadata to a remote application.
		if a.fixture != nil {
			sdkCfg.AllowedKeyIDs = map[string]struct{}{a.fixture.KeyID: {}}
		}
		var err error
		a.client, err = toggly.NewClient(sdkCfg)
		if err != nil {
			a.Close()
			return nil, err
		}
		// Server-evaluated variants are a DIFFERENT endpoint and cache. Fix each
		// client's identity, groups, and claims before its first request; never
		// call SetVariantIdentity on a client shared by HTTP requests. There are
		// exactly two demo clients. v0.8.1 copies VariantGroups/VariantClaims
		// into the first evaluated-variants-signed query.
		for _, identity := range []string{"alice", "bob"} {
			role := "user"
			if identity == "alice" {
				role = "admin"
			}
			variantCfg := sdkCfg
			variantCfg.EnableVariants = true
			variantCfg.VariantIdentity = identity
			variantCfg.VariantGroups = []string{"sample-users"}
			variantCfg.VariantClaims = map[string]string{"role": role}
			variantCfg.SessionStore = nil
			v, err := toggly.NewClient(variantCfg)
			if err != nil {
				a.Close()
				return nil, err
			}
			a.variants[identity] = v
		}
	}
	// Avoid a typed-nil evaluator: a nil *Client inside an interface is non-nil.
	var evaluator togglytemplate.Evaluator
	if a.client != nil {
		evaluator = a.client
	}
	tpl, err := template.New("page.html").Funcs(togglytemplate.FuncMap(evaluator, nil)).ParseFS(assets, "templates/page.html")
	if err != nil {
		a.Close()
		return nil, err
	}
	a.template = tpl
	mux := http.NewServeMux()
	mux.HandleFunc("GET /style.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		data, _ := assets.ReadFile("templates/style.css")
		_, _ = w.Write(data)
	})
	mux.HandleFunc("POST /persona", a.persona)
	mux.HandleFunc("POST /fixture/dashboard", a.toggleFixture)
	mux.HandleFunc("GET /api/snapshot", a.snapshot)
	var gateEvaluator togglyhttp.Evaluator
	if a.client != nil {
		gateEvaluator = a.client
	}
	mux.Handle("GET /beta", togglyhttp.FeatureGate(gateEvaluator, "beta-access")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("Beta access allowed by native FeatureGate. This flag is not authorization."))
	})))
	mux.Handle("POST /submit", togglyhttp.FeatureGate(gateEvaluator, "enhanced-submit")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ec, _ := togglyctx.From(r.Context())
		a.client.RecordUsage("enhanced-submit", true, ec)
		_, _ = w.Write([]byte("Sample submission accepted. No data was saved; usage sending is disabled."))
	})))
	mux.HandleFunc("GET /", a.page)
	// MiddlewareWith is the published net/http surface: GetContext supplies a
	// fresh persona, then missing UA / language / country fields are filled from
	// request headers. Handlers still read togglyctx.From and pass that context.
	contextHandler := togglyhttp.MiddlewareWith(togglyhttp.Options{GetContext: contextForRequest})(mux)
	a.handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Native local evaluation does not itself reject a canceled context. Stop
		// dispatch before templates or actions when this HTTP request is canceled.
		if r.Context().Err() != nil {
			return
		}
		contextHandler.ServeHTTP(w, r)
	})
	return a, nil
}
func (a *App) Handler() http.Handler { return a.handler }
func (a *App) Close() {
	a.closeOnce.Do(func() {
		for _, v := range a.variants {
			_ = v.Close()
		}
		if a.client != nil {
			_ = a.client.Close()
		}
		if a.fixture != nil {
			a.fixture.Close()
		}
	})
}

func (a *App) evaluate(ctx context.Context, key string, ec toggly.Context) bool {
	if a.client == nil || ctx.Err() != nil {
		return false
	}
	on, err := a.client.IsEnabled(ctx, key, ec)
	return err == nil && on
}
func (a *App) view(r *http.Request) Page {
	ec, _ := togglyctx.From(r.Context())
	p := Page{Path: r.URL.Path, Context: ec, Configured: a.client != nil, Offline: a.fixture != nil, Mode: "Unconfigured", Status: "Unavailable: no client has been started."}
	if a.client != nil {
		p.Mode = "Live Toggly application"
		if a.fixture != nil {
			p.Mode = "Offline practice · local signed fixture"
		}
		info := a.client.ProviderDebugInfo()
		p.Status = "Loading: definitions have not arrived; gates default to OFF."
		if info.LastRefresh != nil {
			p.Status = "Last successful refresh: " + info.LastRefresh.UTC().Format(time.RFC3339) + ". Current values are evaluated for this request."
		}
		if info.LastErrorTime != nil {
			p.Status += " Last refresh error recorded at " + info.LastErrorTime.UTC().Format(time.RFC3339) + "; the SDK retains its last accepted definitions. This timestamp is historical, even after recovery."
		}
		// Never expose ProviderDebugInfo wholesale: it contains the app key and
		// raw network errors may contain credential-bearing request URLs.
		if v := a.variants[ec.Identity]; v != nil {
			// Independent published-package reads. GetVariant and IsEnabled each
			// take their own provider snapshot; do not present them as one result.
			p.Variant = v.GetVariant("new-dashboard")
			p.VariantEnabled, _ = v.IsEnabled(r.Context(), "new-dashboard", ec)
			vi := v.ProviderDebugInfo()
			p.VariantStatus = "Variant definitions are loading."
			if vi.LastRefresh != nil {
				p.VariantStatus = "Variant client last successful refresh: " + vi.LastRefresh.UTC().Format(time.RFC3339)
			}
			if vi.LastErrorTime != nil {
				p.VariantStatus += ". A historical variant refresh error was recorded; the last accepted assignment is retained."
			}
		}
		p.All, _ = a.client.EvaluateGate(r.Context(), []string{"new-dashboard", "api-v2"}, toggly.RequirementAll, ec, false)
		p.Any, _ = a.client.EvaluateGate(r.Context(), []string{"new-dashboard", "api-v2"}, toggly.RequirementAny, ec, false)
		p.Negated, _ = a.client.EvaluateGate(r.Context(), []string{"new-dashboard", "api-v2"}, toggly.RequirementAny, ec, true)
	}
	demoNotes := map[string]string{
		"new-dashboard":   "Baseline toggle for feature, negate, and variants.",
		"api-v2":          "Second baseline used by Any/All and programmatic checks.",
		"enhanced-submit": "Native FeatureGate on POST /submit.",
		"ExpressCheckout": "Order.Vip ContextProperty; see the Orders section.",
		"beta-access":     "Native FeatureGate on GET /beta.",
	}
	for _, key := range demoFlags {
		p.Rows = append(p.Rows, Row{Key: key, Note: demoNotes[key], Enabled: a.evaluate(r.Context(), key, ec)})
	}
	for _, row := range filterRows {
		row.Enabled = a.evaluate(r.Context(), row.Key, ec)
		p.Rows = append(p.Rows, row)
	}
	// Entity context is a per-call value, so two orders in the SAME request can
	// produce different results. No feature-name-only result cache is used.
	for _, o := range []Order{{"ord-vip", true, 125}, {"ord-standard", false, 125}} {
		orderCtx := ec
		orderCtx.Entity = toggly.MapEntity("Order", o)
		p.Orders = append(p.Orders, Row{Key: o.Id, Enabled: a.evaluate(r.Context(), "ExpressCheckout", orderCtx)})
	}
	encoded, _ := json.MarshalIndent(struct {
		Context toggly.Context
		Flags   []Row
	}{ec, p.Rows}, "", "  ")
	p.Snapshot = string(encoded)
	return p
}
func (a *App) page(w http.ResponseWriter, r *http.Request) {
	titles := map[string]string{"/": "Start with one flag", "/gates": "Declarative gates", "/programmatic": "Programmatic API", "/identity": "Identity before evaluation", "/orders": "User context and Order context", "/filters": "Filters matrix", "/integrations": "Go-specific integrations"}
	title, ok := titles[r.URL.Path]
	if !ok {
		http.NotFound(w, r)
		return
	}
	if r.Context().Err() != nil {
		return
	}
	p := a.view(r)
	p.Title = title
	var out bytes.Buffer
	if err := a.template.Execute(&out, p); err != nil {
		http.Error(w, "Could not render the sample", 500)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(out.Bytes())
}
func (a *App) snapshot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(a.view(r))
}
func (a *App) persona(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form", 400)
		return
	}
	preset := r.Form.Get("preset")
	if preset != "matching" && preset != "nonmatching" {
		http.Error(w, "Choose a sample preset", 400)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "sample-preset", Value: preset, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	http.Redirect(w, r, "/filters", http.StatusSeeOther)
}
func (a *App) toggleFixture(w http.ResponseWriter, r *http.Request) {
	if a.fixture == nil {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form", 400)
		return
	}
	a.fixture.SetDashboard(r.Form.Get("enabled") == "true")
	http.Redirect(w, r, "/gates", http.StatusSeeOther)
}
