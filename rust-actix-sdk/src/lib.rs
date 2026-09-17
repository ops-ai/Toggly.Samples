pub mod catalog;
pub mod context;
pub mod fixture;
pub mod routes;
pub mod views;

use crate::context::{CookieJarHandle, WorkshopContext};
use actix_web::{
    App, Error, HttpMessage,
    body::MessageBody,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
    http::header::{
        CACHE_CONTROL, CONTENT_SECURITY_POLICY, COOKIE, SET_COOKIE, X_CONTENT_TYPE_OPTIONS,
    },
    web,
};
use cookie::Key;
use futures_util::future::LocalBoxFuture;
use std::{
    future::{Ready, ready},
    rc::Rc,
    sync::{Arc, Mutex},
    time::Duration,
};
use toggly::{TogglyClient, TogglyConfig};
use toggly_actix::{FeatureGuard, TogglyMiddleware};

#[derive(Clone)]
pub struct Mode {
    pub offline: bool,
    pub startup_failed: bool,
}

/// Workshop state is cloned into each Actix worker. Native extractors look up
/// `web::Data<TogglyClient>` — not `Data<Arc<TogglyClient>>`. The client itself
/// is not Clone in published 0.6.1; clone this Data handle instead.
#[derive(Clone)]
pub struct AppState {
    pub mode: Arc<Mode>,
    pub client: Option<web::Data<TogglyClient>>,
    pub cookie_key: Key,
}

/// Configuration is process-scoped. A real-key transport error never silently
/// switches to demo flags; an unavailable client leaves the workshop visible.
pub async fn start() -> Result<
    (
        AppState,
        Option<fixture::Fixture>,
        Option<web::Data<TogglyClient>>,
    ),
    std::io::Error,
> {
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
    let client = TogglyClient::new(config).await.ok().map(web::Data::new);
    let failed = client.is_none();
    Ok((
        AppState {
            mode: Arc::new(Mode {
                offline,
                startup_failed: failed,
            }),
            client: client.clone(),
            cookie_key: cookie_key(),
        },
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

pub fn application(
    state: AppState,
) -> App<
    impl actix_web::dev::ServiceFactory<
        ServiceRequest,
        Config = (),
        Response = ServiceResponse<impl MessageBody>,
        Error = Error,
        InitError = (),
    >,
> {
    application_with_key(
        state.client.clone(),
        (*state.mode).clone(),
        state.cookie_key,
    )
}

pub fn application_with_key(
    client: Option<web::Data<TogglyClient>>,
    mode: Mode,
    cookie_key: Key,
) -> App<
    impl actix_web::dev::ServiceFactory<
        ServiceRequest,
        Config = (),
        Response = ServiceResponse<impl MessageBody>,
        Error = Error,
        InitError = (),
    >,
> {
    let state = AppState {
        mode: Arc::new(mode),
        client: client.clone(),
        cookie_key,
    };
    // Native Feature / TogglyMiddleware / TogglyData / FeatureGuard look up
    // web::Data<TogglyClient>. Workshop AppState stays separate so a missing
    // client can still render the configuration banner instead of aborting.
    let mut app = App::new()
        .app_data(web::Data::new(state))
        .wrap(SecurityHeaders)
        .wrap(WorkshopContextMiddleware)
        .route("/", web::get().to(routes::home))
        .route("/static/workshop.css", web::get().to(routes::style))
        .route("/session", web::post().to(routes::session))
        .route("/api/snapshot", web::get().to(routes::snapshot))
        .route("/api/check", web::get().to(routes::api))
        .route("/native", web::get().to(routes::native))
        .route("/extractor", web::get().to(routes::extractor))
        .route("/state", web::get().to(routes::state_demo))
        .route("/beta", web::get().to(routes::beta))
        .route("/submit", web::post().to(routes::submit))
        .route("/home", web::get().to(routes::home))
        .route("/declarative", web::get().to(routes::section_declarative))
        .route("/programmatic", web::get().to(routes::section_programmatic))
        .route("/identity", web::get().to(routes::section_identity))
        .route("/orders", web::get().to(routes::section_orders))
        .route("/filters", web::get().to(routes::section_filters))
        .route("/surfaces", web::get().to(routes::section_surfaces))
        .route("/setup", web::get().to(routes::section_setup))
        .service(
            web::resource("/layer")
                .wrap(TogglyMiddleware::with_feature("beta-access").identity_header("X-User-Id"))
                .route(web::get().to(routes::layer_ok)),
        )
        .service(
            web::resource("/guard")
                .guard(FeatureGuard::new("beta-access"))
                .route(web::get().to(routes::guard_ok)),
        );
    if let Some(client) = client {
        app = app.app_data(client);
    }
    app
}

struct WorkshopContextMiddleware;

impl<S, B> Transform<S, ServiceRequest> for WorkshopContextMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = WorkshopContextMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(WorkshopContextMiddlewareService {
            service: Rc::new(service),
        }))
    }
}

struct WorkshopContextMiddlewareService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for WorkshopContextMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        Box::pin(async move {
            let state = req
                .app_data::<web::Data<AppState>>()
                .cloned()
                .expect("workshop AppState");
            let header = req
                .headers()
                .get(COOKIE)
                .and_then(|value| value.to_str().ok())
                .map(ToOwned::to_owned);
            let mut jar = context::load_jar(header.as_deref(), &state.cookie_key);
            let csrf = context::csrf_from_jar(&mut jar, &state.cookie_key);
            let persona = context::persona_from_jar(&jar, &state.cookie_key);
            // Resolve the complete request EvalContext before any handler check.
            // This never writes identity into the shared TogglyClient.
            let evaluation = persona.evaluation();
            let handle = CookieJarHandle {
                jar: Arc::new(Mutex::new(jar)),
                key: state.cookie_key.clone(),
            };
            req.extensions_mut().insert(WorkshopContext {
                persona,
                evaluation,
                csrf,
            });
            req.extensions_mut().insert(handle.clone());
            let mut response = service.call(req).await?;
            if let Ok(jar) = handle.jar.lock() {
                for cookie in jar.delta() {
                    if let Ok(value) = actix_web::http::header::HeaderValue::from_str(
                        &cookie.encoded().to_string(),
                    ) {
                        response.headers_mut().append(SET_COOKIE, value);
                    }
                }
            }
            Ok(response)
        })
    }
}

struct SecurityHeaders;

impl<S, B> Transform<S, ServiceRequest> for SecurityHeaders
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = SecurityHeadersService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SecurityHeadersService {
            service: Rc::new(service),
        }))
    }
}

struct SecurityHeadersService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for SecurityHeadersService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        Box::pin(async move {
            let mut response = service.call(req).await?;
            let headers = response.headers_mut();
            headers.insert(
                CACHE_CONTROL,
                actix_web::http::header::HeaderValue::from_static("no-store"),
            );
            headers.insert(
                X_CONTENT_TYPE_OPTIONS,
                actix_web::http::header::HeaderValue::from_static("nosniff"),
            );
            headers.insert(
                CONTENT_SECURITY_POLICY,
                actix_web::http::header::HeaderValue::from_static(
                    "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'",
                ),
            );
            Ok(response)
        })
    }
}
