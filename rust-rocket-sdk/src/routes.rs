use crate::{
    Mode,
    catalog::FLAGS,
    context::{self, OptionalClient, WorkshopContext},
    views,
};
use rocket::{
    State,
    form::Form,
    http::{CookieJar, Status},
    response::{
        Redirect,
        content::{RawCss, RawHtml},
    },
    serde::json::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use toggly::{EvalContext, TogglyClient};

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

#[rocket::get("/")]
pub async fn home(
    context: WorkshopContext,
    client: OptionalClient<'_>,
    mode: &State<Mode>,
) -> RawHtml<String> {
    RawHtml(views::page("home", &context, client.0, mode).await)
}

#[rocket::get("/<name>", rank = 10)]
pub async fn section(
    name: &str,
    context: WorkshopContext,
    client: OptionalClient<'_>,
    mode: &State<Mode>,
) -> Result<RawHtml<String>, Status> {
    if !views::SECTIONS.iter().any(|(slug, _)| *slug == name) {
        return Err(Status::NotFound);
    }
    Ok(RawHtml(views::page(name, &context, client.0, mode).await))
}

#[rocket::get("/static/workshop.css")]
pub fn style() -> RawCss<&'static str> {
    RawCss(include_str!("../static/workshop.css"))
}

#[derive(rocket::FromForm)]
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

#[rocket::post("/session", data = "<form>")]
pub fn session(
    form: Form<SessionForm>,
    current: WorkshopContext,
    cookies: &CookieJar<'_>,
) -> Result<Redirect, Status> {
    // Private token + POST + SameSite protects changes from cross-site forms.
    // Destination is an allowlisted section, so user input cannot create redirects.
    if form.csrf != current.csrf {
        return Err(Status::Forbidden);
    }
    if !views::SECTIONS
        .iter()
        .any(|(slug, _)| *slug == form.destination)
    {
        return Err(Status::UnprocessableEntity);
    }
    let persona = match form.action.as_str() {
        "matching" => context::Persona::preset(true),
        "nonmatching" | "reset" => context::Persona::preset(false),
        "update" => {
            let mut persona = current.persona;
            if let Some(identity) = &form.identity {
                if identity.len() > 64 || identity.chars().any(char::is_control) {
                    return Err(Status::UnprocessableEntity);
                }
                persona.identity = identity.clone();
            }
            if let Some(role) = &form.role {
                if !["admin", "user"].contains(&role.as_str()) {
                    return Err(Status::UnprocessableEntity);
                }
                persona.role = role.clone();
            }
            if let Some(country) = &form.country {
                if !["US", "CA"].contains(&country.as_str()) {
                    return Err(Status::UnprocessableEntity);
                }
                persona.country = country.clone();
            }
            if let Some(language) = &form.language {
                if !["en-US,en;q=0.9", "fr-FR,fr;q=0.9"].contains(&language.as_str()) {
                    return Err(Status::UnprocessableEntity);
                }
                persona.language = language.clone();
            }
            if let Some(ua) = &form.user_agent {
                if ![context::MATCHING_UA, context::NONMATCHING_UA].contains(&ua.as_str()) {
                    return Err(Status::UnprocessableEntity);
                }
                persona.user_agent = ua.clone();
            }
            if let Some(order) = &form.order {
                if context::order(order).is_none() {
                    return Err(Status::UnprocessableEntity);
                }
                persona.order = order.clone();
            }
            persona
        }
        _ => return Err(Status::UnprocessableEntity),
    };
    context::save(cookies, &persona);
    Ok(Redirect::to(format!("/{}", form.destination)))
}

#[rocket::get("/api/snapshot")]
pub async fn snapshot(
    context: WorkshopContext,
    client: OptionalClient<'_>,
    mode: &State<Mode>,
) -> Json<Value> {
    let mut decisions = Vec::new();
    for key in FLAGS {
        decisions.push(decision(client.0, key, &context.evaluation).await);
    }
    Json(
        json!({"offline": mode.offline, "persona": context.persona, "decisions": decisions,
        "snapshotSemantics": "Separate native checks; not an atomic all-flags revision."}),
    )
}

#[rocket::get("/api/check?<key>")]
pub async fn api(
    key: &str,
    context: WorkshopContext,
    client: OptionalClient<'_>,
) -> Result<Json<Decision>, Status> {
    if key.len() > 100 {
        return Err(Status::UnprocessableEntity);
    }
    // An empty key deliberately demonstrates a native configuration error;
    // an unknown non-empty key demonstrates the native false default.
    Ok(Json(decision(client.0, key, &context.evaluation).await))
}

#[rocket::get("/native")]
pub async fn native(feature: toggly_rocket::Feature<'_>) -> Json<Value> {
    let identity = feature.context().identity.clone();
    let enabled = feature.is_enabled("beta-access").await;
    Json(json!({"identity": identity, "enabled": enabled,
        "boundary": "Native untrusted X-User-Id then X-Identity; no workshop cookie, claims or Order mapping."}))
}

#[rocket::get("/beta")]
pub async fn beta(
    context: WorkshopContext,
    client: OptionalClient<'_>,
) -> Result<RawHtml<String>, Status> {
    // This denial is sample route composition using the native core evaluator.
    // FeatureEnabled is a data struct, not a FromRequest guard in 0.4.0.
    let result = decision(client.0, "beta-access", &context.evaluation).await;
    if result.error {
        return Err(Status::ServiceUnavailable);
    }
    if !result.enabled {
        return Err(Status::NotFound);
    }
    Ok(RawHtml(
        r##"<h1>Beta route enabled</h1>
<p>The full request context was resolved before evaluation.</p>
<a href="/surfaces">Return to package surfaces</a>"##
            .into(),
    ))
}

#[derive(rocket::FromForm)]
pub struct SubmitForm {
    pub csrf: String,
}

#[rocket::post("/submit", data = "<form>")]
pub async fn submit(
    form: Form<SubmitForm>,
    context: WorkshopContext,
    client: OptionalClient<'_>,
) -> Result<RawHtml<String>, Status> {
    if form.csrf != context.csrf {
        return Err(Status::Forbidden);
    }
    // Re-evaluate on the server; hiding a button alone cannot protect an action.
    let result = decision(client.0, "enhanced-submit", &context.evaluation).await;
    if result.error {
        return Err(Status::ServiceUnavailable);
    }
    if !result.enabled {
        return Err(Status::Forbidden);
    }
    Ok(RawHtml(
        r##"<h1>Enhanced submit allowed</h1>
<p>Demonstration only; no order or database was changed.</p>
<a href="/programmatic">Return to programmatic API</a>"##
            .into(),
    ))
}
