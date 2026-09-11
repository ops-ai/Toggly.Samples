//! Request-local teaching personas are not authentication or authorization.
use rand::RngCore;
use rocket::{
    Request,
    http::{Cookie, CookieJar, SameSite},
    request::{FromRequest, Outcome},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use toggly::entity_context::{
    EntityContextPropertySchema, EntityContextSchemaRegistration, register_context_schema,
};
use toggly::{EvalContext, HttpRequestMapper, TogglyEntityContext};

pub const MATCHING_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
pub const NONMATCHING_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Persona {
    pub identity: String,
    pub role: String,
    pub country: String,
    pub language: String,
    pub user_agent: String,
    pub order: String,
}
impl Default for Persona {
    fn default() -> Self {
        Self::preset(false)
    }
}
impl Persona {
    pub fn preset(matching: bool) -> Self {
        Self {
            identity: if matching { "alice" } else { "bob" }.into(),
            role: if matching { "admin" } else { "user" }.into(),
            country: if matching { "US" } else { "CA" }.into(),
            language: if matching {
                "en-US,en;q=0.9"
            } else {
                "fr-FR,fr;q=0.9"
            }
            .into(),
            user_agent: if matching {
                MATCHING_UA
            } else {
                NONMATCHING_UA
            }
            .into(),
            order: if matching { "ord-vip" } else { "ord-standard" }.into(),
        }
    }

    /// Resolve user, claims, request metadata and Order before the first check.
    /// The shared client owns definitions; this value belongs only to this request.
    pub fn evaluation(&self) -> EvalContext {
        let request = HttpRequestMapper::from_http_headers([
            ("cf-ipcountry", self.country.as_str()),
            ("accept-language", self.language.as_str()),
            ("user-agent", self.user_agent.as_str()),
        ]);
        let builder = EvalContext::builder()
            .claim("role", &self.role)
            .request(request);
        let builder = if self.identity.is_empty() {
            builder
        } else {
            builder.identity(&self.identity)
        };
        builder
            .entity(order(&self.order).expect("validated Order"))
            .build()
    }
}

/// Id becomes the entity key; Vip is boolean and Total is optional, never a string.
pub fn order(id: &str) -> Option<TogglyEntityContext> {
    let (vip, total) = match id {
        "ord-vip" => (true, Some(40)),
        "ord-standard" => (false, Some(40)),
        "ord-high-value" => (false, Some(250)),
        "ord-no-total" => (false, None),
        _ => return None,
    };
    let mut attributes = HashMap::from([("Vip".into(), json!(vip))]);
    if let Some(total) = total {
        attributes.insert("Total".into(), json!(total));
    }
    Some(TogglyEntityContext {
        kind: "Order".into(),
        key: id.into(),
        attributes,
    })
}

pub fn register_order() {
    // Register locally before constructing the client. Published 0.4.0 performs
    // the remote catalog PUT after fetching definitions; manual setup is required.
    register_context_schema(EntityContextSchemaRegistration {
        kind: "Order".into(),
        key_property: "Id".into(),
        display_name: Some("Order".into()),
        properties: [("Id", "string"), ("Vip", "boolean"), ("Total", "number")]
            .into_iter()
            .map(|(name, kind)| EntityContextPropertySchema {
                name: name.into(),
                type_name: kind.into(),
            })
            .collect(),
    });
}

pub fn save(cookies: &CookieJar<'_>, persona: &Persona) {
    // Rocket authenticates/encrypts private cookies. Demo choices are still not
    // real user privileges; production apps must derive them from trusted identity.
    cookies.add_private(
        Cookie::build((
            "persona",
            serde_json::to_string(persona).expect("serializable persona"),
        ))
        .path("/")
        .same_site(SameSite::Lax)
        .http_only(true),
    );
}

pub struct WorkshopContext {
    pub persona: Persona,
    pub evaluation: EvalContext,
    pub csrf: String,
}
#[rocket::async_trait]
impl<'r> FromRequest<'r> for WorkshopContext {
    type Error = ();
    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, ()> {
        let cookies = request.cookies();
        let persona = cookies
            .get_private("persona")
            .and_then(|cookie| serde_json::from_str::<Persona>(cookie.value()).ok())
            .filter(|p| order(&p.order).is_some())
            .unwrap_or_default();
        let csrf = cookies
            .get_private("csrf")
            .map(|cookie| cookie.value().to_owned())
            .unwrap_or_else(|| {
                let mut bytes = [0u8; 32];
                rand::rngs::OsRng.fill_bytes(&mut bytes);
                let token: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
                cookies.add_private(
                    Cookie::build(("csrf", token.clone()))
                        .path("/")
                        .same_site(SameSite::Strict)
                        .http_only(true),
                );
                token
            });
        let evaluation = persona.evaluation();
        Outcome::Success(Self {
            persona,
            evaluation,
            csrf,
        })
    }
}

/// Rocket's State sentinel aborts ignition even inside Option<State<T>>.
/// This sample guard inspects managed state explicitly so the error page can
/// render when construction failed. It neither creates nor substitutes a client.
pub struct OptionalClient<'r>(pub Option<&'r toggly::TogglyClient>);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for OptionalClient<'r> {
    type Error = ();
    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, ()> {
        Outcome::Success(Self(request.rocket().state::<toggly::TogglyClient>()))
    }
}
