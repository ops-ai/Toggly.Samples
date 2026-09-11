//! Plain server-rendered HTML keeps native Rust calls visible to beginners.
//! Escape every dynamic value before placing it in markup or an attribute.
use crate::{
    Mode,
    catalog::{FILTERS, FLAGS},
    context::{MATCHING_UA, NONMATCHING_UA, WorkshopContext},
    routes::{Decision, decision},
};
use toggly::{Requirement, TogglyClient};

pub const SECTIONS: [(&str, &str); 8] = [
    ("home", "Home"),
    ("declarative", "Declarative gates"),
    ("programmatic", "Programmatic API"),
    ("identity", "Identity"),
    ("orders", "Order context"),
    ("filters", "Filters matrix"),
    ("surfaces", "Rocket surfaces"),
    ("setup", "Configuration"),
];

pub fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn badge(result: &Decision) -> String {
    let (class, text) = if result.error {
        ("error", "ERROR → OFF")
    } else if result.enabled {
        ("on", "ON")
    } else {
        ("off", "OFF")
    };
    format!("<span class=\"badge {class}\">{text}</span>")
}

pub async fn page(
    section: &str,
    context: &WorkshopContext,
    client: Option<&TogglyClient>,
    mode: &Mode,
) -> String {
    let title = SECTIONS
        .iter()
        .find(|(slug, _)| *slug == section)
        .map(|(_, title)| *title)
        .unwrap_or("Home");
    let nav: String = SECTIONS
        .iter()
        .map(|(slug, name)| {
            format!(
                "<a href=\"/{slug}\" {}>{name}</a>\n",
                if *slug == section {
                    "aria-current=\"page\""
                } else {
                    ""
                }
            )
        })
        .collect();
    let banner = if mode.offline {
        r##"<aside class="notice" role="status">
    <strong>Missing app key — signed offline fixture</strong>
    <p>These flags come from the local fixture, evaluated by the real SDK. No live Toggly app is connected. Follow Configuration to connect your app.</p>
</aside>"##
    } else if mode.startup_failed {
        r##"<aside class="notice error" role="alert">
    <strong>SDK startup failed</strong>
    <p>No demo fallback was selected. Feature checks fail closed; review configuration and restart. Raw transport errors are hidden because they can contain the app key.</p>
</aside>"##
    } else {
        r##"<aside class="notice">Live configuration selected. Results depend on your app definitions; no live provisioning is implied.</aside>"##
    };
    let body = match section {
        "home" => home(context, client).await,
        "filters" => filters(context, client).await,
        "declarative" => declarative(context, client).await,
        "programmatic" => programmatic(context, client).await,
        "identity" => identity(context),
        "orders" => orders(context, client).await,
        "surfaces" => surfaces(),
        _ => setup(),
    };
    let refresh_warning = if let Some(client) = client {
        if client.last_error().await.is_some() {
            r##"<aside class="notice error" role="status">The latest definition refresh failed. The last accepted definitions remain in use. Raw error details are hidden.</aside>"##
        } else {
            ""
        }
    } else {
        ""
    };
    let controls = controls(section, context);
    format!(
        r##"<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title} · Rust Rocket SDK Workshop</title>
    <link rel="stylesheet" href="/static/workshop.css">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header>
    <div class="eyebrow">TOGGLY / RUST + ROCKET</div>
    <h1>Feature flags, one request at a time.</h1>
    <p>A hands-on workshop using published toggly 0.4.0, toggly-rocket 0.4.0 and Rocket 0.5.1.</p>
</header>
<nav aria-label="Workshop sections">
{nav}</nav>
<main id="content">
{banner}
{refresh_warning}
<div class="section-heading">
<span class="eyebrow">WORKSHOP</span>
<h2>{title}</h2>
</div>
{body}
{controls}
</main>
<footer>Rust 1.98.1 · One managed client · Request-local context · Demo personas are not authentication</footer>
</body>
</html>
"##
    )
}

async fn home(context: &WorkshopContext, client: Option<&TogglyClient>) -> String {
    let mut rows = String::new();
    // One check per displayed flag; presence is separate provider metadata and
    // is not presented as the reason belonging to that decision.
    let keys = if let Some(client) = client {
        client.feature_keys().await
    } else {
        Vec::new()
    };
    for key in FLAGS {
        let result = decision(client, key, &context.evaluation).await;
        rows.push_str(&format!(
            "<tr>
<th scope=\"row\"><code>{key}</code></th>
<td>{}</td>
<td>{}</td>
</tr>\n",
            if keys.iter().any(|known| known == key) {
                "Present"
            } else {
                "Absent"
            },
            badge(&result)
        ));
    }
    let sections: String = SECTIONS
        .iter()
        .skip(1)
        .map(|(slug, title)| format!("<li><a href=\"/{slug}\">{title}</a></li>\n"))
        .collect();
    format!(
        r##"<div class="grid">
<section class="card">
    <h3>Your first flag</h3>
    <ol>
        <li>Run with no app key to explore signed local fixtures.</li>
        <li>Open Declarative gates: the fixture enables <code>new-dashboard</code>.</li>
        <li>Connect your app using Configuration. Switch that flag off in Production, wait up to 30 seconds, then reload this page.</li>
        <li>Compare the gate and the programmatic response.</li>
    </ol>
    <p>The offline fixture is static. Edit <code>fixtures/definitions.json</code> and restart to try an offline toggle.</p>
</section>
<section class="card">
    <h3>Explore the eight sections</h3>
    <p>Home combines navigation, the shared flag checklist and a live-on-request snapshot.</p>
    <ul>
{sections}    </ul>
</section>
</div>
<section class="card">
    <h3>Flag checklist and current decisions</h3>
    <p>Reload for fresh checks. Definitions poll every 30 seconds live / 2 seconds offline. Each row is a separate SDK call; this is not an atomic revision snapshot. Presence was read separately.</p>
    <a class="button secondary" href="/home">Reload snapshot</a>
    <div class="table-scroll">
<table>
        <thead>
<tr>
<th>Shared flag</th>
<th>Provider presence</th>
<th>Native result</th>
</tr>
</thead>
        <tbody>
{rows}        </tbody>
    </table></div>
    <p><a href="/api/snapshot">Inspect the JSON snapshot</a></p>
</section>"##
    )
}

async fn filters(context: &WorkshopContext, client: Option<&TogglyClient>) -> String {
    let mut rows = String::new();
    for (key, name, expectation) in FILTERS {
        let result = decision(client, key, &context.evaluation).await;
        rows.push_str(&format!(
            "<tr>
<th scope=\"row\">{name}<br><code>{key}</code></th>
<td>{}</td>
<td>{expectation}</td>
</tr>\n",
            badge(&result)
        ));
    }
    format!(
        r##"<section class="card">
    <h3>Eleven native filter checks</h3>
    <p>Apply Matching or Non-matching below, then compare this table. Presets use the exact shared identity, claim, country, language, User-Agent and Order values.</p>
    <p><strong>Published SDK gap:</strong> the desktop Macintosh device is parsed as Other, so DeviceType stays off for both presets. The Macintosh recipe is preserved. Mac operating-system matching is supported.</p>
    <div class="table-scroll">
<table>
        <thead>
<tr>
<th>Filter / shared key</th>
<th>Native result</th>
<th>Expected behavior</th>
</tr>
</thead>
        <tbody>
{rows}        </tbody>
    </table></div>
</section>"##
    )
}

async fn declarative(context: &WorkshopContext, client: Option<&TogglyClient>) -> String {
    let mut cards = String::new();
    for (title, keys, requirement, negate) in [
        (
            "Single feature",
            vec!["new-dashboard"],
            Requirement::All,
            false,
        ),
        (
            "Negated feature",
            vec!["new-dashboard"],
            Requirement::All,
            true,
        ),
        (
            "Any dashboard or API",
            vec!["new-dashboard", "api-v2"],
            Requirement::Any,
            false,
        ),
        (
            "All dashboard and API",
            vec!["new-dashboard", "api-v2"],
            Requirement::All,
            false,
        ),
        (
            "Any negated feature",
            vec!["new-dashboard", "api-v2"],
            Requirement::Any,
            true,
        ),
        (
            "All negated features",
            vec!["new-dashboard", "api-v2"],
            Requirement::All,
            true,
        ),
    ] {
        let result = match client {
            Some(client) => {
                client
                    .evaluate_gate(&keys, requirement, context.evaluation.clone(), negate)
                    .await
            }
            None => Err(toggly::Error::Config("unavailable".into())),
        };
        let value = Decision {
            key: title.into(),
            enabled: result.as_ref().copied().unwrap_or(false),
            error: result.is_err(),
        };
        let content = if value.enabled {
            "Enabled content is rendered."
        } else {
            "Fallback content is rendered."
        };
        cards.push_str(&format!(
            "<article class=\"card\">\n<h3>{title}</h3>\n{}\n<p>{content}</p>\n</article>\n",
            badge(&value)
        ));
    }
    format!(
        r##"<section class="card">
    <h3>HTML composition around a native gate</h3>
    <p>Rocket has no Toggly template directive. This sample declares keys, a requirement and negate, calls native <code>evaluate_gate</code>, then chooses HTML.</p>
    <pre><code>client.evaluate_gate(
    &amp;["new-dashboard", "api-v2"],
    Requirement::Any,
    request_context.clone(),
    false,
).await?</code></pre>
    <p>Published 0.4.0 negates each individual feature before Any/All aggregation. It does not invert the final gate. An empty key list returns false. Errors render the fallback.</p>
</section>
<div class="grid">
{cards}</div>
<section class="card">
    <h3>Variants: unsupported</h3>
    <p>Published toggly 0.4.0 has no native variant allocation API. This sample does not invent a variant or call a boolean result a variant.</p>
</section>"##
    )
}

async fn programmatic(context: &WorkshopContext, client: Option<&TogglyClient>) -> String {
    let api = decision(client, "api-v2", &context.evaluation).await;
    let unknown = decision(client, "not-in-the-catalog", &context.evaluation).await;
    let error = decision(client, "", &context.evaluation).await;
    let submit = decision(client, "enhanced-submit", &context.evaluation).await;
    let button = if submit.enabled {
        format!(
            r##"<form method="post" action="/submit">
    <input type="hidden" name="csrf" value="{}">
    <button>Try enhanced submit</button>
</form>"##,
            escape(&context.csrf)
        )
    } else {
        "<p>The enhanced submit button is hidden because its flag is off.</p>".into()
    };
    format!(
        r##"<section class="card">
    <h3>Core evaluation with request context</h3>
    <pre><code>let result = client.is_enabled("api-v2", context).await;
match result {{
    Ok(true) =&gt; render_v2(),
    Ok(false) =&gt; render_v1(),
    Err(_) =&gt; render_safe_error(),
}}</code></pre>
    <p><code>api-v2</code>: {api_badge}</p>
    <p><code>not-in-the-catalog</code>: {unknown_badge} — unknown key defaults to false.</p>
    <p>Empty key: {error_badge} — native configuration error, displayed separately from a normal off result.</p>
    <p><a href="/api/check?key=api-v2">Check api-v2</a> · <a href="/api/check?key=not-in-the-catalog">Check unknown key</a> · <a href="/api/check?key=">Check empty key</a></p>
    <h3>Server-side action gate</h3>
    <p><code>enhanced-submit</code>: {submit_badge}. The POST checks CSRF and re-evaluates the flag; hiding a button alone is insufficient. No business data is changed.</p>
{button}
</section>"##,
        api_badge = badge(&api),
        unknown_badge = badge(&unknown),
        error_badge = badge(&error),
        submit_badge = badge(&submit)
    )
}

fn identity(context: &WorkshopContext) -> String {
    let persona =
        escape(&serde_json::to_string_pretty(&context.persona).expect("serializable persona"));
    format!(
        r##"<section class="card">
    <h3>User and request context</h3>
    <p>The sample guard reads an encrypted private cookie, resolves a persona and builds a new EvalContext before any SDK check. It never writes identity into the process-wide client.</p>
    <p>Use two browser profiles to compare independent sessions. Change only Order or claims while keeping alice to test context sensitivity. An empty identity means anonymous.</p>
    <p>These editable personas are workshop input, not login or permission checks. A real app must use authenticated server identity and trusted proxy metadata.</p>
    <pre><code>{persona}</code></pre>
</section>"##
    )
}

async fn orders(context: &WorkshopContext, client: Option<&TogglyClient>) -> String {
    let result = decision(client, "ExpressCheckout", &context.evaluation).await;
    let entity = escape(
        &serde_json::to_string_pretty(&context.evaluation.entity).expect("serializable entity"),
    );
    format!(
        r##"<section class="card">
    <h3>Express Checkout</h3>
    <p><code>ExpressCheckout</code>: {result}</p>
    <p>The user answers “who?”. The Order answers “what?”. Id maps to the entity key, Vip is a boolean, and Total is an optional number.</p>
    <p>Keep identity fixed and switch ord-vip (Vip=true, Total=40) to ord-standard (Vip=false, Total=40). ord-high-value has Total=250 but is not VIP; ord-no-total omits Total.</p>
    <pre><code>{entity}</code></pre>
    <p>Register the Order schema locally before client construction. In published 0.4.0 the remote schema PUT happens after the first definition fetch and is best-effort; provision the context and flag binding manually as described in Configuration.</p>
</section>"##,
        result = badge(&result)
    )
}

fn surfaces() -> String {
    r##"<section class="card">
    <h3>Native Rocket Feature guard</h3>
    <pre><code>#[get("/native")]
async fn native(feature: toggly_rocket::Feature&lt;'_&gt;) {
    let enabled = feature.is_enabled("beta-access").await;
    // feature.context() and feature.client() expose the native context/client.
}</code></pre>
    <p><a href="/native">Try the native guard</a>. It reads X-User-Id first, then X-Identity; absent headers are anonymous. Those headers are untrusted demo inputs. The adapter does not map workshop cookies, claims, groups, request metadata or Order.</p>
    <pre><code>curl -H 'X-User-Id: alice' -H 'X-Identity: bob' http://localhost:8016/native</code></pre>
    <p>The native guard returns false on evaluation error and HTTP 500 if managed state is absent. FeatureEnabled and FeatureDisabled are data structs without FromRequest implementations in 0.4.0, so they cannot be used as native route guards.</p>
    <h3>Full-context denial route: sample composition</h3>
    <p><a href="/beta">Open the beta route</a>. The sample guard assembles context, the native core evaluates beta-access, and the route returns 404 when disabled or 503 on error.</p>
    <h3>Fairing and lifetime</h3>
    <p>TogglyFairing::from_config constructs native managed state on Ignite. The integration test exercises it with a placeholder fixture. The workshop uses explicit construction to register Order and handle startup errors visibly. The native fairing logs its app key and has no close hook, so it is not used with your real key here.</p>
    <p>Rocket owns one TogglyClient value. Its native shutdown hook calls close once. No per-request client, identity mutation, definition refresh or cache clear occurs.</p>
    <h3>Interactive cache configuration</h3>
    <p>The default 60-second evaluation key omits Order, claims and request metadata. This workshop uses the public cache_ttl(Duration::ZERO) setting so those edits expire immediately. Entries are still created, and expiry uses the runtime clock; this is not a structural cache-disable switch. Downloaded definitions remain cached.</p>
</section>"##.into()
}

fn setup() -> String {
    r##"<section class="card">
    <h3>Connect your own Toggly application</h3>
    <ol>
        <li>Create Rust Rocket SDK Sample in Toggly Samples, technology Rust, environment Production.</li>
        <li>Use the reviewed manual setup guide linked in README. Register Order (Id string key, Vip boolean, Total optional number).</li>
        <li>Create all sixteen flags from the shared template and save each final configuration. Request definitions and read back the saved filter and context binding.</li>
        <li>Export TOGGLY_APP_KEY and restart. Environment defaults to Production.</li>
    </ol>
    <p>This server evaluates locally. Browser origins are only needed if you introduce direct browser SDK requests; when applicable add http://localhost:8016 (and http://127.0.0.1:8016 if used).</p>
    <p>No live app has been provisioned by this sample. Keep real keys in local environment configuration and never commit them. The app does not load .env files automatically.</p>
    <h3>Loading, defaults and errors</h3>
    <p>Startup awaits the initial signed definitions before serving requests. A missing or placeholder key selects the visible signed loopback fixture. A real-key startup error leaves the workshop available with errors/off decisions and no silent demo fallback.</p>
    <p>Unknown keys return false. A failed refresh retains the last accepted definitions; reload the snapshot after the next successful poll. Raw transport errors are never shown because they may contain the app key.</p>
</section>"##.into()
}

fn select(name: &str, label: &str, selected: &str, options: &[(&str, &str)]) -> String {
    let options: String = options
        .iter()
        .map(|(value, title)| {
            format!(
                "<option value=\"{}\" {}>{}</option>\n",
                escape(value),
                if *value == selected { "selected" } else { "" },
                escape(title)
            )
        })
        .collect();
    format!(
        r##"<label>{label}
<select name="{name}">
{options}</select>
</label>
"##
    )
}

fn controls(section: &str, context: &WorkshopContext) -> String {
    let persona = &context.persona;
    let csrf = escape(&context.csrf);
    let identity = escape(&persona.identity);
    let role = select(
        "role",
        "Claim: role",
        &persona.role,
        &[("admin", "admin"), ("user", "user")],
    );
    let country = select(
        "country",
        "Country",
        &persona.country,
        &[("US", "US"), ("CA", "CA")],
    );
    let language = select(
        "language",
        "Accept-Language",
        &persona.language,
        &[
            ("en-US,en;q=0.9", "en-US,en;q=0.9"),
            ("fr-FR,fr;q=0.9", "fr-FR,fr;q=0.9"),
        ],
    );
    let ua = select(
        "user_agent",
        "User-Agent",
        &persona.user_agent,
        &[
            (MATCHING_UA, "Chrome 120 / macOS 10.15.7"),
            (NONMATCHING_UA, "Firefox 121 / Windows 10"),
        ],
    );
    let order = select(
        "order",
        "Order",
        &persona.order,
        &[
            ("ord-vip", "ord-vip · VIP · 40"),
            ("ord-standard", "ord-standard · standard · 40"),
            ("ord-high-value", "ord-high-value · standard · 250"),
            ("ord-no-total", "ord-no-total · standard · Total absent"),
        ],
    );
    format!(
        r##"<section class="card controls" aria-labelledby="context-heading">
    <h3 id="context-heading">Change this session's context</h3>
    <p>Matching sets alice/admin/US/English/Chrome on Mac/VIP. Non-matching sets bob/user/CA/French/Firefox on Windows/standard. Individual edits retain all other inputs.</p>
    <form method="post" action="/session" class="preset-buttons">
        <input type="hidden" name="csrf" value="{csrf}">
        <input type="hidden" name="destination" value="{section}">
        <button name="action" value="matching">Matching</button>
        <button name="action" value="nonmatching" class="secondary">Non-matching</button>
        <button name="action" value="reset" class="secondary">Reset session</button>
    </form>
    <form method="post" action="/session">
        <input type="hidden" name="csrf" value="{csrf}">
        <input type="hidden" name="destination" value="{section}">
        <input type="hidden" name="action" value="update">
        <div class="form-grid">
            <label>Identity (empty = anonymous)
                <input name="identity" value="{identity}" maxlength="64">
            </label>
{role}{country}{language}{ua}{order}        </div>
        <button>Apply context</button>
    </form>
</section>"##
    )
}
