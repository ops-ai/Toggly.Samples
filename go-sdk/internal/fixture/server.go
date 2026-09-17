// Package fixture is an explicitly selected, loopback-only teaching service.
// It supplies sample definitions; the published SDK still downloads, verifies,
// and evaluates them. None of these values are Toggly app credentials.
package fixture

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ops-ai/Toggly.FeatureManagement/toggly-go/toggly/definitions"
)

type Server struct {
	*httptest.Server
	mu        sync.Mutex
	KeyID     string
	key       *ecdsa.PrivateKey
	dashboard bool
	tampered  bool
	revision  int64
	requests  []string
}

func New() (*Server, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	x, y := make([]byte, 32), make([]byte, 32)
	key.X.FillBytes(x)
	key.Y.FillBytes(y)
	digest := sha1.Sum(append(x, y...)) // Protocol key identifier, not the signing algorithm.
	s := &Server{key: key, KeyID: strings.ToUpper(hex.EncodeToString(digest[:])) + "ES256", dashboard: true, revision: time.Now().Unix()}
	s.Server = httptest.NewServer(http.HandlerFunc(s.serve))
	return s, nil
}

// SetDashboard changes only the local fixture, never a Toggly application.
func (s *Server) SetDashboard(on bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dashboard = on
	s.revision++
}
func (s *Server) SetTampered(on bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tampered = on
	s.revision++
}
func (s *Server) Requests() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.requests...)
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests = append(s.requests, r.URL.RequestURI())
	w.Header().Set("Content-Type", "application/json")
	if r.URL.Path == "/.well-known/jwks" {
		// Fixed-width coordinates are required by ES256 JWK encoding.
		x, y := make([]byte, 32), make([]byte, 32)
		s.key.X.FillBytes(x)
		s.key.Y.FillBytes(y)
		_ = json.NewEncoder(w).Encode(definitions.JWKSet{Keys: []definitions.JWK{{Kty: "EC", Use: "sig", Kid: s.KeyID, Crv: "P-256", Alg: "ES256", X: base64.RawURLEncoding.EncodeToString(x), Y: base64.RawURLEncoding.EncodeToString(y)}}})
		return
	}
	var payload any
	switch {
	case strings.HasPrefix(r.URL.Path, "/definitions-signed/"):
		payload = Definitions(s.dashboard)
	case strings.HasPrefix(r.URL.Path, "/evaluated-variants-signed/"):
		name := "control"
		if r.URL.Query().Get("userId") == "alice" {
			name = "compact"
		}
		payload = map[string]definitions.EvaluatedVariantDef{"new-dashboard": {Enabled: s.dashboard, Variant: name, ConfigurationValue: map[string]any{"layout": name}}}
	default:
		http.NotFound(w, r)
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		http.Error(w, "fixture encoding failed", 500)
		return
	}
	// Toggly's wire format signs SHA256(SHA256(exact defs JSON + |timestamp)).
	first := sha256.Sum256([]byte(string(raw) + "|" + strconv.FormatInt(s.revision, 10)))
	hash := sha256.Sum256(first[:])
	a, b, err := ecdsa.Sign(rand.Reader, s.key, hash[:])
	if err != nil {
		http.Error(w, "fixture signing failed", 500)
		return
	}
	sig := make([]byte, 64)
	a.FillBytes(sig[:32])
	b.FillBytes(sig[32:])
	if s.tampered {
		sig[0] ^= 1
	}
	w.Header().Set("ETag", fmt.Sprintf("\"fixture-%d\"", s.revision))
	_ = json.NewEncoder(w).Encode(definitions.SignedDefinitionsResponse{Defs: raw, Signature: base64.StdEncoding.EncodeToString(sig), Kid: s.KeyID, Timestamp: s.revision})
}

// These parameters mirror the shared flag recipe, including the Macintosh
// device value. The Go user-agent parser's mismatch is shown, not rewritten.
func Definitions(dashboard bool) []definitions.FeatureDefinitionModel {
	makeFlag := func(key, name string, p map[string]any) definitions.FeatureDefinitionModel {
		return definitions.FeatureDefinitionModel{FeatureKey: key, Filters: []definitions.FeatureFilter{{Name: name, Parameters: p}}}
	}
	on := "AlwaysOff"
	if dashboard {
		on = "AlwaysOn"
	}
	defs := []definitions.FeatureDefinitionModel{
		makeFlag("new-dashboard", on, nil), makeFlag("api-v2", "AlwaysOn", nil), makeFlag("enhanced-submit", "AlwaysOn", nil), makeFlag("beta-access", "AlwaysOn", nil),
		makeFlag("filter-always-on", "AlwaysOn", nil), makeFlag("filter-percentage", "Percentage", map[string]any{"Value": 50}),
		makeFlag("filter-targeting", "Targeting", map[string]any{"Audience.Users:0": "alice"}),
		makeFlag("filter-user-claims", "UserClaims", map[string]any{"Percentage": 100, "Claim": "role", "Value": "admin"}),
		makeFlag("filter-time-window", "TimeWindow", map[string]any{"Start": "2020-01-01T00:00:00Z", "End": "2099-12-31T23:59:59Z"}),
	}
	for _, seg := range []struct{ key, name, param, value string }{{"country", "Country", "Country", "US"}, {"browser-family", "BrowserFamily", "BrowserFamily", "Chrome"}, {"browser-language", "BrowserLanguage", "BrowserLanguage", "en"}, {"device-type", "DeviceType", "DeviceType", "Macintosh"}, {"os", "OperatingSystem", "OperatingSystem", "Mac"}} {
		defs = append(defs, makeFlag("filter-"+seg.key, seg.name, map[string]any{"Percentage": 100, seg.param + ":0": seg.value}))
	}
	for _, key := range []string{"ExpressCheckout", "filter-context-property"} {
		d := makeFlag(key, "ContextProperty", map[string]any{"Property": "Vip", "Operator": "eq", "Value": "true", "ValueType": "boolean"})
		d.ContextKind = "Order"
		defs = append(defs, d)
	}
	return defs
}
