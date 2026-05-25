use tauri::{AppHandle, Emitter};
use std::process::{Command, Stdio};
use std::io::{BufReader, BufRead};
use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};
use warp::Filter;

#[derive(Serialize, Deserialize, Clone)]
struct VideoEntry {
    id: String,
    title: String,
    channel: String,
    video_path: String,
    thumbnail_path: String,
}

#[tauri::command]
async fn get_video_metadata(url: String) -> Result<VideoEntry, String> {
    let output = Command::new("yt-dlp")
        .args(["--no-playlist", "--print", "%(id)s|%(uploader)s|%(title)s", &url])
        .output()
        .map_err(|e| e.to_string())?;

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
            video_path: format!("/home/localghost/Videos/ViveStream/Videos/{}.mp4", id),
            thumbnail_path: format!("/home/localghost/Videos/ViveStream/Thumbnails/{}.jpg", id),
        })
    } else {
        Err("Failed to parse video metadata. Is the URL valid?".into())
    }
}

#[tauri::command]
async fn download_video(app: AppHandle, url: String, metadata: VideoEntry, quality: String) -> Result<(), String> {
    let base_dir = "/home/localghost/Videos/ViveStream";
    let vid_dir = format!("{}/Videos", base_dir);
    let thumb_dir = format!("{}/Thumbnails", base_dir);

    fs::create_dir_all(&vid_dir).unwrap();
    fs::create_dir_all(&thumb_dir).unwrap();

    let temp_path = format!("{}/raw_{}.mp4", vid_dir, metadata.id);
    let final_path = format!("{}/{}.mp4", vid_dir, metadata.id);

    app.emit("download-progress", "Step 1: Downloading stream...").unwrap();
    
    // Automatically falls back to the next best resolution if the target doesn't exist
    let res_filter = match quality.as_str() {
        "720p" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "1080p" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "1440p" => "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "4K" => "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "Best" => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        _ => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    };

    let mut child = Command::new("yt-dlp")
        .args([
            "--newline",
            "-f", res_filter,
            "--merge-output-format", "mp4",
            "--remux-video", "mp4", 
            "--paths", &vid_dir,
            "--paths", &format!("thumbnail:{}", thumb_dir),
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
        return Err("yt-dlp download failed".into());
    }

    let raw_thumb = format!("{}/raw_{}.jpg", thumb_dir, metadata.id);
    let final_thumb = format!("{}/{}.jpg", thumb_dir, metadata.id);
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

        let mut cmd = Command::new("ffmpeg");
        cmd.args(["-y", "-hwaccel", "auto", "-i", &temp_path]);
        cmd.args(&args);
        cmd.args(["-c:a", "aac", "-movflags", "+faststart", &final_path]);

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

    let db_path = format!("{}/db.json", base_dir);
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
    let db_path = "/home/localghost/Videos/ViveStream/db.json";
    if Path::new(db_path).exists() {
        let data = fs::read_to_string(db_path).unwrap_or_default();
        let entries: Vec<VideoEntry> = serde_json::from_str(&data).unwrap_or_else(|_| vec![]);
        Ok(entries)
    } else {
        Ok(vec![])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::async_runtime::spawn(async {
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "HEAD"]);
            
        let routes = warp::fs::dir("/home/localghost/Videos/ViveStream").with(cors);
        warp::serve(routes).run(([127, 0, 0, 1], 1422)).await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_video_metadata, download_video, get_downloaded_videos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}