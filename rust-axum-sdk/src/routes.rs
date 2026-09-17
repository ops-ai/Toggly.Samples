use crate::{
    AppState,
    catalog::FLAGS,
    context::{self, CookieJarHandle, WorkshopContext},
    views,
};
use axum::{
    Form, Json,
    extract::{Query, State},
    http::{HeaderValue, StatusCode, header},
    response::{Html, IntoResponse, Redirect},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use toggly::{EvalContext, TogglyClient};
use toggly_axum::{Feature, TogglyExtractor, TogglyState};

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

pub async fn home(context: WorkshopContext, State(state): State<AppState>) -> Html<String> {
    Html(views::page("home", &context, state.client.as_deref(), &state.mode).await)
}

async fn named_section(
    name: &'static str,
    context: WorkshopContext,
    state: AppState,
) -> Html<String> {
    Html(views::page(name, &context, state.client.as_deref(), &state.mode).await)
}

pub async fn section_declarative(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("declarative", context, state).await
}

pub async fn section_programmatic(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("programmatic", context, state).await
}

pub async fn section_identity(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("identity", context, state).await
}

pub async fn section_orders(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("orders", context, state).await
}

pub async fn section_filters(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("filters", context, state).await
}

pub async fn section_surfaces(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("surfaces", context, state).await
}

pub async fn section_setup(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Html<String> {
    named_section("setup", context, state).await
}

pub async fn style() -> impl IntoResponse {
    (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/css; charset=utf-8"),
        )],
        include_str!("../static/workshop.css"),
    )
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
    Form(form): Form<SessionForm>,
) -> Result<Redirect, StatusCode> {
    // Private token + POST + SameSite protects changes from cross-site forms.
    // Destination is an allowlisted section, so user input cannot create redirects.
    if form.csrf != context.csrf {
        return Err(StatusCode::FORBIDDEN);
    }
    if !views::SECTIONS
        .iter()
        .any(|(slug, _)| *slug == form.destination)
    {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let persona = match form.action.as_str() {
        "matching" => context::Persona::preset(true),
        "nonmatching" | "reset" => context::Persona::preset(false),
        "update" => {
            let mut persona = context.persona;
            if let Some(identity) = &form.identity {
                if identity.len() > 64 || identity.chars().any(char::is_control) {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.identity = identity.clone();
            }
            if let Some(role) = &form.role {
                if !["admin", "user"].contains(&role.as_str()) {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.role = role.clone();
            }
            if let Some(country) = &form.country {
                if !["US", "CA"].contains(&country.as_str()) {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.country = country.clone();
            }
            if let Some(language) = &form.language {
                if !["en-US,en;q=0.9", "fr-FR,fr;q=0.9"].contains(&language.as_str()) {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.language = language.clone();
            }
            if let Some(ua) = &form.user_agent {
                if ![context::MATCHING_UA, context::NONMATCHING_UA].contains(&ua.as_str()) {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.user_agent = ua.clone();
            }
            if let Some(order) = &form.order {
                if context::order(order).is_none() {
                    return Err(StatusCode::UNPROCESSABLE_ENTITY);
                }
                persona.order = order.clone();
            }
            persona
        }
        _ => return Err(StatusCode::UNPROCESSABLE_ENTITY),
    };
    cookies.save(&persona);
    Ok(Redirect::to(&format!("/{}", form.destination)))
}

pub async fn snapshot(context: WorkshopContext, State(state): State<AppState>) -> Json<Value> {
    let mut decisions = Vec::new();
    for key in FLAGS {
        decisions.push(decision(state.client.as_deref(), key, &context.evaluation).await);
    }
    Json(json!({
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
    Query(query): Query<CheckQuery>,
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Result<Json<Decision>, StatusCode> {
    if query.key.len() > 100 {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    // An empty key deliberately demonstrates a native configuration error;
    // an unknown non-empty key demonstrates the native false default.
    Ok(Json(
        decision(state.client.as_deref(), &query.key, &context.evaluation).await,
    ))
}

pub async fn native(feature: Feature) -> Json<Value> {
    let identity = feature.context().identity.clone();
    let enabled = feature.is_enabled("beta-access").await;
    Json(json!({
        "identity": identity,
        "enabled": enabled,
        "boundary": "Native untrusted X-User-Id then X-Identity; no workshop cookie, claims or Order mapping."
    }))
}

pub async fn extractor(toggly: TogglyExtractor) -> Json<Value> {
    let enabled = toggly
        .is_enabled("beta-access", EvalContext::default())
        .await
        .unwrap_or(false);
    Json(json!({
        "enabled": enabled,
        "boundary": "TogglyExtractor unwraps Extension<Arc<TogglyClient>> and evaluates with the caller-supplied context."
    }))
}

pub async fn layer_ok() -> Html<&'static str> {
    Html(
        r##"<h1>Layer route enabled</h1>
<p>TogglyLayer::require evaluated beta-access with header identity only.</p>
<a href="/surfaces">Return to package surfaces</a>"##,
    )
}

pub async fn state_demo(State(toggly): State<TogglyState>) -> Json<Value> {
    Json(json!({
        "enabled": toggly.is_enabled("beta-access").await,
        "boundary": "TogglyState::is_enabled uses EvalContext::default(); no workshop cookie, claims or Order."
    }))
}

pub async fn state_missing() -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}

pub async fn beta(
    context: WorkshopContext,
    State(state): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    // This denial is sample route composition using the native core evaluator.
    // FeatureEnabled is a data struct in 0.6.0, not a FromRequestParts extractor.
    let result = decision(state.client.as_deref(), "beta-access", &context.evaluation).await;
    if result.error {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if !result.enabled {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Html(
        r##"<h1>Beta route enabled</h1>
<p>The full request context was resolved before evaluation.</p>
<a href="/surfaces">Return to package surfaces</a>"##
            .into(),
    ))
}

#[derive(Deserialize)]
pub struct SubmitForm {
    pub csrf: String,
}

pub async fn submit(
    context: WorkshopContext,
    State(state): State<AppState>,
    Form(form): Form<SubmitForm>,
) -> Result<Html<String>, StatusCode> {
    if form.csrf != context.csrf {
        return Err(StatusCode::FORBIDDEN);
    }
    // Re-evaluate on the server; hiding a button alone cannot protect an action.
    let result = decision(
        state.client.as_deref(),
        "enhanced-submit",
        &context.evaluation,
    )
    .await;
    if result.error {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if !result.enabled {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(Html(
        r##"<h1>Enhanced submit allowed</h1>
<p>Demonstration only; no order or database was changed.</p>
<a href="/programmatic">Return to programmatic API</a>"##
            .into(),
    ))
}
