use crate::db::get_db_connection;
use crate::models::{BinaryCheckStatus, VideoEntry};
use crate::system::{get_base_dir, get_bin_dir};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Cursor, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

pub fn get_binary_paths(bin_dir: &Path) -> (PathBuf, PathBuf) {
    #[cfg(target_os = "windows")]
    return (bin_dir.join("yt-dlp.exe"), bin_dir.join("ffmpeg.exe"));
    #[cfg(not(target_os = "windows"))]
    return (bin_dir.join("yt-dlp"), bin_dir.join("ffmpeg"));
}

#[tauri::command]
pub async fn check_binaries(app: AppHandle) -> Result<BinaryCheckStatus, String> {
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp, ffmpeg) = get_binary_paths(&bin_dir);
    Ok(BinaryCheckStatus {
        ytdlp_exists: ytdlp.exists(),
        ffmpeg_exists: ffmpeg.exists(),
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
    let sums_url =
        "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA2-256SUMS";
    let sums_text = client
        .get(sums_url)
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
    let actual_hash = format!("{:x}", hasher.finalize());

    if expected_hash != actual_hash {
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

    emit_progress("Fetching compatible FFmpeg build...");

    #[cfg(target_os = "windows")]
    {
        let ffmpeg_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
        let bytes = client
            .get(ffmpeg_url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            if file.name().ends_with("ffmpeg.exe") && file.is_file() {
                let mut outfile =
                    File::create(bin_dir.join("ffmpeg.exe")).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                break;
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let ffmpeg_url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";
        let bytes = client
            .get(ffmpeg_url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;

        use tar::Archive;
        use xz2::read::XzDecoder;
        let mut archive = Archive::new(XzDecoder::new(Cursor::new(bytes)));

        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            if entry
                .path()
                .map_err(|e| e.to_string())?
                .file_name()
                .map_or(false, |name| name == "ffmpeg")
                && entry.header().entry_type().is_file()
            {
                let outpath = bin_dir.join("ffmpeg");
                entry.unpack(&outpath).map_err(|e| e.to_string())?;
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&outpath)
                    .map_err(|e| e.to_string())?
                    .permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&outpath, perms).map_err(|e| e.to_string())?;
                break;
            }
        }
    }

    emit_progress("FFmpeg ready.");
    app.dialog()
        .message("Deployment complete. ViveStream will now restart to initialize engines.")
        .kind(tauri_plugin_dialog::MessageDialogKind::Info)
        .show(move |_| {
            app.restart();
        });

    Ok(())
}

#[tauri::command]
pub async fn get_video_metadata(app: AppHandle, url: String) -> Result<Vec<VideoEntry>, String> {
    let bin_dir = get_bin_dir(&app)?;
    let base_dir = get_base_dir(&app)?;
    let (ytdlp_path, _) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() {
        return Err("yt-dlp binary missing.".into());
    }

    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");
    let mut cmd = Command::new(&ytdlp_path);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .args([
            "--force-ipv4",
            "--flat-playlist",
            "--extractor-args",
            "youtube:player_client=web_safari,web_embedded",
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
            entries.push(VideoEntry {
                id: parts[0].to_string(),
                channel: parts[1].to_string(),
                title: parts[2].to_string(),
                video_path: vid_dir.join(format!("{}.mp4", parts[0])),
                thumbnail_path: thumb_dir.join(format!("{}.jpg", parts[0])),
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
) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    let base_dir = get_base_dir(&app)?;
    let (ytdlp_path, ffmpeg_path) = get_binary_paths(&bin_dir);

    if !ytdlp_path.exists() || !ffmpeg_path.exists() {
        return Err("Binaries missing.".into());
    }

    let vid_dir = base_dir.join("Videos");
    let thumb_dir = base_dir.join("Thumbnails");
    let desc_dir = base_dir.join("Descriptions");
    let av_dir = base_dir.join("Avatars");

    fs::create_dir_all(&vid_dir).unwrap();
    fs::create_dir_all(&thumb_dir).unwrap();
    fs::create_dir_all(&desc_dir).unwrap();
    fs::create_dir_all(&av_dir).unwrap();

    let temp_path = vid_dir.join(format!("raw_{}.mp4", metadata.id));
    let final_path = metadata.video_path.clone();
    let progress_event = format!("download-progress-{}", metadata.id);

    let avatar_path = av_dir.join(format!("{}.jpg", metadata.channel));
    if !avatar_path.exists() {
        let _ = app.emit(&progress_event, "Fetching channel profile picture...");
        if let Ok(resp) =
            reqwest::get(format!("https://unavatar.io/youtube/{}", metadata.channel)).await
        {
            if let Ok(bytes) = resp.bytes().await {
                let _ = fs::write(&avatar_path, bytes);
            }
        }
    }

    let _ = app.emit(&progress_event, "Step 1: Downloading stream...");
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
        "--retries".to_string(),
        "10".to_string(),
        "--fragment-retries".to_string(),
        "10".to_string(),
        "--newline".to_string(),
        "-f".to_string(),
        res_filter,
        "--extractor-args".to_string(),
        "youtube:player_client=web_safari,web_embedded".to_string(),
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

    if !is_audio {
        yt_args.push("--merge-output-format".to_string());
        yt_args.push("mp4".to_string());
        yt_args.push("--remux-video".to_string());
        yt_args.push("mp4".to_string());
    }

    let cookies_lower = cookies.to_lowercase();
    if cookies != "none" && cookies != "" {
        yt_args.push("--cookies-from-browser".to_string());
        yt_args.push(cookies_lower);
    }

    yt_args.push(url);
    let mut yt_cmd = Command::new(&ytdlp_path);
    #[cfg(target_os = "windows")]
    yt_cmd.creation_flags(0x08000000);

    let mut child = yt_cmd
        .args(&yt_args)
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let reader = BufReader::new(child.stdout.take().unwrap());

    for line in reader.lines() {
        if let Ok(line) = line {
            let _ = app.emit(&progress_event, line);
        }
    }

    if !child.wait().map_err(|e| e.to_string())?.success() {
        return Err("yt-dlp download failed.".into());
    }

    let raw_thumb = thumb_dir.join(format!("raw_{}.jpg", metadata.id));
    let _ = fs::rename(&raw_thumb, &metadata.thumbnail_path);

    let raw_desc = vid_dir.join(format!("raw_{}.description", metadata.id));
    let final_desc = desc_dir.join(format!("{}.txt", metadata.id));
    if raw_desc.exists() {
        let _ = fs::rename(&raw_desc, &final_desc);
    } else {
        let _ = fs::write(&final_desc, "No description available.");
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
                    vec![
                        "-init_hw_device",
                        "qsv=hw",
                        "-filter_hw_device",
                        "hw",
                        "-c:v",
                        "h264_qsv",
                        "-preset",
                        "fast",
                        "-b:v",
                        "5M",
                    ],
                ),
                (
                    "NVIDIA NVENC",
                    vec!["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "5M"],
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
                        "5M",
                    ],
                ),
                (
                    "Intel QSV (Linux fallback)",
                    vec![
                        "-init_hw_device",
                        "qsv=hw",
                        "-filter_hw_device",
                        "hw",
                        "-c:v",
                        "h264_qsv",
                        "-preset",
                        "fast",
                        "-b:v",
                        "5M",
                    ],
                ),
                (
                    "NVIDIA NVENC",
                    vec!["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "5M"],
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
                .args(["-y", "-hwaccel", "auto", "-i", temp_path.to_str().unwrap()])
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
        (&metadata.id, &metadata.title, &metadata.channel, metadata.video_path.to_str().unwrap(), metadata.thumbnail_path.to_str().unwrap())).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
