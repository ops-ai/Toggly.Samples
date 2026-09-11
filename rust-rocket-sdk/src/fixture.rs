//! An explicitly local transport fixture, not a replacement evaluator.
//! The real SDK downloads and verifies these ephemeral signed definitions.
use base64::{
    Engine,
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
};
use p256::ecdsa::{Signature, SigningKey, signature::hazmat::PrehashSigner};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread::JoinHandle,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use toggly::TogglyConfig;

struct Document {
    body: String,
    revision: usize,
    fail: bool,
}

pub struct Fixture {
    pub base: String,
    document: Arc<Mutex<Document>>,
    requests: Arc<AtomicUsize>,
    pub schema_requests: Arc<Mutex<Vec<Value>>>,
    stop: Arc<AtomicBool>,
    task: Option<JoinHandle<()>>,
    secret: SigningKey,
    kid: String,
}
impl Fixture {
    pub fn start() -> std::io::Result<Self> {
        let secret = SigningKey::random(&mut rand::rngs::OsRng);
        let point = secret.verifying_key().to_encoded_point(false);
        let x = point.x().expect("P256 x");
        let y = point.y().expect("P256 y");
        let kid = format!("{:X}ES256", sha1::Sha1::digest([&x[..], &y[..]].concat()));
        let jwks = json!({"keys": [{"kty":"EC", "use":"sig", "kid":kid,
            "crv":"P-256", "x":URL_SAFE_NO_PAD.encode(x), "y":URL_SAFE_NO_PAD.encode(y), "alg":"ES256"}]}).to_string();
        let document = Arc::new(Mutex::new(Document {
            body: String::new(),
            revision: 0,
            fail: false,
        }));
        let listener = TcpListener::bind("127.0.0.1:0")?;
        listener.set_nonblocking(true)?;
        let base = format!("http://{}", listener.local_addr()?);
        let stop = Arc::new(AtomicBool::new(false));
        let requests = Arc::new(AtomicUsize::new(0));
        let schema_requests = Arc::new(Mutex::new(Vec::new()));
        let (signal, data, count, schemas) = (
            stop.clone(),
            document.clone(),
            requests.clone(),
            schema_requests.clone(),
        );
        let task = std::thread::spawn(move || {
            while !signal.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        // Accepted sockets inherit nonblocking mode on some hosts.
                        // Read each bounded fixture request in blocking mode.
                        let _ = stream.set_nonblocking(false);
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                        if let Ok(request) = read_request(&mut stream) {
                            let first = request.lines().next().unwrap_or_default();
                            let (status, body, revision) = if first.starts_with("PUT ") {
                                if let Some((_, body)) = request.split_once("\r\n\r\n")
                                    && let Ok(payload) = serde_json::from_str(body)
                                {
                                    schemas.lock().expect("schema lock").push(payload);
                                }
                                (200, "{}".to_string(), 0)
                            } else if first.contains("/.well-known/jwks") {
                                (200, jwks.clone(), 0)
                            } else {
                                count.fetch_add(1, Ordering::Relaxed);
                                let doc = data.lock().expect("fixture lock");
                                (
                                    if doc.fail { 503 } else { 200 },
                                    doc.body.clone(),
                                    doc.revision,
                                )
                            };
                            let response = format!(
                                "HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nETag: \"fixture-{revision}\"\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                                body.len()
                            );
                            let _ = stream.write_all(response.as_bytes());
                        }
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(Duration::from_millis(2))
                    }
                    Err(_) => break,
                }
            }
        });
        let fixture = Self {
            base,
            document,
            requests,
            schema_requests,
            stop,
            task: Some(task),
            secret,
            kid,
        };
        fixture.replace(Self::definitions(), false);
        Ok(fixture)
    }

    pub fn definitions() -> Value {
        serde_json::from_str(include_str!("../fixtures/definitions.json"))
            .expect("valid checked-in fixture")
    }

    /// Tests change transport data, then let the native provider refresh normally.
    /// No custom evaluation logic or production app key is used here.
    pub fn replace(&self, definitions: Value, tamper: bool) {
        let defs = definitions.to_string();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_secs();
        // Match the platform signing protocol: SHA256 prehash, then ECDSA over
        // SHA256(prehash). Signature bytes are P1363, not ASN.1/DER.
        let hash = Sha256::digest(Sha256::digest(format!("{defs}|{timestamp}").as_bytes()));
        let signature: Signature = self.secret.sign_prehash(&hash).expect("fixture signing");
        let payload = if tamper { "[]" } else { defs.as_str() };
        let body = format!(
            "{{\"defs\":{payload},\"timestamp\":{timestamp},\"kid\":\"{}\",\"signature\":\"{}\"}}",
            self.kid,
            STANDARD.encode(signature.to_bytes())
        );
        let mut document = self.document.lock().expect("fixture lock");
        document.body = body;
        document.revision += 1;
        document.fail = false;
    }

    pub fn fail(&self, fail: bool) {
        self.document.lock().expect("fixture lock").fail = fail;
    }

    pub fn request_count(&self) -> usize {
        self.requests.load(Ordering::Relaxed)
    }

    pub fn config(&self, background: bool) -> TogglyConfig {
        TogglyConfig::builder()
            .app_key("offline-fixture-placeholder")
            .environment("Production")
            .definitions_url(&self.base)
            .base_url(&self.base)
            .use_signed_definitions(true)
            .cache_ttl(Duration::ZERO)
            .refresh_interval(Duration::from_secs(2))
            .http_timeout(Duration::from_secs(2))
            .disable_background_refresh(!background)
            .build()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(task) = self.task.take() {
            let _ = task.join();
        }
    }
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<String> {
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 4096];
    loop {
        let size = stream.read(&mut buffer)?;
        if size == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..size]);
        if bytes.len() > 65536 {
            return Err(std::io::Error::other("fixture request too large"));
        }
        if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            let header = String::from_utf8_lossy(&bytes[..end]);
            let length = header
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
                .unwrap_or(0);
            if bytes.len() >= end + 4 + length {
                break;
            }
        }
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}
