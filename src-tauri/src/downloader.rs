use crate::db::get_db_connection;
use crate::models::{BinaryCheckStatus, VideoEntry};
use crate::system::{get_base_dir, get_bin_dir};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

pub fn get_binary_paths(bin_dir: &Path) -> (PathBuf, PathBuf, PathBuf) {
    #[cfg(target_os = "windows")]
    return (
        bin_dir.join("yt-dlp.exe"),
        bin_dir.join("ffmpeg.exe"),
        bin_dir.join("deno.exe"),
    );
    #[cfg(not(target_os = "windows"))]
    return (
        bin_dir.join("yt-dlp"),
        bin_dir.join("ffmpeg"),
        bin_dir.join("deno"),
    );
}

// Spawns a hidden native WebView, forces YouTube to calculate a BotGuard token via autoplay, and intercepts it
async fn extract_po_token(app: &AppHandle, video_id: &str) -> Result<String, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let tx = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_clone = tx.clone();

    // Using autoplay=1 ensures the iframe actually attempts playback, forcing BotGuard generation instantly
    let embed_url = format!("https://www.youtube.com/embed/{}?autoplay=1", video_id);
    let window_label = format!(
        "pot_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );

    let builder = tauri::WebviewWindowBuilder::new(
        app,
        &window_label,
        tauri::WebviewUrl::External(embed_url.parse().unwrap()),
    )
    .visible(false)
    .initialization_script(
        r#"
        const origFetch = window.fetch;
        window.fetch = async function(res, init) {
            if (typeof res === 'string' && res.includes('/youtubei/v1/player')) {
                try {
                    if (init && init.body) {
                        const body = JSON.parse(init.body);
                        const token = body?.serviceIntegrityDimensions?.poToken;
                        if (token) {
                            window.location.replace("https://vstoken.local/" + token);
                        }
                    }
                } catch(e) {}
            }
            return origFetch.apply(this, arguments);
        };
    "#,
    )
    .on_navigation(move |url| {
        if url.host_str() == Some("vstoken.local") {
            let token = url.path().trim_start_matches('/').to_string();
            if let Some(sender) = tx_clone.lock().unwrap().take() {
                let _ = sender.send(token);
            }
            return false; // Cancel navigation
        }
        true
    });

    let webview = builder.build().map_err(|e| e.to_string())?;

    // Increased timeout to 12s to account for potentially slow network connections hitting the iframe
    match tokio::time::timeout(std::time::Duration::from_secs(12), rx).await {
        Ok(Ok(token)) => {
            let _ = webview.close();
            Ok(token)
        }
        _ => {
            let _ = webview.close();
            Err("Timeout".into())
        }
    }
}

#[tauri::command]
pub async fn check_binaries(app: AppHandle) -> Result<BinaryCheckStatus, String> {
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp, ffmpeg, deno) = get_binary_paths(&bin_dir);

    #[cfg(target_os = "windows")]
    let ffprobe = bin_dir.join("ffprobe.exe");
    #[cfg(not(target_os = "windows"))]
    let ffprobe = bin_dir.join("ffprobe");

    Ok(BinaryCheckStatus {
        ytdlp_exists: ytdlp.exists() && deno.exists(),
        ffmpeg_exists: ffmpeg.exists() && ffprobe.exists(),
        bin_folder: bin_dir,
    })
}

#[tauri::command]
pub async fn download_binaries(app: AppHandle) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let emit_progress = |msg: &str| {
        let _ = app.emit("setup-progress", msg);
    };

    // 1. FETCH YT-DLP
    #[cfg(target_os = "windows")]
    let ytdlp_url =
        "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let ytdlp_url =
        "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp";

    emit_progress("Fetching latest yt-dlp Nightly from GitHub...");
    let bytes = client
        .get(ytdlp_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    emit_progress("Validating yt-dlp SHA256 checksum...");
    let sums_text = client
        .get(
            "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA2-256SUMS",
        )
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let target_bin_name = if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    };
    let expected_hash = sums_text
        .lines()
        .find(|line| line.ends_with(target_bin_name))
        .and_then(|line| line.split_whitespace().next())
        .ok_or("Failed to find yt-dlp hash")?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    if expected_hash != format!("{:x}", hasher.finalize()) {
        return Err(format!("SECURITY FAULT: yt-dlp checksum mismatch!"));
    }

    emit_progress("yt-dlp checksum verified. Proceeding with write.");
    let ytdlp_path = bin_dir.join(target_bin_name);
    File::create(&ytdlp_path)
        .map_err(|e| e.to_string())?
        .write_all(&bytes)
        .map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&ytdlp_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&ytdlp_path, perms).map_err(|e| e.to_string())?;
    }

    // 2. FETCH DENO (Required strictly for JS n-Challenge Decryption)
    emit_progress("Fetching standalone Deno JS runtime...");
    #[cfg(target_os = "windows")]
    let deno_url =
        "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
    #[cfg(not(target_os = "windows"))]
    let deno_url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip";

    let deno_bytes = client
        .get(deno_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let deno_zip_path = bin_dir.join("deno_temp.zip");
    File::create(&deno_zip_path)
        .map_err(|e| e.to_string())?
        .write_all(&deno_bytes)
        .map_err(|e| e.to_string())?;

    {
        let file = File::open(&deno_zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = file.name();
            if name.ends_with("deno.exe") || name.ends_with("deno") {
                let file_name = std::path::Path::new(name).file_name().unwrap();
                let outpath = bin_dir.join(file_name);
                let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;

                #[cfg(not(target_os = "windows"))]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut deno_perms = fs::metadata(&outpath)
                        .map_err(|e| e.to_string())?
                        .permissions();
                    deno_perms.set_mode(0o755);
                    fs::set_permissions(&outpath, deno_perms).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    let _ = fs::remove_file(deno_zip_path);

    // 3. FETCH FFMPEG
    emit_progress("Fetching repacked Lite FFmpeg build...");
    #[cfg(target_os = "windows")]
    let ffmpeg_url = "https://github.com/rootlocalghost/ViveStream-Next-Engines/releases/latest/download/ffmpeg-win64-lite.zip";
    #[cfg(not(target_os = "windows"))]
    let ffmpeg_url = "https://github.com/rootlocalghost/ViveStream-Next-Engines/releases/latest/download/ffmpeg-linux64-lite.tar.xz";

    let mut res = client
        .get(ffmpeg_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let total_size = res.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    #[cfg(target_os = "windows")]
    let temp_path = bin_dir.join("ffmpeg_temp.zip");
    #[cfg(not(target_os = "windows"))]
    let temp_path = bin_dir.join("ffmpeg_temp.tar.xz");

    let mut temp_file = File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut last_emit = Instant::now();

    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        temp_file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if total_size > 0 && last_emit.elapsed().as_millis() > 150 {
            emit_progress(&format!(
                "[PROGRESS] {:.1}",
                (downloaded as f64 / total_size as f64) * 100.0
            ));
            last_emit = Instant::now();
        }
    }
    emit_progress("[PROGRESS] 100.0");
    emit_progress("Download complete. Extracting raw executables from disk...");

    #[cfg(target_os = "windows")]
    {
        let file = File::open(&temp_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            if file.is_file() {
                let name = file.name();
                if name.ends_with("ffmpeg.exe") || name.ends_with("ffprobe.exe") {
                    let outpath = bin_dir.join(std::path::Path::new(name).file_name().unwrap());
                    std::io::copy(&mut file, &mut File::create(outpath).unwrap()).unwrap();
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tar::Archive;
        use xz2::read::XzDecoder;
        let mut archive = Archive::new(XzDecoder::new(
            File::open(&temp_path).map_err(|e| e.to_string())?,
        ));
        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            if entry.header().entry_type().is_file() {
                if let Some(name) = entry
                    .path()
                    .map_err(|e| e.to_string())?
                    .file_name()
                    .and_then(|n| n.to_str())
                {
                    if name == "ffmpeg" || name == "ffprobe" {
                        let outpath = bin_dir.join(name);
                        entry.unpack(&outpath).map_err(|e| e.to_string())?;

                        use std::os::unix::fs::PermissionsExt;
                        let mut ff_perms = fs::metadata(&outpath)
                            .map_err(|e| e.to_string())?
                            .permissions();
                        ff_perms.set_mode(0o755);
                        fs::set_permissions(&outpath, ff_perms).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }

    let _ = fs::remove_file(temp_path);
    emit_progress("Engines extracted perfectly.");

    app.dialog()
        .message("Deployment complete. ViveStream will now restart to initialize engines.")
        .kind(tauri_plugin_dialog::MessageDialogKind::Info)
        .show(move |_| {
            app.restart();
        });

    Ok(())
}

#[tauri::command]
pub async fn get_video_metadata(
    app: AppHandle,
    url: String,
    player_client: String,
) -> Result<Vec<VideoEntry>, String> {
    let bin_dir = get_bin_dir(&app)?;
    let base_dir = get_base_dir(&app)?;
    let (ytdlp_path, _, deno_path) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() {
        return Err("yt-dlp binary missing.".into());
    }

    let path_sep = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    let new_path = format!(
        "{}{}{}",
        bin_dir.to_str().unwrap(),
        path_sep,
        std::env::var("PATH").unwrap_or_default()
    );

    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");

    let temp_id = if let Some(idx) = url.find("v=") {
        url[idx + 2..].split('&').next().unwrap_or("bVYw5xR8xFg")
    } else {
        "bVYw5xR8xFg"
    };

    let po_token = match extract_po_token(&app, temp_id).await {
        Ok(t) => t,
        Err(_) => String::new(),
    };

    let mut client_args = format!("youtube:player_client={}", player_client);
    if !po_token.is_empty() {
        client_args.push_str(&format!(";po_token=web+{}", po_token));
    }

    let mut cmd = Command::new(&ytdlp_path);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .current_dir(&bin_dir)
        .env("PATH", &new_path)
        .args([
            "--force-ipv4",
            "--flat-playlist",
            "--js-runtimes",
            &format!("deno:{}", deno_path.to_str().unwrap()),
            "--extractor-args",
            &client_args,
            "--print",
            "%(id)s|%(uploader)s|%(title)s",
            &url,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "yt-dlp Error: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let out_str = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();

    for line in out_str.lines() {
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() == 3 {
            let video_path = vid_dir.join(format!("{}.mp4", parts[0]));
            let thumbnail_path = thumb_dir.join(format!("{}.jpg", parts[0]));
            entries.push(VideoEntry {
                id: parts[0].to_string(),
                channel: parts[1].to_string(),
                title: parts[2].to_string(),
                video_path: video_path.to_string_lossy().to_string(),
                thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
                avatar_path: String::new(),
                subtitle_path: String::new(),
                desc_path: String::new(),
            });
        }
    }

    if entries.is_empty() {
        Err(format!("Failed to parse metadata"))
    } else {
        Ok(entries)
    }
}

#[tauri::command]
pub async fn download_video(
    app: AppHandle,
    url: String,
    metadata: VideoEntry,
    quality: String,
    dl_type: String,
    cookies: String,
    speed_limit: String,
    concurrent_fragments: u8,
    auto_subs: bool,
    dl_subs: bool,
    sponsorblock: bool,
    live_from_start: bool,
    player_client: String,
) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    let base_dir = get_base_dir(&app)?;
    let (ytdlp_path, ffmpeg_path, deno_path) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() || !ffmpeg_path.exists() {
        return Err("Binaries missing.".into());
    }

    let path_sep = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    let new_path = format!(
        "{}{}{}",
        bin_dir.to_str().unwrap(),
        path_sep,
        std::env::var("PATH").unwrap_or_default()
    );

    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");
    let desc_dir = base_dir.join("Descriptions");
    let av_dir = base_dir.join("Avatars");

    fs::create_dir_all(&vid_dir).unwrap();
    fs::create_dir_all(&thumb_dir).unwrap();
    fs::create_dir_all(&desc_dir).unwrap();
    fs::create_dir_all(&av_dir).unwrap();

    let temp_path = vid_dir.join(format!("raw_{}.mp4", metadata.id));
    let final_path = PathBuf::from(&metadata.video_path);
    let progress_event = format!("download-progress-{}", metadata.id);

    let _ = app.emit(
        &progress_event,
        "Step 1: Spawning local WebView to intercept BotGuard PO Token...",
    );

    let po_token = match extract_po_token(&app, &metadata.id).await {
        Ok(t) => {
            let _ = app.emit(
                &progress_event,
                "PO Token generated successfully. Initializing stream...",
            );
            t
        }
        Err(_) => {
            let _ = app.emit(
                &progress_event,
                "PO Token extraction timed out, proceeding without token...",
            );
            String::new()
        }
    };

    let mut client_args = format!("youtube:player_client={}", player_client);
    if !po_token.is_empty() {
        client_args.push_str(&format!(";po_token=web+{}", po_token));
    }

    let is_audio = dl_type == "Audio";
    let res_filter = if is_audio {
        "bestaudio[ext=m4a]/bestaudio".to_string()
    } else {
        match quality.as_str() {
            "720p" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "1080p" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "1440p" => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "4K" => "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "Best" => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            _ => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        }
        .to_string()
    };

    let mut yt_args = vec![
        "--force-ipv4".to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg_path.to_str().unwrap().to_string(),
        "--js-runtimes".to_string(),
        format!("deno:{}", deno_path.to_str().unwrap()),
        "--retries".to_string(),
        "10".to_string(),
        "--newline".to_string(),
        "-f".to_string(),
        res_filter,
        "--extractor-args".to_string(),
        client_args,
        "--paths".to_string(),
        vid_dir.to_str().unwrap().to_string(),
        "--paths".to_string(),
        format!("thumbnail:{}", thumb_dir.to_str().unwrap()),
        "-o".to_string(),
        "raw_%(id)s.%(ext)s".to_string(),
        "--write-thumbnail".to_string(),
        "--convert-thumbnails".to_string(),
        "jpg".to_string(),
        "--write-description".to_string(),
    ];

    if concurrent_fragments > 1 {
        yt_args.push("--concurrent-fragments".to_string());
        yt_args.push(concurrent_fragments.to_string());
    }

    if !speed_limit.is_empty() {
        yt_args.push("--limit-rate".to_string());
        yt_args.push(speed_limit.clone());
    }

    if auto_subs || dl_subs {
        yt_args.push("--sub-format".to_string());
        yt_args.push("vtt".to_string());
        yt_args.push("--sub-langs".to_string());
        yt_args.push("en.*".to_string());
        if auto_subs {
            yt_args.push("--write-auto-subs".to_string());
        }
        if dl_subs {
            yt_args.push("--write-subs".to_string());
        }
    }

    if sponsorblock {
        yt_args.push("--sponsorblock-remove".to_string());
        yt_args.push("all".to_string());
    }

    if live_from_start {
        yt_args.push("--live-from-start".to_string());
    }

    if !is_audio {
        yt_args.push("--merge-output-format".to_string());
        yt_args.push("mp4".to_string());
        yt_args.push("--remux-video".to_string());
        yt_args.push("mp4".to_string());
    }

    let cookies_lower = cookies.to_lowercase();
    if cookies_lower != "none" && !cookies_lower.is_empty() {
        yt_args.push("--cookies-from-browser".to_string());
        yt_args.push(cookies_lower);
    }

    yt_args.push(url);

    let mut yt_cmd = Command::new(&ytdlp_path);
    #[cfg(target_os = "windows")]
    yt_cmd.creation_flags(0x08000000);

    let mut child = yt_cmd
        .current_dir(&bin_dir)
        .env("PATH", &new_path)
        .args(&yt_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stderr = child.stderr.take().unwrap();
    let stdout = child.stdout.take().unwrap();

    let app_clone = app.clone();
    let prog_clone = progress_event.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit(&prog_clone, format!("ERR: {}", line));
            }
        }
    });

    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        if let Ok(line) = line {
            let _ = app.emit(&progress_event, line);
        }
    }

    if !child.wait().map_err(|e| e.to_string())?.success() {
        return Err("yt-dlp download failed. Check logs for details.".into());
    }

    let raw_thumb = thumb_dir.join(format!("raw_{}.jpg", metadata.id));
    if raw_thumb.exists() {
        let _ = fs::rename(&raw_thumb, &metadata.thumbnail_path);
    }

    let avatar_path = av_dir.join(format!("{}.jpg", metadata.channel));
    if !avatar_path.exists() {
        let _ = fs::copy(&metadata.thumbnail_path, &avatar_path);
    }

    let raw_desc = vid_dir.join(format!("raw_{}.description", metadata.id));
    let final_desc = desc_dir.join(format!("{}.txt", metadata.id));
    if raw_desc.exists() {
        let _ = fs::rename(&raw_desc, &final_desc);
    } else {
        let _ = fs::write(&final_desc, "No description available.");
    }

    if let Ok(entries) = fs::read_dir(&vid_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let fname = path.file_name().unwrap_or_default().to_string_lossy();
                if fname.starts_with(&format!("raw_{}", metadata.id)) && fname.ends_with(".vtt") {
                    let _ = fs::rename(&path, vid_dir.join(format!("{}.vtt", metadata.id)));
                }
            }
        }
    }

    let mut transcode_success = false;

    if is_audio {
        let _ = app.emit(&progress_event, "Step 2: Processing Audio...");
        let _ = fs::rename(&temp_path.with_extension("m4a"), &final_path);
        if !final_path.exists() {
            let _ = fs::rename(&temp_path.with_extension("mp4"), &final_path);
        }
        transcode_success = true;
    } else {
        let _ = app.emit(&progress_event, "Step 2: Starting FFmpeg transcoder...");
        let encoders = if cfg!(target_os = "windows") {
            vec![
                (
                    "Intel QSV (Windows native - ARC Optimised)",
                    vec!["-c:v", "h264_qsv", "-preset", "fast", "-b:v", "15M"],
                ),
                (
                    "NVIDIA NVENC",
                    vec!["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "15M"],
                ),
                (
                    "CPU (libx264)",
                    vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"],
                ),
            ]
        } else {
            vec![
                (
                    "VAAPI (Linux/Intel/AMD)",
                    vec![
                        "-vaapi_device",
                        "/dev/dri/renderD128",
                        "-vf",
                        "format=nv12,hwupload",
                        "-c:v",
                        "h264_vaapi",
                        "-b:v",
                        "15M",
                    ],
                ),
                (
                    "Intel QSV (Linux fallback)",
                    vec!["-c:v", "h264_qsv", "-preset", "fast", "-b:v", "15M"],
                ),
                (
                    "NVIDIA NVENC",
                    vec!["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "15M"],
                ),
                (
                    "CPU (libx264)",
                    vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"],
                ),
            ]
        };

        for (name, args) in encoders {
            let _ = app.emit(&progress_event, format!("Attempting encoder: {}", name));
            let mut cmd = Command::new(&ffmpeg_path);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000);

            let output = cmd
                .args(["-y", "-i", temp_path.to_str().unwrap()])
                .args(&args)
                .args([
                    "-c:a",
                    "aac",
                    "-movflags",
                    "+faststart",
                    final_path.to_str().unwrap(),
                ])
                .output()
                .map_err(|e| e.to_string())?;

            if output.status.success() {
                let _ = app.emit(
                    &progress_event,
                    format!("Success! Transcoded via: {}", name),
                );
                transcode_success = true;
                break;
            } else {
                let _ = app.emit(
                    &progress_event,
                    format!("Encoder {} failed, dropping to next fallback...", name),
                );
            }
        }
        let _ = fs::remove_file(&temp_path);
    }

    if !transcode_success {
        return Err("All hardware and software FFmpeg encoders failed.".into());
    }

    let mut conn = get_db_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO Artists (name, avatar_path) VALUES (?1, ?2)",
        [&metadata.channel, &format!("{}.jpg", metadata.channel)],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO Videos (id, title, channel_name, video_path, thumbnail_path, is_favorite) VALUES (?1, ?2, ?3, ?4, ?5, 0) ON CONFLICT(id) DO UPDATE SET title = excluded.title, channel_name = excluded.channel_name, video_path = excluded.video_path, thumbnail_path = excluded.thumbnail_path",
        (&metadata.id, &metadata.title, &metadata.channel, &metadata.video_path, &metadata.thumbnail_path)).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn reindex_library(app: AppHandle, player_client: String) -> Result<String, String> {
    let base_dir = get_base_dir(&app)?;
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp_path, _, deno_path) = crate::downloader::get_binary_paths(&bin_dir);

    let path_sep = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    let new_path = format!(
        "{}{}{}",
        bin_dir.to_str().unwrap(),
        path_sep,
        std::env::var("PATH").unwrap_or_default()
    );

    let vid_dir = base_dir.join("Videos");

    if !vid_dir.exists() {
        return Ok("No video directory found. Database matches clean state.".into());
    }

    // AWAIT BEFORE DB CONNECTION TO PREVENT THREAD PANICS
    let po_token = match extract_po_token(&app, "bVYw5xR8xFg").await {
        Ok(t) => t,
        Err(_) => String::new(),
    };

    let mut physical_ids = std::collections::HashSet::new();

    if let Ok(entries) = fs::read_dir(&vid_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "mp4") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if !stem.starts_with("raw_") {
                        physical_ids.insert(stem.to_string());
                    }
                }
            }
        }
    }

    let mut conn = get_db_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT id FROM Videos")
        .map_err(|e| e.to_string())?;
    let db_ids: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();
    drop(stmt);

    for id in db_ids {
        if !physical_ids.contains(&id) {
            let _ = conn.execute("DELETE FROM Playlist_Videos WHERE video_id = ?1", [&id]);
            let _ = conn.execute("DELETE FROM Videos WHERE id = ?1", [&id]);
        }
    }

    let mut missing_metadata_ids = Vec::new();
    for id in &physical_ids {
        if conn
            .query_row(
                "SELECT COUNT(*) FROM Videos WHERE id = ?1 AND title IS NOT NULL AND channel_name IS NOT NULL",
                [id],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(0)
            == 0
        {
            missing_metadata_ids.push(id.clone());
        }
    }

    if !missing_metadata_ids.is_empty() && ytdlp_path.exists() {
        let mut client_args = format!("youtube:player_client={}", player_client);
        if !po_token.is_empty() {
            client_args.push_str(&format!(";po_token=web+{}", po_token));
        }

        for chunk in missing_metadata_ids.chunks(20) {
            let mut cmd = Command::new(&ytdlp_path);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000);

            cmd.current_dir(&bin_dir);
            cmd.env("PATH", &new_path);
            cmd.arg("--force-ipv4");
            cmd.arg("--flat-playlist");
            cmd.args([
                "--js-runtimes",
                &format!("deno:{}", deno_path.to_str().unwrap()),
            ]);
            cmd.args(["--extractor-args", &client_args]);
            cmd.args(["--print", "%(id)s|%(uploader)s|%(title)s"]);

            for id in chunk {
                cmd.arg(format!("https://www.youtube.com/watch?v={}", id));
            }

            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    let tx = conn.transaction().map_err(|e| e.to_string())?;
                    for line in String::from_utf8_lossy(&output.stdout).lines() {
                        let parts: Vec<&str> = line.splitn(3, '|').collect();
                        if parts.len() == 3 {
                            let (id, channel, title) = (parts[0], parts[1], parts[2]);
                            let _ = tx.execute(
                                "INSERT OR IGNORE INTO Artists (name, avatar_path) VALUES (?1, ?2)",
                                [channel, &format!("{}.jpg", channel)],
                            );
                            let _ = tx.execute("INSERT INTO Videos (id, title, channel_name, video_path, thumbnail_path, is_favorite) VALUES (?1, ?2, ?3, ?4, ?5, 0) ON CONFLICT(id) DO UPDATE SET title = excluded.title, channel_name = excluded.channel_name, video_path = excluded.video_path",
                                (id, title, channel, vid_dir.join(format!("{}.mp4", id)).to_str().unwrap(), base_dir.join("Thumbnails").join(format!("{}.jpg", id)).to_str().unwrap()));
                        }
                    }
                    tx.commit().map_err(|e| e.to_string())?;
                }
            }
        }
    }
    let _ = conn.execute("DELETE FROM Artists WHERE name NOT IN (SELECT DISTINCT channel_name FROM Videos WHERE channel_name IS NOT NULL)", []);
    Ok(format!(
        "Successfully indexed database logic. Verified {} files.",
        physical_ids.len()
    ))
}
