use crate::{
    AppState,
    catalog::FLAGS,
    context::{self, CookieJarHandle, WorkshopContext},
    views,
};
use actix_web::{
    FromRequest, HttpRequest, HttpResponse,
    dev::Payload,
    http::{StatusCode, header},
    web,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use toggly::{EvalContext, TogglyClient};
use toggly_actix::{Feature, TogglyData};

#[derive(Serialize, Deserialize)]
pub struct Decision {
    pub key: String,
    pub enabled: bool,
    pub error: bool,
}

/// One native call produces each boolean/error pair. This is not an SDK reason
/// API or an atomic all-flags snapshot; polling can occur between separate calls.
pub async fn decision(client: Option<&TogglyClient>, key: &str, context: &EvalContext) -> Decision {
    let result = match client {
        Some(client) => client.is_enabled(key, context.clone()).await,
        None => Err(toggly::Error::Config("unavailable".into())),
    };
    Decision {
        key: key.into(),
        enabled: result.as_ref().copied().unwrap_or(false),
        error: result.is_err(),
    }
}

fn html(body: String) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/html; charset=utf-8"))
        .body(body)
}

fn client_ref(state: &AppState) -> Option<&TogglyClient> {
    state.client.as_ref().map(|data| data.get_ref())
}

pub async fn home(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    html(views::page("home", &context, client_ref(&state), &state.mode).await)
}

async fn named_section(
    name: &'static str,
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    html(views::page(name, &context, client_ref(&state), &state.mode).await)
}

pub async fn section_declarative(
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    named_section("declarative", context, state).await
}

pub async fn section_programmatic(
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    named_section("programmatic", context, state).await
}

pub async fn section_identity(
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    named_section("identity", context, state).await
}

pub async fn section_orders(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    named_section("orders", context, state).await
}

pub async fn section_filters(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    named_section("filters", context, state).await
}

pub async fn section_surfaces(
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    named_section("surfaces", context, state).await
}

pub async fn section_setup(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    named_section("setup", context, state).await
}

pub async fn style() -> HttpResponse {
    HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "text/css; charset=utf-8"))
        .body(include_str!("../static/workshop.css"))
}

#[derive(Deserialize)]
pub struct SessionForm {
    csrf: String,
    action: String,
    identity: Option<String>,
    role: Option<String>,
    country: Option<String>,
    language: Option<String>,
    user_agent: Option<String>,
    order: Option<String>,
    destination: String,
}

pub async fn session(
    context: WorkshopContext,
    cookies: CookieJarHandle,
    form: web::Form<SessionForm>,
) -> Result<HttpResponse, actix_web::Error> {
    // Private token + POST + SameSite protects changes from cross-site forms.
    // Destination is an allowlisted section, so user input cannot create redirects.
    let form = form.into_inner();
    if form.csrf != context.csrf {
        return Ok(HttpResponse::Forbidden().finish());
    }
    if !views::SECTIONS
        .iter()
        .any(|(slug, _)| *slug == form.destination)
    {
        return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
    }
    let persona = match form.action.as_str() {
        "matching" => context::Persona::preset(true),
        "nonmatching" | "reset" => context::Persona::preset(false),
        "update" => {
            let mut persona = context.persona;
            if let Some(identity) = &form.identity {
                if identity.len() > 64 || identity.chars().any(char::is_control) {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.identity = identity.clone();
            }
            if let Some(role) = &form.role {
                if !["admin", "user"].contains(&role.as_str()) {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.role = role.clone();
            }
            if let Some(country) = &form.country {
                if !["US", "CA"].contains(&country.as_str()) {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.country = country.clone();
            }
            if let Some(language) = &form.language {
                if !["en-US,en;q=0.9", "fr-FR,fr;q=0.9"].contains(&language.as_str()) {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.language = language.clone();
            }
            if let Some(ua) = &form.user_agent {
                if ![context::MATCHING_UA, context::NONMATCHING_UA].contains(&ua.as_str()) {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.user_agent = ua.clone();
            }
            if let Some(order) = &form.order {
                if context::order(order).is_none() {
                    return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish());
                }
                persona.order = order.clone();
            }
            persona
        }
        _ => return Ok(HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish()),
    };
    cookies.save(&persona);
    Ok(HttpResponse::SeeOther()
        .insert_header((header::LOCATION, format!("/{}", form.destination)))
        .finish())
}

pub async fn snapshot(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    let mut decisions = Vec::new();
    for key in FLAGS {
        decisions.push(decision(client_ref(&state), key, &context.evaluation).await);
    }
    HttpResponse::Ok().json(json!({
        "offline": state.mode.offline,
        "persona": context.persona,
        "decisions": decisions,
        "snapshotSemantics": "Separate native checks; not an atomic all-flags revision."
    }))
}

#[derive(Deserialize)]
pub struct CheckQuery {
    #[serde(default)]
    key: String,
}

pub async fn api(
    query: web::Query<CheckQuery>,
    context: WorkshopContext,
    state: web::Data<AppState>,
) -> HttpResponse {
    if query.key.len() > 100 {
        return HttpResponse::build(StatusCode::UNPROCESSABLE_ENTITY).finish();
    }
    // An empty key deliberately demonstrates a native configuration error;
    // an unknown non-empty key demonstrates the native false default.
    HttpResponse::Ok().json(decision(client_ref(&state), &query.key, &context.evaluation).await)
}

/// Published Feature/TogglyData panic if `web::Data<TogglyClient>` is missing.
/// Guard first so a missing-key workshop still renders a 500 instead of crashing.
async fn native_feature(req: &HttpRequest) -> Option<Feature> {
    req.app_data::<web::Data<TogglyClient>>()?;
    let mut payload = Payload::None;
    Feature::from_request(req, &mut payload).await.ok()
}

pub async fn native(req: HttpRequest) -> HttpResponse {
    let Some(feature) = native_feature(&req).await else {
        return HttpResponse::InternalServerError().finish();
    };
    let identity = feature.context().identity.clone();
    let enabled = feature.is_enabled("beta-access").await;
    HttpResponse::Ok().json(json!({
        "identity": identity,
        "enabled": enabled,
        "boundary": "Native untrusted X-User-Id then X-Identity; no workshop cookie, claims or Order mapping."
    }))
}

pub async fn extractor(req: HttpRequest) -> HttpResponse {
    if req.app_data::<web::Data<TogglyClient>>().is_none() {
        return HttpResponse::InternalServerError().finish();
    }
    let mut payload = Payload::None;
    let Ok(toggly) = TogglyData::from_request(&req, &mut payload).await else {
        return HttpResponse::InternalServerError().finish();
    };
    // TogglyData evaluates with the caller-supplied context. Default here matches
    // the published extractor example; workshop cookies are not applied.
    let enabled = toggly
        .is_enabled("beta-access", EvalContext::default())
        .await
        .unwrap_or(false);
    HttpResponse::Ok().json(json!({
        "enabled": enabled,
        "boundary": "TogglyData unwraps web::Data<TogglyClient> and evaluates with the caller-supplied context."
    }))
}

pub async fn layer_ok() -> HttpResponse {
    html(
        r##"<h1>Layer route enabled</h1>
<p>TogglyMiddleware::with_feature evaluated beta-access with the configured X-User-Id header only.</p>
<a href="/surfaces">Return to package surfaces</a>"##
            .into(),
    )
}

pub async fn guard_ok() -> HttpResponse {
    html(
        r##"<h1>Guard route matched</h1>
<p>FeatureGuard used is_defined_sync. A defined flag still matches when its condition is false.</p>
<a href="/surfaces">Return to package surfaces</a>"##
            .into(),
    )
}

pub async fn state_demo(req: HttpRequest) -> HttpResponse {
    let Some(client) = req.app_data::<web::Data<TogglyClient>>() else {
        return HttpResponse::InternalServerError().finish();
    };
    let enabled = client
        .is_enabled("beta-access", EvalContext::default())
        .await
        .unwrap_or(false);
    HttpResponse::Ok().json(json!({
        "enabled": enabled,
        "boundary": "web::Data<TogglyClient> is the published Actix app-data surface; this check uses EvalContext::default()."
    }))
}

pub async fn beta(context: WorkshopContext, state: web::Data<AppState>) -> HttpResponse {
    // This denial is sample route composition using the native core evaluator.
    // FeatureEnabled is a data struct in 0.6.1, not a FromRequest extractor.
    let result = decision(client_ref(&state), "beta-access", &context.evaluation).await;
    if result.error {
        return HttpResponse::ServiceUnavailable().finish();
    }
    if !result.enabled {
        return HttpResponse::NotFound().finish();
    }
    html(
        r##"<h1>Beta route enabled</h1>
<p>The full request context was resolved before evaluation.</p>
<a href="/surfaces">Return to package surfaces</a>"##
            .into(),
    )
}

#[derive(Deserialize)]
pub struct SubmitForm {
    pub csrf: String,
}

pub async fn submit(
    context: WorkshopContext,
    state: web::Data<AppState>,
    form: web::Form<SubmitForm>,
) -> HttpResponse {
    if form.csrf != context.csrf {
        return HttpResponse::Forbidden().finish();
    }
    // Re-evaluate on the server; hiding a button alone cannot protect an action.
    let result = decision(client_ref(&state), "enhanced-submit", &context.evaluation).await;
    if result.error {
        return HttpResponse::ServiceUnavailable().finish();
    }
    if !result.enabled {
        return HttpResponse::Forbidden().finish();
    }
    html(
        r##"<h1>Enhanced submit allowed</h1>
<p>Demonstration only; no order or database was changed.</p>
<a href="/programmatic">Return to programmatic API</a>"##
            .into(),
    )
}
