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

    #[cfg(target_os = "windows")]
    let ffprobe = bin_dir.join("ffprobe.exe");
    #[cfg(not(target_os = "windows"))]
    let ffprobe = bin_dir.join("ffprobe");

    Ok(BinaryCheckStatus {
        ytdlp_exists: ytdlp.exists(),
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
        .connect_timeout(std::time::Duration::from_secs(15)) // FIXED: Removed overall timeout to prevent stream drop
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
    let ytdlp_res = client
        .get(ytdlp_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !ytdlp_res.status().is_success() {
        return Err(format!(
            "Failed to fetch yt-dlp: HTTP {}",
            ytdlp_res.status()
        ));
    }

    let bytes = ytdlp_res.bytes().await.map_err(|e| e.to_string())?;

    emit_progress("Validating yt-dlp SHA256 checksum...");

    let sums_url =
        "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA2-256SUMS";
    let sums_res = client
        .get(sums_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !sums_res.status().is_success() {
        return Err(format!("Failed to fetch hash: HTTP {}", sums_res.status()));
    }
    let sums_text = sums_res.text().await.unwrap_or_default();

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

    if !res.status().is_success() {
        return Err(format!("Failed to fetch FFmpeg: HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);

    let mut downloaded: u64 = 0;
    #[cfg(target_os = "windows")]
    let temp_path = bin_dir.join("ffmpeg_temp.zip");
    #[cfg(not(target_os = "windows"))]
    let temp_path = bin_dir.join("ffmpeg_temp.tar.xz");

    let mut temp_file = File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut last_emit = Instant::now();
    let mut ffmpeg_hasher = Sha256::new();

    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        ffmpeg_hasher.update(&chunk);
        temp_file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 && last_emit.elapsed().as_millis() > 150 {
            let percent = (downloaded as f64 / total_size as f64) * 100.0;
            emit_progress(&format!("[PROGRESS] {:.1}", percent));
            last_emit = Instant::now();
        }
    }

    let actual_ffmpeg_hash = format!("{:x}", ffmpeg_hasher.finalize());
    let expected_ffmpeg_hash_res = client.get(&format!("{}.sha256", ffmpeg_url)).send().await;

    if let Ok(hash_resp) = expected_ffmpeg_hash_res {
        if hash_resp.status().is_success() {
            let full_text = hash_resp.text().await.unwrap_or_default();
            let expected_hash = full_text
                .split_whitespace()
                .next()
                .ok_or("Empty or invalid SHA256 file format from server")?
                .to_string();

            if !expected_hash.is_empty() && expected_hash != actual_ffmpeg_hash {
                let _ = fs::remove_file(&temp_path);
                return Err(format!("SECURITY FAULT: FFmpeg checksum mismatch!"));
            }
        } else {
            let _ = fs::remove_file(&temp_path);
            return Err(format!(
                "SECURITY FAULT: Failed to fetch hash, server returned HTTP {}",
                hash_resp.status()
            ));
        }
    } else {
        let _ = fs::remove_file(&temp_path);
        return Err(format!(
            "SECURITY FAULT: Network error fetching FFmpeg hash."
        ));
    }

    emit_progress(&format!("[PROGRESS] 100.0"));
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
                    let file_name = std::path::Path::new(name).file_name().unwrap();
                    let mut outfile =
                        File::create(bin_dir.join(file_name)).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let file = File::open(&temp_path).map_err(|e| e.to_string())?;
        use tar::Archive;
        use xz2::read::XzDecoder;
        let mut archive = Archive::new(XzDecoder::new(file));

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
                        let mut perms = fs::metadata(&outpath)
                            .map_err(|e| e.to_string())?
                            .permissions();
                        perms.set_mode(0o755);
                        fs::set_permissions(&outpath, perms).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
    }

    let _ = fs::remove_file(temp_path);
    emit_progress("[RESTART]");

    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(4));
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
    let av_dir = base_dir.join("Avatars");
    let desc_dir = base_dir.join("Descriptions");

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
            let id = parts[0].to_string();
            let channel = parts[1].to_string();
            entries.push(VideoEntry {
                id: id.clone(),
                title: parts[2].to_string(),
                channel: channel.clone(),
                video_path: vid_dir
                    .join(format!("{}.mp4", id))
                    .to_string_lossy()
                    .into_owned(),
                thumbnail_path: thumb_dir
                    .join(format!("{}.jpg", id))
                    .to_string_lossy()
                    .into_owned(),
                avatar_path: av_dir
                    .join(format!("{}.jpg", channel))
                    .to_string_lossy()
                    .into_owned(),
                subtitle_path: vid_dir
                    .join(format!("{}.vtt", id))
                    .to_string_lossy()
                    .into_owned(),
                desc_path: desc_dir
                    .join(format!("{}.txt", id))
                    .to_string_lossy()
                    .into_owned(),
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
    let final_path = std::path::PathBuf::from(&metadata.video_path);
    let progress_event = format!("download-progress-{}", metadata.id);

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

    if concurrent_fragments > 1 {
        yt_args.push("--concurrent-fragments".to_string());
        yt_args.push(concurrent_fragments.to_string());
    }

    if !speed_limit.is_empty() {
        yt_args.push("--limit-rate".to_string());
        yt_args.push(speed_limit.clone());
    }

    if auto_subs {
        yt_args.push("--write-auto-subs".to_string());
    }
    if dl_subs {
        yt_args.push("--write-subs".to_string());
    }

    if auto_subs || dl_subs {
        yt_args.push("--sub-langs".to_string());
        yt_args.push("en.*,en".to_string());
        yt_args.push("--convert-subs".to_string());
        yt_args.push("vtt".to_string());
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

    let final_sub_path = vid_dir.join(format!("{}.vtt", metadata.id));
    let mut sub_found = false;
    if let Ok(entries) = fs::read_dir(&vid_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().into_string().unwrap_or_default();
            if file_name.starts_with(&format!("raw_{}", metadata.id)) && file_name.ends_with(".vtt")
            {
                let _ = fs::rename(entry.path(), &final_sub_path);
                sub_found = true;
                break;
            }
        }
    }
    if !sub_found && !final_sub_path.exists() {
        let _ = fs::write(&final_sub_path, "WEBVTT\n\n");
    }

    let raw_thumb = thumb_dir.join(format!("raw_{}.jpg", metadata.id));
    let _ = fs::rename(&raw_thumb, &metadata.thumbnail_path);

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
                    "Intel QSV (AV1 - ARC Optimised)",
                    vec![
                        "-init_hw_device",
                        "qsv=hw",
                        "-filter_hw_device",
                        "hw",
                        "-c:v",
                        "av1_qsv",
                        "-preset",
                        "fast",
                        "-b:v",
                        "5M",
                    ],
                ),
                (
                    "Intel QSV (H.264 - ARC Optimised)",
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
                    "NVIDIA NVENC (H.264)",
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
                    "Intel QSV (AV1 - Linux ARC)",
                    vec![
                        "-init_hw_device",
                        "qsv=hw",
                        "-filter_hw_device",
                        "hw",
                        "-c:v",
                        "av1_qsv",
                        "-preset",
                        "fast",
                        "-b:v",
                        "5M",
                    ],
                ),
                (
                    "VAAPI (H.264 - Auto-node)",
                    vec![
                        "-hwaccel",
                        "vaapi",
                        "-hwaccel_output_format",
                        "vaapi",
                        "-c:v",
                        "h264_vaapi",
                        "-b:v",
                        "5M",
                    ],
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
        (&metadata.id, &metadata.title, &metadata.channel, &metadata.video_path, &metadata.thumbnail_path)).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
