package workshop

import (
	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/toggly"
	"net/http"
	"sync"
)

const matchingUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const nonmatchingUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"

type Order struct {
	Id    string
	Vip   bool
	Total float64
}

var registerOnce sync.Once

func registerOrder() {
	registerOnce.Do(func() {
		// Register a domain schema once. Request-specific values go into MapEntity,
		// never into this process-wide registry.
		toggly.RegisterContext("Order", func(v any) toggly.EntityContext {
			o := v.(Order)
			return toggly.EntityContext{Kind: "Order", Key: o.Id, Attributes: map[string]any{"Id": o.Id, "Vip": o.Vip, "Total": o.Total}}
		}, &toggly.EntityContextSchemaRegistration{KeyProperty: "Id", Properties: []toggly.EntityContextPropertySchema{{Name: "Id", Type: "string"}, {Name: "Vip", Type: "boolean"}, {Name: "Total", Type: "number"}}})
	})
}

// contextForRequest is sample composition, not an authentication mechanism.
// In a real app use a verified principal and trusted proxy metadata here.
// Every map/pointer is fresh so concurrent requests cannot share persona data.
func contextForRequest(r *http.Request) toggly.Context {
	preset := "matching"
	if c, err := r.Cookie("sample-preset"); err == nil && c.Value == "nonmatching" {
		preset = c.Value
	}
	if q := r.URL.Query().Get("preset"); q == "matching" || q == "nonmatching" {
		preset = q
	}
	id, role, country, lang, ua := "alice", "admin", "US", "en-US,en;q=0.9", matchingUA
	order := Order{"ord-vip", true, 125}
	if preset == "nonmatching" {
		id, role, country, lang, ua = "bob", "user", "CA", "fr-FR,fr;q=0.9", nonmatchingUA
		order = Order{"ord-standard", false, 125}
	}
	// Controls stay bounded to two demo personas so variant clients can be
	// constructed once with matching VariantIdentity/Groups/Claims. MiddlewareWith
	// still merges missing request fields from headers; these values are set so
	// a browser UA cannot override the shared Matching/Non-matching recipe.
	return toggly.Context{Identity: id, Groups: []string{"sample-users"}, Claims: map[string]string{"role": role}, Request: &toggly.RequestContext{UserAgent: ua, AcceptLanguage: lang, Country: country}, Entity: toggly.MapEntity("Order", order)}
}
