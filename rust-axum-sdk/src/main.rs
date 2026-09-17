use std::net::SocketAddr;
use tokio::net::TcpListener;

#[tokio::main(flavor = "multi_thread", worker_threads = 8)]
async fn main() {
    let Ok((app, fixture, client)) = rust_axum_sdk_sample::start().await else {
        eprintln!("Could not start the local fixture listener; check loopback permissions.");
        std::process::exit(1);
    };
    let port = std::env::var("AXUM_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8017);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(listener) = TcpListener::bind(addr).await else {
        eprintln!("Could not bind {addr}. Set AXUM_PORT if 8017 is occupied.");
        std::process::exit(1);
    };
    let result = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown(client))
        .await;
    drop(fixture);
    if result.is_err() {
        eprintln!("Axum startup/shutdown failed. Check the port and loopback permissions.");
        std::process::exit(1);
    }
}

async fn shutdown(client: Option<std::sync::Arc<toggly::TogglyClient>>) {
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
    if let Some(client) = client {
        client.close().await;
    }
    eprintln!("Workshop shutdown: Toggly close hook completed");
}
