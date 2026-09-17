package workshop

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/toggly"
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/togglyhttp"
	"github.com/ops-ai/Toggly.Samples/go-sdk/internal/fixture"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestMissingKeyStartsWithVisibleBanner(t *testing.T) {
	app, err := New(Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	response := httptest.NewRecorder()
	app.Handler().ServeHTTP(response, httptest.NewRequest("GET", "/", nil))
	if response.Code != 200 || !strings.Contains(response.Body.String(), "Missing app key") {
		t.Fatalf("expected setup page, got %d: %s", response.Code, response.Body.String())
	}
}

// A missing context handoff would make Alice and Bob both evaluate anonymously.
func TestRequestContextAndAllFilterPresets(t *testing.T) {
	app := offlineApp(t)
	expectations := map[string]bool{"new-dashboard": true, "api-v2": true, "enhanced-submit": true, "ExpressCheckout": true, "beta-access": true, "filter-always-on": true, "filter-targeting": true, "filter-user-claims": true, "filter-time-window": true, "filter-country": true, "filter-browser-family": true, "filter-browser-language": true, "filter-device-type": false, "filter-os": true, "filter-context-property": true}
	for _, preset := range []string{"matching", "nonmatching"} {
		page := readSnapshot(t, app, "/api/snapshot?preset="+preset)
		if preset == "matching" && page.Context.Identity != "alice" {
			t.Fatal("first request lost initial identity")
		}
		if preset == "nonmatching" && page.Context.Identity != "bob" {
			t.Fatal("second request kept prior identity")
		}
		for _, row := range page.Rows {
			if row.Key == "filter-percentage" {
				continue
			}
			want := expectations[row.Key]
			if preset == "nonmatching" && slices.Contains([]string{"ExpressCheckout", "filter-targeting", "filter-user-claims", "filter-country", "filter-browser-family", "filter-browser-language", "filter-os", "filter-context-property"}, row.Key) {
				want = false
			}
			if row.Enabled != want {
				t.Errorf("%s %s = %v, want %v", preset, row.Key, row.Enabled, want)
			}
		}
		if len(page.Rows) != 16 {
			t.Fatalf("missing shared filter rows: %d", len(page.Rows))
		}
	}
}

func TestPresetRequestFieldsWinOverBrowserHeaders(t *testing.T) {
	app := offlineApp(t)
	req := httptest.NewRequest("GET", "/api/snapshot?preset=matching", nil)
	req.Header.Set("User-Agent", nonmatchingUA)
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9")
	req.Header.Set("CF-IPCountry", "CA")
	out := httptest.NewRecorder()
	app.Handler().ServeHTTP(out, req)
	var page Page
	if err := json.Unmarshal(out.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.Context.Identity != "alice" || page.Context.Request == nil || page.Context.Request.Country != "US" {
		t.Fatalf("preset context lost to headers: %#v", page.Context)
	}
	for _, row := range page.Rows {
		if slices.Contains([]string{"filter-country", "filter-browser-family", "filter-browser-language", "filter-os"}, row.Key) && !row.Enabled {
			t.Errorf("%s was overridden by request headers", row.Key)
		}
	}
}

func TestNativeTemplatesGatesAndAction(t *testing.T) {
	app := offlineApp(t)
	r := request(app, "GET", "/gates", nil)
	for _, id := range []string{`id="dashboard-on"`, `id="any-on"`, `id="all-on"`, `id="variant">compact`, `id="compact-variant"`} {
		if !strings.Contains(r.Body.String(), id) {
			t.Fatalf("missing native branch %s: %s", id, r.Body.String())
		}
	}
	if strings.Contains(r.Body.String(), `id="dashboard-off"`) {
		t.Fatal("both branches rendered")
	}
	if got := request(app, "GET", "/beta", nil).Code; got != 200 {
		t.Fatalf("native gate allowed: %d", got)
	}
	if got := request(app, "POST", "/submit", nil).Code; got != 200 {
		t.Fatalf("native action: %d", got)
	}
	app.fixture.SetDashboard(false)
	eventually(t, func() bool { return !app.evaluate(context.Background(), "new-dashboard", toggly.Context{}) })
	r = request(app, "GET", "/gates", nil)
	if !strings.Contains(r.Body.String(), `id="dashboard-off"`) || !strings.Contains(r.Body.String(), `id="negate-visible"`) || strings.Contains(r.Body.String(), `id="all-on"`) {
		t.Fatal("native template did not reflect OFF update")
	}
	page := readSnapshot(t, app, "/api/snapshot")
	if page.All || !page.Any || !page.Negated {
		t.Fatal("multi-key or per-flag negate semantics lost")
	}
	// Exercise the actual native deny path with a downloaded OFF definition.
	gate := togglyhttp.MiddlewareWith(togglyhttp.Options{GetContext: contextForRequest})(togglyhttp.FeatureGate(app.client, "new-dashboard")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("disabled handler ran") })))
	out := httptest.NewRecorder()
	gate.ServeHTTP(out, httptest.NewRequest("GET", "/", nil))
	if out.Code != 404 {
		t.Fatalf("expected native deny404, got %d", out.Code)
	}
}

// Published v0.7.0 has no atomic variant+enabled API. The workshop must render
// GetVariant and IsEnabled as independent reads, not one consistent pair.
func TestAssignmentAndEnabledAreRenderedIndependently(t *testing.T) {
	app := offlineApp(t)
	on := request(app, "GET", "/gates", nil).Body.String()
	if !strings.Contains(on, `id="variant">compact`) || !strings.Contains(on, `id="compact-variant"`) || !strings.Contains(on, `id="variant-enabled"`) {
		t.Fatal("expected independently labeled assignment, compact layout, and enabled reads")
	}
	if !strings.Contains(on, "no atomic variant+enabled API") || !strings.Contains(on, "own provider snapshot") {
		t.Fatal("expected honest split-read copy")
	}
	page := readSnapshot(t, app, "/api/snapshot")
	if page.Variant == nil || page.Variant.Name != "compact" || !page.VariantEnabled {
		t.Fatal("expected both independent fields populated while the fixture is ON")
	}

	app.fixture.SetDashboard(false)
	eventually(t, func() bool {
		p := readSnapshot(t, app, "/api/snapshot")
		return p.Variant != nil && p.Variant.Name == "compact" && !p.VariantEnabled
	})
	off := request(app, "GET", "/gates", nil).Body.String()
	page = readSnapshot(t, app, "/api/snapshot")
	if page.Variant == nil || page.Variant.Name != "compact" {
		t.Fatal("assignment was dropped when the independent enabled read went false")
	}
	if page.VariantEnabled {
		t.Fatal("enabled read should be independently false")
	}
	if !strings.Contains(off, `id="compact-variant"`) {
		t.Fatal("compact UI was gated on IsEnabled, implying one atomic pair")
	}
	if !strings.Contains(off, `id="variant-enabled"`) || !strings.Contains(off, "OFF or unavailable") {
		t.Fatal("enabled state missing after the independent OFF read")
	}
	if strings.Contains(off, "neither variant UI branch is enabled") {
		t.Fatal("page still presents assignment and enabled as one pair")
	}
}

func TestConcurrentRequestsKeepIdentityClaimsAndOrderIsolated(t *testing.T) {
	app := offlineApp(t)
	var wg sync.WaitGroup
	for i := 0; i < 80; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			preset := "matching"
			wantID := "alice"
			want := true
			if i%2 != 0 {
				preset = "nonmatching"
				wantID = "bob"
				want = false
			}
			p := readSnapshot(t, app, "/api/snapshot?preset="+preset)
			if p.Context.Identity != wantID {
				t.Errorf("identity leaked: %s", p.Context.Identity)
			}
			for _, row := range p.Rows {
				if slices.Contains([]string{"filter-targeting", "filter-user-claims", "ExpressCheckout"}, row.Key) && row.Enabled != want {
					t.Errorf("%s leaked for %s", row.Key, wantID)
				}
			}
			if len(p.Orders) != 2 || !p.Orders[0].Enabled || p.Orders[1].Enabled {
				t.Error("per-entity result was cached by feature name")
			}
			wantVariant := "compact"
			if !want {
				wantVariant = "control"
			}
			if p.Variant == nil || p.Variant.Name != wantVariant {
				t.Errorf("variant leaked for %s: %#v", wantID, p.Variant)
			}
		}(i)
	}
	wg.Wait()
}

func TestVariantIdentityIsOnFirstRequestAndLocalContextNeedsNoFetch(t *testing.T) {
	// Long interval makes the lack of request-triggered refresh observable.
	app, err := New(Config{Offline: true, RefreshInterval: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Close)
	waitLoaded(t, app)
	before := len(app.fixture.Requests())
	_ = readSnapshot(t, app, "/api/snapshot?preset=nonmatching")
	_ = readSnapshot(t, app, "/api/snapshot?preset=matching")
	if len(app.fixture.Requests()) != before {
		t.Fatal("local context change triggered an API request")
	}
	seen := map[string]int{}
	for _, path := range app.fixture.Requests() {
		if strings.Contains(path, "evaluated-variants-signed") {
			u, err := url.Parse(path)
			if err != nil {
				t.Fatal(err)
			}
			seen[u.Query().Get("userId")]++
		}
	}
	if seen["alice"] != 1 || seen["bob"] != 1 || len(seen) != 2 {
		t.Fatalf("variant identities missing from initial fetch: %v", seen)
	}
	for _, path := range app.fixture.Requests() {
		if !strings.Contains(path, "evaluated-variants-signed") {
			continue
		}
		u, err := url.Parse(path)
		if err != nil {
			t.Fatal(err)
		}
		id := u.Query().Get("userId")
		if got := u.Query()["g"]; len(got) != 1 || got[0] != "sample-users" {
			t.Fatalf("%s initial variant groups: %v", id, got)
		}
		wantRole := "admin"
		if id == "bob" {
			wantRole = "user"
		}
		if got := u.Query().Get("claim.role"); got != wantRole {
			t.Fatalf("%s initial variant claim.role = %q, want %q", id, got, wantRole)
		}
	}
}

func TestSignedRefreshRejectsTamperingAndRecovers(t *testing.T) {
	app := offlineApp(t)
	app.fixture.SetTampered(true)
	app.fixture.SetDashboard(false)
	eventually(t, func() bool { return app.client.ProviderDebugInfo().LastErrorTime != nil })
	if !app.evaluate(context.Background(), "new-dashboard", toggly.Context{}) {
		t.Fatal("tampered payload replaced last accepted flags")
	}
	for _, v := range app.variants {
		eventually(t, func() bool { return v.ProviderDebugInfo().LastErrorTime != nil })
		on, err := v.IsEnabled(context.Background(), "new-dashboard", toggly.Context{})
		if err != nil || !on {
			t.Fatal("tampered signed variant replaced accepted state")
		}
	}
	if !strings.Contains(request(app, "GET", "/", nil).Body.String(), "historical") {
		t.Fatal("historical error status missing")
	}
	app.fixture.SetTampered(false)
	eventually(t, func() bool { return !app.evaluate(context.Background(), "new-dashboard", toggly.Context{}) })
	app.fixture.SetDashboard(true)
	eventually(t, func() bool { return app.evaluate(context.Background(), "new-dashboard", toggly.Context{}) })
}

func TestColdTamperedDefinitionsFailClosed(t *testing.T) {
	f, err := fixture.New()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	f.SetTampered(true)
	app, err := New(Config{AppKey: "fixture-only", DefinitionsURL: f.URL + "/", RefreshInterval: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	eventually(t, func() bool { return app.client.ProviderDebugInfo().LastErrorTime != nil })
	if app.evaluate(context.Background(), "new-dashboard", toggly.Context{}) {
		t.Fatal("cold tampered definitions enabled a flag")
	}
	if app.client.ProviderDebugInfo().LastRefresh != nil {
		t.Fatal("tampered response counted as accepted")
	}
}

func TestContextKindDoesNotEnforceEntityKindInPublishedEvaluator(t *testing.T) {
	app := offlineApp(t)
	ctx := toggly.Context{Entity: &toggly.EntityContext{Kind: "NotOrder", Key: "other", Attributes: map[string]any{"Vip": true}}}
	if !app.evaluate(context.Background(), "ExpressCheckout", ctx) {
		t.Fatal("published package behavior changed: recheck documented kind limitation")
	}
	ctx.Entity = nil
	if app.evaluate(context.Background(), "ExpressCheckout", ctx) {
		t.Fatal("absent entity did not fail closed")
	}
}

func TestPersonaCookieAndMissingKeyDenial(t *testing.T) {
	app, err := New(Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	for _, path := range []string{"/", "/gates", "/programmatic", "/identity", "/orders", "/filters", "/integrations"} {
		r := request(app, "GET", path, nil)
		if r.Code != 200 || !strings.Contains(r.Body.String(), "Missing app key") {
			t.Errorf("missing-key page %s failed", path)
		}
	}
	if request(app, "GET", "/beta", nil).Code != 404 || request(app, "POST", "/submit", nil).Code != 404 {
		t.Fatal("missing-key protected action allowed")
	}
	if request(app, "POST", "/fixture/dashboard", nil).Code != 404 {
		t.Fatal("fixture controls exposed in live mode")
	}
	req := httptest.NewRequest("POST", "/persona", strings.NewReader("preset=nonmatching"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rr := httptest.NewRecorder()
	app.Handler().ServeHTTP(rr, req)
	if rr.Code != 303 || len(rr.Result().Cookies()) != 1 {
		t.Fatal("persona not persisted")
	}
	next := httptest.NewRequest("GET", "/api/snapshot", nil)
	next.AddCookie(rr.Result().Cookies()[0])
	out := httptest.NewRecorder()
	app.Handler().ServeHTTP(out, next)
	var p Page
	if err := json.Unmarshal(out.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.Context.Identity != "bob" {
		t.Fatal("cookie persona ignored")
	}
	if request(app, "GET", "/unknown", nil).Code != 404 {
		t.Fatal("unknown route rendered home")
	}
}

func TestCloseStopsRefreshAndCanceledRequestsDoNotEvaluate(t *testing.T) {
	app := offlineApp(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if app.evaluate(ctx, "new-dashboard", toggly.Context{}) {
		t.Fatal("canceled sample action evaluated")
	}
	req := httptest.NewRequest("GET", "/", nil).WithContext(ctx)
	out := httptest.NewRecorder()
	app.Handler().ServeHTTP(out, req)
	if out.Body.Len() != 0 {
		t.Fatal("canceled response rendered")
	}
	// Close waits for active provider work. The fixture request count must stay
	// unchanged over several refresh intervals after close returns.
	app.Close()
	count := len(app.fixture.Requests())
	time.Sleep(90 * time.Millisecond)
	if len(app.fixture.Requests()) != count {
		t.Fatal("refresh leaked after shutdown")
	}
	app.Close() // App ownership protects the native client's non-idempotent Close.
}

func offlineApp(t *testing.T) *App {
	t.Helper()
	a, err := New(Config{Offline: true, RefreshInterval: 20 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(a.Close)
	waitLoaded(t, a)
	return a
}
func waitLoaded(t *testing.T, a *App) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	if err := a.WaitLoaded(ctx); err != nil {
		t.Fatalf("native clients did not load: %v; %#v", err, a.client.ProviderDebugInfo())
	}
}
func eventually(t *testing.T, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		if check() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("native state did not reach expected value")
}
func request(a *App, method, path string, body io.Reader) *httptest.ResponseRecorder {
	r := httptest.NewRecorder()
	a.Handler().ServeHTTP(r, httptest.NewRequest(method, path, body))
	return r
}
func readSnapshot(t *testing.T, a *App, path string) Page {
	t.Helper()
	r := request(a, "GET", path, nil)
	var p Page
	if err := json.Unmarshal(r.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

// Observe native readiness with a deadline rather than sleeping a guessed duration.
func (a *App) WaitLoaded(ctx context.Context) error {
	if a.client == nil {
		return nil
	}
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		loaded := a.client.ProviderDebugInfo().LastRefresh != nil
		for _, v := range a.variants {
			loaded = loaded && v.ProviderDebugInfo().LastRefresh != nil
		}
		if loaded {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func TestActualHTTPRoundTripUsesCookieContext(t *testing.T) {
	app := offlineApp(t)
	server := httptest.NewServer(app.Handler())
	defer server.Close()
	req, err := http.NewRequest("GET", server.URL+"/api/snapshot", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "sample-preset", Value: "nonmatching"})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var p Page
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		t.Fatal(err)
	}
	if p.Context.Identity != "bob" || p.Variant == nil || p.Variant.Name != "control" {
		t.Fatal("HTTP persona handoff failed")
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("identity-dependent snapshot may be cached")
	}
}

func TestCanceledActionDoesNotRun(t *testing.T) {
	app := offlineApp(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest("POST", "/submit", nil).WithContext(ctx)
	out := httptest.NewRecorder()
	app.Handler().ServeHTTP(out, req)
	if out.Body.Len() != 0 {
		t.Fatal("canceled request ran the action")
	}
}

// This characterization names a published artifact limitation. It keeps the
// README's security boundary honest; it does not patch or bypass the SDK.
func TestPublishedVariantPathAcceptsEnvelopeWithoutSignature(t *testing.T) {
	f, err := fixture.New()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	target, err := url.Parse(f.URL)
	if err != nil {
		t.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ModifyResponse = func(resp *http.Response) error {
		if !strings.Contains(resp.Request.URL.Path, "evaluated-variants-signed") {
			return nil
		}
		var envelope map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
			return err
		}
		resp.Body.Close()
		delete(envelope, "signature")
		delete(envelope, "kid")
		body, err := json.Marshal(envelope)
		if err != nil {
			return err
		}
		resp.Body = io.NopCloser(bytes.NewReader(body))
		resp.ContentLength = int64(len(body))
		resp.Header.Set("Content-Length", strconv.Itoa(len(body)))
		return nil
	}
	server := httptest.NewServer(proxy)
	defer server.Close()
	app, err := New(Config{AppKey: "fixture-only", DefinitionsURL: server.URL + "/", RefreshInterval: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	waitLoaded(t, app)
	for identity, client := range app.variants {
		if client.GetVariant("new-dashboard") == nil {
			t.Fatalf("published behavior changed for %s; recheck documented signature limitation", identity)
		}
	}
}
