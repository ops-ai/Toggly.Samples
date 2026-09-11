//! Integration tests use published crates and a signed HTTP transport fixture.
//! No mocked evaluator, SDK source patch, production key or database is involved.
use rocket::{
    http::{ContentType, Header, Status},
    local::asynchronous::Client,
};
use rust_rocket_sdk_sample::{
    Mode, application,
    catalog::{FILTERS, FLAGS},
    context::{self, Persona},
    fixture::Fixture,
    routes::Decision,
};
use serde_json::{Value, json};
use std::time::Duration;
use toggly::{EvalContext, Requirement, TogglyClient};

async fn workshop() -> (Client, Fixture) {
    context::register_order();
    let fixture = Fixture::start().unwrap();
    let client = TogglyClient::new(fixture.config(false)).await.unwrap();
    let app = Client::tracked(application(
        Some(client),
        Mode {
            offline: true,
            startup_failed: false,
        },
    ))
    .await
    .unwrap();
    (app, fixture)
}

async fn token(app: &Client) -> String {
    let html = app
        .get("/identity")
        .dispatch()
        .await
        .into_string()
        .await
        .unwrap();
    html.split("name=\"csrf\" value=\"")
        .nth(1)
        .unwrap()
        .split('"')
        .next()
        .unwrap()
        .into()
}

async fn preset(app: &Client, matching: bool) {
    let csrf = token(app).await;
    let result = app
        .post("/session")
        .header(ContentType::Form)
        .body(format!(
            "csrf={csrf}&destination=filters&action={}",
            if matching { "matching" } else { "nonmatching" }
        ))
        .dispatch()
        .await;
    assert_eq!(result.status(), Status::SeeOther);
}

#[rocket::async_test]
async fn full_matrix_initial_context_unknown_error_and_order() {
    let (app, fixture) = workshop().await;
    let core = app.rocket().state::<TogglyClient>().unwrap();
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
    app.terminate().await;
}

#[rocket::async_test]
async fn gates_native_guard_fairing_and_missing_state() {
    let (app, fixture) = workshop().await;
    let core = app.rocket().state::<TogglyClient>().unwrap();
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
    let native = app
        .get("/native")
        .header(Header::new("X-User-Id", "alice"))
        .header(Header::new("X-Identity", "bob"))
        .dispatch()
        .await
        .into_json::<Value>()
        .await
        .unwrap();
    assert_eq!(native["identity"], "alice");
    assert_eq!(native["enabled"], true);
    assert_eq!(
        app.get("/native")
            .dispatch()
            .await
            .into_json::<Value>()
            .await
            .unwrap()["identity"],
        Value::Null
    );
    assert_eq!(
        app.get("/native")
            .header(Header::new("X-Identity", "bob"))
            .dispatch()
            .await
            .into_json::<Value>()
            .await
            .unwrap()["identity"],
        "bob"
    );
    assert_eq!(app.get("/beta").dispatch().await.status(), Status::Ok);
    // Disabled and denied paths are real native checks after a signed refresh.
    let mut definitions = Fixture::definitions();
    for definition in definitions.as_array_mut().unwrap() {
        if ["beta-access", "enhanced-submit"].contains(&definition["featureKey"].as_str().unwrap())
        {
            definition["filters"] = json!([{"name":"AlwaysOff", "parameters":{}}]);
        }
    }
    fixture.replace(definitions, false);
    core.refresh().await.unwrap();
    assert_eq!(app.get("/beta").dispatch().await.status(), Status::NotFound);
    let csrf = token(&app).await;
    assert_eq!(
        app.post("/submit")
            .header(ContentType::Form)
            .body(format!("csrf={csrf}"))
            .dispatch()
            .await
            .status(),
        Status::Forbidden
    );
    app.terminate().await;

    // The native adapter fairing is exercised separately with a placeholder only.
    let fairing_app = rocket::build()
        .attach(toggly_rocket::TogglyFairing::from_config(
            fixture.config(false),
        ))
        .mount("/", rocket::routes![rust_rocket_sdk_sample::routes::native]);
    let native_app = Client::tracked(fairing_app).await.unwrap();
    assert_eq!(
        native_app.get("/native").dispatch().await.status(),
        Status::Ok
    );
    native_app
        .rocket()
        .state::<TogglyClient>()
        .unwrap()
        .close()
        .await;
    native_app.terminate().await;
    let missing = Client::tracked(application(
        None,
        Mode {
            offline: false,
            startup_failed: true,
        },
    ))
    .await
    .unwrap();
    assert_eq!(
        missing.get("/native").dispatch().await.status(),
        Status::InternalServerError
    );
    assert_eq!(
        missing.get("/beta").dispatch().await.status(),
        Status::ServiceUnavailable
    );
    assert!(
        missing
            .get("/")
            .dispatch()
            .await
            .into_string()
            .await
            .unwrap()
            .contains("SDK startup failed")
    );
    missing.terminate().await;
}

#[rocket::async_test]
async fn sessions_csrf_validation_escape_and_pages() {
    let (app, _) = workshop().await;
    for (slug, _) in rust_rocket_sdk_sample::views::SECTIONS {
        let response = app.get(format!("/{slug}")).dispatch().await;
        assert_eq!(response.status(), Status::Ok, "{slug}");
        assert_eq!(
            response.headers().get_one("Cache-Control"),
            Some("no-store")
        );
        assert!(
            response
                .into_string()
                .await
                .unwrap()
                .contains("Missing app key")
        );
    }
    assert_eq!(
        app.post("/session")
            .header(ContentType::Form)
            .body("csrf=wrong&action=matching&destination=home")
            .dispatch()
            .await
            .status(),
        Status::Forbidden
    );
    let csrf = token(&app).await;
    assert_eq!(
        app.post("/session")
            .header(ContentType::Form)
            .body(format!(
                "csrf={csrf}&action=update&destination=home&order=invalid"
            ))
            .dispatch()
            .await
            .status(),
        Status::UnprocessableEntity
    );
    assert_eq!(
        app.post("/session")
            .header(ContentType::Form)
            .body(format!(
                "csrf={csrf}&action=matching&destination=https://bad.example"
            ))
            .dispatch()
            .await
            .status(),
        Status::UnprocessableEntity
    );
    assert_eq!(
        app.post("/session")
            .header(ContentType::Form)
            .body(format!(
                "csrf={csrf}&action=update&destination=identity&identity=%3Cscript%3E"
            ))
            .dispatch()
            .await
            .status(),
        Status::SeeOther
    );
    let html = app
        .get("/identity")
        .dispatch()
        .await
        .into_string()
        .await
        .unwrap();
    assert!(!html.contains("<script>"));
    assert!(html.contains("&lt;script&gt;"));
    for matching in [true, false, true] {
        preset(&app, matching).await;
        let value = app
            .get("/api/check?key=ExpressCheckout")
            .dispatch()
            .await
            .into_json::<Decision>()
            .await
            .unwrap();
        assert_eq!(value.enabled, matching);
    }
    assert_eq!(
        app.post("/submit")
            .header(ContentType::Form)
            .body(format!("csrf={csrf}"))
            .dispatch()
            .await
            .status(),
        Status::Ok
    );
    assert_eq!(
        app.post("/submit")
            .header(ContentType::Form)
            .body("csrf=bad")
            .dispatch()
            .await
            .status(),
        Status::Forbidden
    );
    app.terminate().await;
}

#[rocket::async_test]
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
    let mut changed = Fixture::definitions();
    changed[0]["filters"] = json!([{"name":"AlwaysOff", "parameters":{}}]);
    fixture.replace(changed, false);
    // Wait for actual background polling instead of calling refresh here.
    let mut changed_seen = false;
    for _ in 0..60 {
        if !client
            .is_enabled("new-dashboard", EvalContext::default())
            .await
            .unwrap()
        {
            changed_seen = true;
            break;
        }
        rocket::tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(
        changed_seen,
        "background poll must load signed changed definitions"
    );
    client.close().await;
    rocket::tokio::time::sleep(Duration::from_millis(100)).await;
    let count = fixture.request_count();
    rocket::tokio::time::sleep(Duration::from_millis(2200)).await;
    assert_eq!(count, fixture.request_count(), "close must stop polling");
}

#[rocket::async_test]
async fn concurrent_same_identity_different_request_contexts() {
    let (app, fixture) = workshop().await;
    let core = app.rocket().state::<TogglyClient>().unwrap();
    let runtime = rocket::tokio::runtime::Handle::current();
    std::thread::scope(|scope| {
        for worker in 0..8 {
            let runtime = &runtime;
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
    app.terminate().await;
}
