#[rocket::main]
async fn main() {
    let Ok((app, fixture)) = rust_rocket_sdk_sample::start().await else {
        eprintln!("Could not start the local fixture listener; check loopback permissions.");
        std::process::exit(1);
    };
    // Keep the signed fixture alive until Rocket and its client have shut down.
    let result = app.launch().await;
    drop(fixture);
    if result.is_err() {
        eprintln!("Rocket startup/shutdown failed. Check the port and ROCKET_SECRET_KEY.");
        std::process::exit(1);
    }
}
