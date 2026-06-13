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

    // Serve the base directory directly.
    // E.g., http://127.0.0.1:1422/Videos/123.mp4 maps to base_dir/Videos/123.mp4
    let routes = warp::fs::dir(base_dir).with(cors);

    // Bind to the exact port requested by the frontend
    warp::serve(routes).run(([127, 0, 0, 1], 1422)).await;
}
