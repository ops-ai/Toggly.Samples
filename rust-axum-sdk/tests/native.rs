//! Integration tests use published crates and a signed HTTP transport fixture.
//! No mocked evaluator, SDK source patch, production key or database is involved.
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Method, Request, StatusCode, header},
};
use cookie::Key;
use rust_axum_sdk_sample::{
    Mode, application, application_with_key,
    catalog::{FILTERS, FLAGS},
    context::{self, Persona},
    fixture::Fixture,
    routes::Decision,
};
use serde_json::{Value, json};
use std::{collections::HashMap, sync::Arc, time::Duration};
use toggly::{EvalContext, Requirement, TogglyClient};
use tower::ServiceExt;

struct Session {
    cookies: HashMap<String, String>,
}

impl Session {
    fn new() -> Self {
        Self {
            cookies: HashMap::new(),
        }
    }

    fn header(&self) -> Option<String> {
        if self.cookies.is_empty() {
            None
        } else {
            Some(
                self.cookies
                    .iter()
                    .map(|(name, value)| format!("{name}={value}"))
                    .collect::<Vec<_>>()
                    .join("; "),
            )
        }
    }

    fn store(&mut self, headers: &axum::http::HeaderMap) {
        for value in headers.get_all(header::SET_COOKIE) {
            let Ok(text) = value.to_str() else {
                continue;
            };
            let Some(pair) = text.split(';').next() else {
                continue;
            };
            let Some((name, cookie)) = pair.split_once('=') else {
                continue;
            };
            self.cookies
                .insert(name.trim().to_owned(), cookie.to_owned());
        }
    }
}

async fn exchange(
    app: &Router,
    session: &mut Session,
    mut builder: axum::http::request::Builder,
    body: Body,
) -> (StatusCode, axum::http::HeaderMap, axum::body::Bytes) {
    if let Some(cookie) = session.header() {
        builder = builder.header(header::COOKIE, cookie);
    }
    let response = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    session.store(&headers);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, headers, body)
}

async fn workshop() -> (Router, Fixture, Arc<TogglyClient>) {
    context::register_order();
    let fixture = Fixture::start().unwrap();
    let client = Arc::new(TogglyClient::new(fixture.config(false)).await.unwrap());
    let app = application_with_key(
        Some(client.clone()),
        Mode {
            offline: true,
            startup_failed: false,
        },
        Key::generate(),
    );
    (app, fixture, client)
}

async fn token(app: &Router, session: &mut Session) -> String {
    let (_, _, body) = exchange(
        app,
        session,
        Request::builder().uri("/identity"),
        Body::empty(),
    )
    .await;
    let html = String::from_utf8(body.to_vec()).unwrap();
    html.split("name=\"csrf\" value=\"")
        .nth(1)
        .unwrap()
        .split('"')
        .next()
        .unwrap()
        .into()
}

async fn preset(app: &Router, session: &mut Session, matching: bool) {
    let csrf = token(app, session).await;
    let (status, headers, _) = exchange(
        app,
        session,
        Request::builder()
            .method(Method::POST)
            .uri("/session")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!(
            "csrf={csrf}&destination=filters&action={}",
            if matching { "matching" } else { "nonmatching" }
        )),
    )
    .await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    assert_eq!(headers.get(header::LOCATION).unwrap(), "/filters");
}

#[tokio::test]
async fn full_matrix_initial_context_unknown_error_and_order() {
    let (app, fixture, core) = workshop().await;
    assert_eq!(core.feature_keys().await.len(), 16);
    for matching in [true, false] {
        // First evaluations already receive all context fields, not a later mutation.
        let context = Persona::preset(matching).evaluation();
        for (key, _, _) in FILTERS {
            let actual = core.is_enabled(key, context.clone()).await.unwrap();
            match key {
                "filter-always-on" | "filter-time-window" => assert!(actual, "{key}"),
                "filter-percentage" => {
                    assert_eq!(actual, core.is_enabled(key, context.clone()).await.unwrap())
                }
                // Preserve the exact shared Macintosh recipe and assert the known
                // native gap rather than replacing the evaluator to make it pass.
                "filter-device-type" => assert!(!actual),
                _ => assert_eq!(actual, matching, "{key}"),
            }
        }
        assert_eq!(
            core.is_enabled("ExpressCheckout", context).await.unwrap(),
            matching
        );
    }
    for id in ["ord-standard", "ord-high-value", "ord-no-total", "ord-vip"] {
        let mut persona = Persona::preset(true);
        persona.order = id.into();
        assert_eq!(
            core.is_enabled("ExpressCheckout", persona.evaluation())
                .await
                .unwrap(),
            id == "ord-vip"
        );
    }
    assert!(
        !context::order("ord-no-total")
            .unwrap()
            .attributes
            .contains_key("Total")
    );
    assert!(context::order("unrecognized").is_none());
    assert!(
        !core
            .is_enabled("unknown", EvalContext::default())
            .await
            .unwrap()
    );
    assert!(core.is_enabled("", EvalContext::default()).await.is_err());
    assert!(
        !core
            .is_enabled("ExpressCheckout", EvalContext::with_identity("alice"))
            .await
            .unwrap()
    );
    assert!(
        !core
            .is_enabled("filter-percentage", EvalContext::default())
            .await
            .unwrap()
    );
    assert_eq!(
        fixture.request_count(),
        1,
        "evaluation must not fetch definitions"
    );
    let schemas = fixture.schema_requests.lock().unwrap().clone();
    let order = &schemas[0]["contexts"][0];
    assert_eq!(order["kind"], "Order");
    assert_eq!(order["keyProperty"], "Id");
    assert!(
        order["properties"]
            .as_array()
            .unwrap()
            .contains(&json!({"name":"Vip", "type":"boolean"}))
    );
    drop(app);
}

#[tokio::test]
async fn gates_native_extractor_layer_state_and_missing_extension() {
    let (app, fixture, core) = workshop().await;
    let context = Persona::preset(true).evaluation();
    let keys = ["new-dashboard", "api-v2"];
    for (requirement, negate, expected) in [
        (Requirement::Any, false, true),
        (Requirement::All, false, false),
        (Requirement::Any, true, true),
        (Requirement::All, true, false),
    ] {
        assert_eq!(
            core.evaluate_gate(&keys, requirement, context.clone(), negate)
                .await
                .unwrap(),
            expected
        );
    }
    assert!(
        !core
            .evaluate_gate(&[], Requirement::Any, context, true)
            .await
            .unwrap()
    );
    let mut session = Session::new();
    let (_, _, body) = exchange(
        &app,
        &mut session,
        Request::builder()
            .uri("/native")
            .header("X-User-Id", "alice")
            .header("X-Identity", "bob"),
        Body::empty(),
    )
    .await;
    let native: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(native["identity"], "alice");
    assert_eq!(native["enabled"], true);
    let (_, _, body) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/native"),
        Body::empty(),
    )
    .await;
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap()["identity"],
        Value::Null
    );
    let (_, _, body) = exchange(
        &app,
        &mut Session::new(),
        Request::builder()
            .uri("/native")
            .header("X-Identity", "bob"),
        Body::empty(),
    )
    .await;
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap()["identity"],
        "bob"
    );
    let (status, _, _) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/beta"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/layer"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, body) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/state"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap()["enabled"],
        true
    );
    let (status, _, body) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/extractor"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        serde_json::from_slice::<Value>(&body).unwrap()["enabled"],
        true
    );

    tokio::time::sleep(Duration::from_secs(1)).await;
    let mut definitions = Fixture::definitions();
    for definition in definitions.as_array_mut().unwrap() {
        if ["beta-access", "enhanced-submit"].contains(&definition["featureKey"].as_str().unwrap())
        {
            definition["filters"] = json!([{"name":"AlwaysOff", "parameters":{}}]);
        }
    }
    fixture.replace(definitions, false);
    core.refresh().await.unwrap();
    assert!(
        !core
            .is_enabled("beta-access", EvalContext::default())
            .await
            .unwrap()
    );
    let (status, _, _) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/beta"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _, _) = exchange(
        &app,
        &mut Session::new(),
        Request::builder().uri("/layer"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let mut session = Session::new();
    let csrf = token(&app, &mut session).await;
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/submit")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!("csrf={csrf}")),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let missing = application(
        None,
        Mode {
            offline: false,
            startup_failed: true,
        },
    );
    let (status, _, _) = exchange(
        &missing,
        &mut Session::new(),
        Request::builder().uri("/native"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    let (status, _, _) = exchange(
        &missing,
        &mut Session::new(),
        Request::builder().uri("/beta"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    let (status, _, body) = exchange(
        &missing,
        &mut Session::new(),
        Request::builder().uri("/"),
        Body::empty(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        String::from_utf8(body.to_vec())
            .unwrap()
            .contains("SDK startup failed")
    );
    let (status, _, _) = exchange(
        &missing,
        &mut Session::new(),
        Request::builder().uri("/layer"),
        Body::empty(),
    )
    .await;
    // Published TogglyLayer allows the request through when the client extension
    // is missing instead of failing closed.
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn sessions_csrf_validation_escape_and_pages() {
    let (app, _, _) = workshop().await;
    let mut session = Session::new();
    for (slug, _) in rust_axum_sdk_sample::views::SECTIONS {
        let (status, headers, body) = exchange(
            &app,
            &mut session,
            Request::builder().uri(format!("/{slug}")),
            Body::empty(),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{slug}");
        assert_eq!(headers.get(header::CACHE_CONTROL).unwrap(), "no-store");
        assert!(
            String::from_utf8(body.to_vec())
                .unwrap()
                .contains("Missing app key")
        );
    }
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/session")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from("csrf=wrong&action=matching&destination=home"),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let csrf = token(&app, &mut session).await;
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/session")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!(
            "csrf={csrf}&action=update&destination=home&order=invalid"
        )),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/session")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!(
            "csrf={csrf}&action=matching&destination=https://bad.example"
        )),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/session")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!(
            "csrf={csrf}&action=update&destination=identity&identity=%3Cscript%3E"
        )),
    )
    .await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    let (_, _, body) = exchange(
        &app,
        &mut session,
        Request::builder().uri("/identity"),
        Body::empty(),
    )
    .await;
    let html = String::from_utf8(body.to_vec()).unwrap();
    assert!(!html.contains("<script>"));
    assert!(html.contains("&lt;script&gt;"));
    for matching in [true, false, true] {
        preset(&app, &mut session, matching).await;
        let (_, _, body) = exchange(
            &app,
            &mut session,
            Request::builder().uri("/api/check?key=ExpressCheckout"),
            Body::empty(),
        )
        .await;
        let value: Decision = serde_json::from_slice(&body).unwrap();
        assert_eq!(value.enabled, matching);
    }
    let csrf = token(&app, &mut session).await;
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/submit")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from(format!("csrf={csrf}")),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = exchange(
        &app,
        &mut session,
        Request::builder()
            .method(Method::POST)
            .uri("/submit")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded"),
        Body::from("csrf=bad"),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn signed_tampering_transport_failure_refresh_and_shutdown() {
    context::register_order();
    let fixture = Fixture::start().unwrap();
    let client = TogglyClient::new(fixture.config(true)).await.unwrap();
    assert!(
        client
            .is_enabled("new-dashboard", EvalContext::default())
            .await
            .unwrap()
    );
    fixture.replace(Fixture::definitions(), true);
    assert!(
        client.refresh().await.is_err(),
        "tampered signed defs must be rejected"
    );
    assert_eq!(
        client.feature_keys().await.len(),
        FLAGS.len(),
        "last good definitions retained"
    );
    fixture.fail(true);
    assert!(client.refresh().await.is_err());
    assert!(client.last_error().await.is_some());
    assert!(
        TogglyClient::new(fixture.config(false)).await.is_err(),
        "startup transport failure must remain an error, not fixture success"
    );
    assert!(
        client
            .is_enabled("new-dashboard", EvalContext::default())
            .await
            .unwrap()
    );
    fixture.replace(Fixture::definitions(), false);
    client.refresh().await.unwrap();
    // Published 0.6.0 rejects a signed document whose timestamp is not newer.
    tokio::time::sleep(Duration::from_secs(1)).await;
    let mut changed = Fixture::definitions();
    changed[0]["filters"] = json!([{"name":"AlwaysOff", "parameters":{}}]);
    fixture.replace(changed, false);
    let mut changed_seen = false;
    for _ in 0..80 {
        if !client
            .is_enabled("new-dashboard", EvalContext::default())
            .await
            .unwrap()
        {
            changed_seen = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    assert!(
        changed_seen,
        "background poll must load signed changed definitions"
    );
    client.close().await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    let count = fixture.request_count();
    tokio::time::sleep(Duration::from_millis(2200)).await;
    assert_eq!(count, fixture.request_count(), "close must stop polling");
}

#[tokio::test]
async fn concurrent_same_identity_different_request_contexts() {
    let (app, fixture, core) = workshop().await;
    let runtime = tokio::runtime::Handle::current();
    std::thread::scope(|scope| {
        for worker in 0..8 {
            let runtime = &runtime;
            let core = &core;
            scope.spawn(move || {
                for iteration in 0..300 {
                    let matching = (iteration + worker) % 2 == 0;
                    let mut persona = Persona::preset(matching);
                    persona.identity = "alice".into();
                    for key in ["ExpressCheckout", "filter-user-claims", "filter-country"] {
                        assert_eq!(
                            runtime
                                .block_on(core.is_enabled(key, persona.evaluation()))
                                .unwrap(),
                            matching,
                            "worker {worker} iteration {iteration} {key}"
                        );
                    }
                }
            });
        }
    });
    assert_eq!(fixture.request_count(), 1);
    drop(app);
}
