pub mod catalog;
pub mod context;
pub mod fixture;
pub mod routes;
pub mod views;

use rocket::{Build, Rocket, fairing::AdHoc};
use std::time::Duration;
use toggly::{TogglyClient, TogglyConfig};

pub struct Mode {
    pub offline: bool,
    pub startup_failed: bool,
}

/// Configuration is process-scoped. A real-key transport error never silently
/// switches to demo flags; an unavailable client leaves the workshop visible.
pub async fn start() -> Result<(Rocket<Build>, Option<fixture::Fixture>), std::io::Error> {
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
            .refresh_interval(Duration::from_secs(env_secs("TOGGLY_REFRESH_INTERVAL", 30)))
            .http_timeout(Duration::from_secs(5))
            .use_signed_definitions(true)
            .enable_usage_tracking(true)
            .usage_flush_interval(Duration::from_secs(env_secs(
                "TOGGLY_USAGE_FLUSH_INTERVAL",
                60,
            )))
            .build()
    };
    // Do not print SDK errors/configuration: transport messages can contain the key.
    let client = TogglyClient::new(config).await.ok();
    let failed = client.is_none();
    Ok((
        application(
            client,
            Mode {
                offline,
                startup_failed: failed,
            },
        ),
        fixture,
    ))
}

fn env_secs(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

pub fn is_placeholder(key: &str) -> bool {
    let key = key.trim();
    key.is_empty()
        || matches!(
            key,
            "placeholder" | "YOUR_APP_KEY" | "your-app-key" | "ci-placeholder"
        )
}

pub fn application(client: Option<TogglyClient>, mode: Mode) -> Rocket<Build> {
    let app = rocket::build().manage(mode)
        .mount("/", rocket::routes![routes::home, routes::section, routes::style, routes::session,
            routes::snapshot, routes::api, routes::native, routes::beta, routes::submit])
        .attach(AdHoc::on_response("Private workshop responses", |_, response| Box::pin(async move {
            response.set_raw_header("Cache-Control", "no-store");
            response.set_raw_header("X-Content-Type-Options", "nosniff");
            response.set_raw_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'");
        })))
        .attach(AdHoc::on_shutdown("Close the one Toggly client", |rocket| Box::pin(async move {
            if let Some(client) = rocket.state::<TogglyClient>() {
                client.close().await;
            }
            eprintln!("Workshop shutdown: Toggly close hook completed");
        })));
    // Native Feature requires State<TogglyClient>, not State<Arc<TogglyClient>>.
    // The client is not Clone; all handlers borrow this one managed value.
    match client {
        Some(client) => app.manage(client),
        None => app,
    }
}
