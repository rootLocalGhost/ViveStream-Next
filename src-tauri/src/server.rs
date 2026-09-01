use std::path::PathBuf;
use warp::Filter;

pub async fn start_server(base_dir: PathBuf) {
    // Highly permissive CORS policy to ensure the Tauri frontend (tauri://localhost or http://localhost:1420)
    // can request partial media chunks without being blocked by the WebView security model.
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "OPTIONS", "HEAD"])
        .allow_headers(vec![
            "Origin",
            "Range",
            "Accept",
            "Content-Type",
            "Sec-Fetch-Mode",
            "Sec-Fetch-Dest",
            "Sec-Fetch-Site",
            "User-Agent",
            "Referer",
        ]);

    let base_dir_clone = base_dir.clone();
    let base_dir_filter = warp::any().map(move || base_dir_clone.clone());

    // Custom high-performance thumbnail handler with automatic fallback & on-the-fly LQ generation
    let thumbnail_route = warp::path("Thumbnails")
        .and(warp::path::param::<String>())
        .and(base_dir_filter)
        .and_then(|filename: String, base: PathBuf| async move {
            let thumb_dir = base.join("Thumbnails");
            let target_file = thumb_dir.join(&filename);

            let file_to_read = if target_file.exists() {
                Some(target_file)
            } else if filename.ends_with("_lq.jpg") {
                let id = filename.trim_end_matches("_lq.jpg");
                let original_file = thumb_dir.join(format!("{}.jpg", id));
                if original_file.exists() {
                    // Trigger background generation for future requests
                    let orig_clone = original_file.clone();
                    let target_clone = target_file.clone();
                    tokio::task::spawn_blocking(move || {
                        let _ = std::process::Command::new("ffmpeg")
                            .args([
                                "-y",
                                "-i",
                                orig_clone.to_str().unwrap_or(""),
                                "-vf",
                                "scale='min(480,iw)':-2",
                                "-q:v",
                                "5",
                                target_clone.to_str().unwrap_or(""),
                            ])
                            .output();
                    });
                    Some(original_file)
                } else {
                    None
                }
            } else {
                None
            };

            match file_to_read {
                Some(path) => {
                    match tokio::fs::read(&path).await {
                        Ok(bytes) => {
                            let response = warp::http::Response::builder()
                                .header("Content-Type", "image/jpeg")
                                .header("Cache-Control", "public, max-age=31536000, immutable")
                                .header("Accept-Ranges", "bytes")
                                .body(bytes)
                                .unwrap();
                            Ok::<_, warp::Rejection>(response)
                        }
                        Err(_) => Err(warp::reject::not_found()),
                    }
                }
                None => Err(warp::reject::not_found()),
            }
        });

    let static_files = warp::fs::dir(base_dir)
        .with(warp::reply::with::header(
            "Cache-Control",
            "public, max-age=31536000, immutable",
        ))
        .with(warp::reply::with::header("Access-Control-Allow-Origin", "*"))
        .with(warp::reply::with::header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"))
        .with(warp::reply::with::header("Access-Control-Allow-Headers", "*"))
        .with(warp::reply::with::header("Accept-Ranges", "bytes"));

    let routes = thumbnail_route.or(static_files).with(cors);

    // Bind to the exact port requested by the frontend
    warp::serve(routes).run(([127, 0, 0, 1], 1422)).await;
}
