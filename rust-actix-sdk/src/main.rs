use actix_web::{HttpServer, rt};
use rust_actix_sdk_sample::start;

#[actix_web::main]
async fn main() {
    let Ok((state, fixture, owner)) = start().await else {
        eprintln!("Could not start the local fixture listener; check loopback permissions.");
        std::process::exit(1);
    };
    let port = std::env::var("ACTIX_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8018);
    let factory_state = state.clone();
    let server = HttpServer::new(move || rust_actix_sdk_sample::application(factory_state.clone()))
        .workers(8)
        .bind(("127.0.0.1", port));
    let Ok(server) = server else {
        eprintln!("Could not bind 127.0.0.1:{port}. Set ACTIX_PORT if 8018 is occupied.");
        std::process::exit(1);
    };
    let server = server.run();
    let handle = server.handle();
    rt::spawn(async move {
        shutdown_signal().await;
        handle.stop(true).await;
    });
    let result = server.await;
    if let Some(owner) = owner {
        owner.close().await;
    }
    drop(fixture);
    eprintln!("Workshop shutdown: Toggly close hook completed");
    if result.is_err() {
        eprintln!("Actix startup/shutdown failed. Check the port and loopback permissions.");
        std::process::exit(1);
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut signal) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            signal.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}
