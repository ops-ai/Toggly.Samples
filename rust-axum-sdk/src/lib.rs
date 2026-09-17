pub mod catalog;
pub mod context;
pub mod fixture;
pub mod routes;
pub mod views;

use crate::context::{CookieJarHandle, WorkshopContext};
use axum::{
    Extension, Router,
    extract::State,
    http::{
        HeaderValue, Request,
        header::{
            CACHE_CONTROL, CONTENT_SECURITY_POLICY, COOKIE, SET_COOKIE, X_CONTENT_TYPE_OPTIONS,
        },
    },
    middleware::{Next, from_fn_with_state},
    response::Response,
    routing::{get, post},
};
use cookie::Key;
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use toggly::{TogglyClient, TogglyConfig};
use toggly_axum::{TogglyLayer, TogglyState};

#[derive(Clone)]
pub struct Mode {
    pub offline: bool,
    pub startup_failed: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub mode: Arc<Mode>,
    pub client: Option<Arc<TogglyClient>>,
    pub cookie_key: Key,
}

/// Configuration is process-scoped. A real-key transport error never silently
/// switches to demo flags; an unavailable client leaves the workshop visible.
pub async fn start()
-> Result<(Router, Option<fixture::Fixture>, Option<Arc<TogglyClient>>), std::io::Error> {
    context::register_order();
    let key = std::env::var("TOGGLY_APP_KEY").unwrap_or_default();
    let offline = is_placeholder(&key);
    let fixture = if offline {
        Some(fixture::Fixture::start()?)
    } else {
        None
    };
    let config = if let Some(fixture) = &fixture {
        fixture.config(true)
    } else {
        TogglyConfig::builder()
            .app_key(key.trim())
            .environment(
                std::env::var("TOGGLY_ENVIRONMENT").unwrap_or_else(|_| "Production".into()),
            )
            .cache_ttl(Duration::ZERO)
            .refresh_interval(Duration::from_secs(30))
            .http_timeout(Duration::from_secs(5))
            .use_signed_definitions(true)
            .build()
    };
    // Do not print SDK errors/configuration: transport messages can contain the key.
    let client = TogglyClient::new(config).await.ok().map(Arc::new);
    let failed = client.is_none();
    Ok((
        application(
            client.clone(),
            Mode {
                offline,
                startup_failed: failed,
            },
        ),
        fixture,
        client,
    ))
}

pub fn is_placeholder(key: &str) -> bool {
    let key = key.trim();
    key.is_empty() || matches!(key, "placeholder" | "YOUR_APP_KEY" | "your-app-key")
}

pub fn cookie_key() -> Key {
    if let Ok(value) = std::env::var("SAMPLE_COOKIE_KEY") {
        let trimmed = value.trim();
        if trimmed.len() >= 64
            && let Ok(bytes) = decode_cookie_material(trimmed)
        {
            return Key::from(&bytes);
        }
    }
    Key::generate()
}

fn decode_cookie_material(value: &str) -> Result<Vec<u8>, ()> {
    if value.chars().all(|ch| ch.is_ascii_hexdigit()) && value.len().is_multiple_of(2) {
        let mut bytes = Vec::with_capacity(value.len() / 2);
        for pair in value.as_bytes().chunks(2) {
            let text = std::str::from_utf8(pair).map_err(|_| ())?;
            bytes.push(u8::from_str_radix(text, 16).map_err(|_| ())?);
        }
        return Ok(bytes);
    }
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, value).map_err(|_| ())
}

pub fn application(client: Option<Arc<TogglyClient>>, mode: Mode) -> Router {
    application_with_key(client, mode, cookie_key())
}

pub fn application_with_key(
    client: Option<Arc<TogglyClient>>,
    mode: Mode,
    cookie_key: Key,
) -> Router {
    let state = AppState {
        mode: Arc::new(mode),
        client: client.clone(),
        cookie_key,
    };
    // Native Feature / TogglyLayer look up Extension<Arc<TogglyClient>>, not Axum
    // State. The workshop keeps its own AppState so a missing client can still
    // render the configuration banner instead of aborting the process.
    let workshop = Router::new()
        .route("/", get(routes::home))
        .route("/static/workshop.css", get(routes::style))
        .route("/session", post(routes::session))
        .route("/api/snapshot", get(routes::snapshot))
        .route("/api/check", get(routes::api))
        .route("/native", get(routes::native))
        .route("/extractor", get(routes::extractor))
        .route("/beta", get(routes::beta))
        .route("/submit", post(routes::submit))
        .route("/home", get(routes::home))
        .route("/declarative", get(routes::section_declarative))
        .route("/programmatic", get(routes::section_programmatic))
        .route("/identity", get(routes::section_identity))
        .route("/orders", get(routes::section_orders))
        .route("/filters", get(routes::section_filters))
        .route("/surfaces", get(routes::section_surfaces))
        .route("/setup", get(routes::section_setup))
        .layer(from_fn_with_state(state.clone(), attach_workshop_context))
        .with_state(state);

    // Apply Extension immediately around TogglyLayer, matching the published
    // crate example. Router merge/with_state can otherwise place the layer
    // outside the extension and the adapter fail-opens.
    let layer_router = Router::new()
        .route("/layer", get(routes::layer_ok))
        .layer(TogglyLayer::require("beta-access"));
    let layer_router = if let Some(client) = &client {
        layer_router.layer(Extension(client.clone()))
    } else {
        layer_router
    };

    let state_router = if let Some(client) = &client {
        Router::new()
            .route("/state", get(routes::state_demo))
            .with_state(TogglyState::from_arc(client.clone()))
    } else {
        Router::new().route("/state", get(routes::state_missing))
    };

    let mut app = workshop.merge(layer_router).merge(state_router);
    if let Some(client) = client {
        app = app.layer(Extension(client));
    }
    app
}

async fn attach_workshop_context(
    State(state): State<AppState>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let header = request
        .headers()
        .get(COOKIE)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let mut jar = context::load_jar(header.as_deref(), &state.cookie_key);
    let csrf = context::csrf_from_jar(&mut jar, &state.cookie_key);
    let persona = context::persona_from_jar(&jar, &state.cookie_key);
    let evaluation = persona.evaluation();
    let handle = CookieJarHandle {
        jar: Arc::new(Mutex::new(jar)),
        key: state.cookie_key.clone(),
    };
    request.extensions_mut().insert(WorkshopContext {
        persona,
        evaluation,
        csrf,
    });
    request.extensions_mut().insert(handle.clone());
    // Native Feature / TogglyLayer look up this exact type. Insert it here so a
    // route-level TogglyLayer still sees the client after router merge.
    if let Some(client) = &state.client {
        request.extensions_mut().insert(client.clone());
    }
    let mut response = next.run(request).await;
    append_security_headers(&mut response);
    if let Ok(jar) = handle.jar.lock() {
        for cookie in jar.delta() {
            if let Ok(value) = HeaderValue::from_str(&cookie.encoded().to_string()) {
                response.headers_mut().append(SET_COOKIE, value);
            }
        }
    }
    response
}

fn append_security_headers(response: &mut Response) {
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'",
        ),
    );
}
