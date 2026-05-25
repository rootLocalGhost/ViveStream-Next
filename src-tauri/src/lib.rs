use tauri::{AppHandle, Emitter, Manager};
use std::process::{Command, Stdio};
use std::io::{BufReader, BufRead, Write, Cursor};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use warp::Filter;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone)]
struct VideoEntry {
    id: String,
    title: String,
    channel: String,
    video_path: PathBuf,
    thumbnail_path: PathBuf,
}

#[derive(Serialize)]
struct BinaryCheckStatus {
    ytdlp_exists: bool,
    ffmpeg_exists: bool,
    bin_folder: PathBuf,
}

fn get_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("bin"))
}

fn get_binary_paths(bin_dir: &Path) -> (PathBuf, PathBuf) {
    #[cfg(target_os = "windows")]
    return (bin_dir.join("yt-dlp.exe"), bin_dir.join("ffmpeg.exe"));
    
    #[cfg(not(target_os = "windows"))]
    return (bin_dir.join("yt-dlp"), bin_dir.join("ffmpeg"));
}

#[tauri::command]
async fn check_binaries(app: AppHandle) -> Result<BinaryCheckStatus, String> {
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp, ffmpeg) = get_binary_paths(&bin_dir);
    Ok(BinaryCheckStatus {
        ytdlp_exists: ytdlp.exists(),
        ffmpeg_exists: ffmpeg.exists(),
        bin_folder: bin_dir,
    })
}

#[tauri::command]
async fn download_binaries(app: AppHandle) -> Result<(), String> {
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

    // --- Step 1: yt-dlp (Nightly) ---
    #[cfg(target_os = "windows")]
    let ytdlp_url = "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let ytdlp_url = "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp";

    emit_progress(&format!("Fetching latest yt-dlp Nightly from GitHub..."));
    let ytdlp_response = client.get(ytdlp_url).send().await.map_err(|e| e.to_string())?;
    let ytdlp_path = bin_dir.join(if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" });
    let mut ytdlp_file = File::create(&ytdlp_path).map_err(|e| e.to_string())?;
    let bytes = ytdlp_response.bytes().await.map_err(|e| e.to_string())?;
    ytdlp_file.write_all(&bytes).map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&ytdlp_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755); 
        fs::set_permissions(&ytdlp_path, perms).map_err(|e| e.to_string())?;
    }
    emit_progress("yt-dlp Nightly ready.");

    // --- Step 2: FFmpeg ---
    emit_progress("Fetching compatible FFmpeg build... (This takes a moment)");
   #[cfg(target_os = "windows")]
    {
        // Switched to BtbN Windows builds to fix the 404 EOCD error
        let ffmpeg_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
        let response = client.get(ffmpeg_url).send().await.map_err(|e| e.to_string())?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to download FFmpeg. HTTP Status: {}", response.status()));
        }

        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            // Ensure we match the exact file and not a directory
            if file.name().ends_with("ffmpeg.exe") && file.is_file() {
                let mut outpath = bin_dir.join("ffmpeg.exe");
                let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                break;
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let ffmpeg_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";
        let response = client.get(ffmpeg_url).send().await.map_err(|e| e.to_string())?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to download FFmpeg. HTTP Status: {}", response.status()));
        }
        
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        
        use xz2::read::XzDecoder; 
        use tar::Archive;
        let tar = XzDecoder::new(Cursor::new(bytes)); 
        let mut archive = Archive::new(tar);
        
        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path().map_err(|e| e.to_string())?;
            
            if path.file_name().map_or(false, |name| name == "ffmpeg") && entry.header().entry_type().is_file() {
                let outpath = bin_dir.join("ffmpeg");
                entry.unpack(&outpath).map_err(|e| e.to_string())?;
                
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&outpath).map_err(|e| e.to_string())?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&outpath, perms).map_err(|e| e.to_string())?;
                break;
            }
        }
    }
    emit_progress("FFmpeg ready.");
    
    app.dialog().message("Setup complete. ViveStream will now restart.").kind(tauri_plugin_dialog::MessageDialogKind::Info).show(move |_| {
        app.restart();
    });

    Ok(())
}

#[tauri::command]
async fn get_video_metadata(app: AppHandle, url: String) -> Result<VideoEntry, String> {
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp_path, _) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() { return Err("yt-dlp binary missing. Run setup.".into()); }

    let base_dir = Path::new("/home/localghost/Videos/ViveStream");
    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");

    let output = Command::new(&ytdlp_path)
        .args([
            "--no-playlist", 
            // Purged android, ios, and web. Restricted entirely to safeworkarounds.
            "--extractor-args", "youtube:player_client=web_safari,web_embedded", 
            "--print", "%(id)s|%(uploader)s|%(title)s", 
            &url
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp Error: {}", err_msg.trim()));
    }

    let out_str = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = out_str.trim().splitn(3, '|').collect();

    if parts.len() >= 3 {
        let id = parts[0].to_string();
        let channel = parts[1].to_string();
        let title = parts[2].to_string(); 
        Ok(VideoEntry {
            id: id.clone(),
            title,
            channel,
            video_path: vid_dir.join(format!("{}.mp4", id)),
            thumbnail_path: thumb_dir.join(format!("{}.jpg", id)),
        })
    } else {
        Err(format!("Failed to parse metadata. Raw output: {}", out_str))
    }
}

#[tauri::command]
async fn download_video(app: AppHandle, url: String, metadata: VideoEntry, quality: String) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp_path, ffmpeg_path) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() || !ffmpeg_path.exists() {
        return Err("Binaries missing. Run setup.".into());
    }

    let base_dir = Path::new("/home/localghost/Videos/ViveStream");
    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");

    fs::create_dir_all(&vid_dir).unwrap();
    fs::create_dir_all(&thumb_dir).unwrap();

    let temp_path = vid_dir.join(format!("raw_{}.mp4", metadata.id));
    let final_path = metadata.video_path.clone();

    app.emit("download-progress", "Step 1: Downloading stream...").unwrap();
    
    let res_filter = match quality.as_str() {
        "720p" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "1080p" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "1440p" => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "4K" => "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "Best" => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        _ => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    };

    let mut child = Command::new(&ytdlp_path)
        .args([
            "--newline",
            "-f", res_filter,
            // Purged android, ios, and web. Restricted entirely to safe workarounds.
            "--extractor-args", "youtube:player_client=web_safari,web_embedded", 
            "--merge-output-format", "mp4",
            "--remux-video", "mp4", 
            "--paths", vid_dir.to_str().unwrap(),
            "--paths", &format!("thumbnail:{}", thumb_dir.to_str().unwrap()),
            "-o", "raw_%(id)s.%(ext)s", 
            "--write-thumbnail",
            "--convert-thumbnails", "jpg",
            &url
        ])
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        if let Ok(line) = line {
            app.emit("download-progress", line).unwrap();
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("yt-dlp download failed. Check the logs for details.".into());
    }

    let raw_thumb = thumb_dir.join(format!("raw_{}.jpg", metadata.id));
    let final_thumb = metadata.thumbnail_path.clone();
    let _ = fs::rename(&raw_thumb, &final_thumb);

    app.emit("download-progress", "Step 2: Starting FFmpeg transcoder...").unwrap();

    let encoders = vec![
        ("Intel QSV", vec!["-c:v", "h264_qsv", "-preset", "fast", "-b:v", "5M"]),
        ("NVIDIA NVENC", vec!["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "5M"]),
        ("VAAPI (AMD/Generic Linux)", vec!["-vaapi_device", "/dev/dri/renderD128", "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi", "-b:v", "5M"]),
        ("CPU (libx264)", vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]),
    ];

    let mut transcode_success = false;

    for (name, args) in encoders {
        app.emit("download-progress", format!("Attempting encoder: {}", name)).unwrap();

        let mut cmd = Command::new(&ffmpeg_path); 
        cmd.args(["-y", "-hwaccel", "auto", "-i", temp_path.to_str().unwrap()]);
        cmd.args(&args);
        cmd.args(["-c:a", "aac", "-movflags", "+faststart", final_path.to_str().unwrap()]);

        let output = cmd.output().map_err(|e| e.to_string())?;

        if output.status.success() {
            app.emit("download-progress", format!("Success! Transcoded via: {}", name)).unwrap();
            transcode_success = true;
            break;
        } else {
            app.emit("download-progress", format!("Encoder {} failed, dropping to next fallback...", name)).unwrap();
        }
    }

    let _ = fs::remove_file(&temp_path);

    if !transcode_success {
        return Err("All hardware and software FFmpeg encoders failed.".into());
    }

    let db_path = base_dir.join("db.json");
    let mut entries: Vec<VideoEntry> = if Path::new(&db_path).exists() {
        let data = fs::read_to_string(&db_path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_else(|_| vec![])
    } else {
        vec![]
    };

    entries.retain(|e| e.id != metadata.id);
    entries.push(metadata);

    let json = serde_json::to_string_pretty(&entries).unwrap();
    fs::write(db_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_downloaded_videos() -> Result<Vec<VideoEntry>, String> {
    let base_dir = Path::new("/home/localghost/Videos/ViveStream");
    let db_path = base_dir.join("db.json");
    if Path::new(&db_path).exists() {
        let data = fs::read_to_string(db_path).unwrap_or_default();
        let entries: Vec<VideoEntry> = serde_json::from_str(&data).unwrap_or_else(|_| vec![]);
        Ok(entries)
    } else {
        Ok(vec![])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port_free = {
        std::net::TcpListener::bind("127.0.0.1:1422").is_ok()
    };

    if port_free {
        tauri::async_runtime::spawn(async {
            let cors = warp::cors()
                .allow_any_origin()
                .allow_methods(vec!["GET", "HEAD"]);
                
            let routes = warp::fs::dir("/home/localghost/Videos/ViveStream").with(cors);
            warp::serve(routes).run(([127, 0, 0, 1], 1422)).await;
        });
    } else {
        println!("Port 1422 is already actively bound. Skipping duplicate warp server start.");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init()) 
        .invoke_handler(tauri::generate_handler![
            check_binaries, 
            download_binaries, 
            get_video_metadata, 
            download_video, 
            get_downloaded_videos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
