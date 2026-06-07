use crate::db::get_db_connection;
use std::fs;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

pub fn get_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let video_dir = app.path().video_dir().map_err(|e| e.to_string())?;
    Ok(video_dir.join("ViveStream"))
}

pub fn get_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data.join("bin"))
}

#[tauri::command]
pub async fn wipe_dependencies(app: AppHandle) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    if bin_dir.exists() {
        let _ = fs::remove_file(bin_dir.join("yt-dlp"));
        let _ = fs::remove_file(bin_dir.join("yt-dlp.exe"));
        let _ = fs::remove_file(bin_dir.join("ffmpeg"));
        let _ = fs::remove_file(bin_dir.join("ffmpeg.exe"));
        let _ = fs::remove_file(bin_dir.join("ffprobe"));
        let _ = fs::remove_file(bin_dir.join("ffprobe.exe"));
    }
    Ok(())
}

#[tauri::command]
pub async fn clean_database_and_media(app: AppHandle) -> Result<(), String> {
    if let Ok(conn) = get_db_connection(&app) {
        let _ = conn.execute_batch("DELETE FROM Playlist_Videos; DELETE FROM Playlists; DELETE FROM Videos; DELETE FROM Artists;");
    }
    let base_dir = get_base_dir(&app)?;
    if base_dir.exists() {
        let _ = fs::remove_dir_all(base_dir.join("Videos"));
        let _ = fs::remove_dir_all(base_dir.join("Thumbnails"));
        let _ = fs::remove_dir_all(base_dir.join("Descriptions"));
        let _ = fs::remove_dir_all(base_dir.join("Avatars"));
    }
    Ok(())
}

#[tauri::command]
pub async fn nuclear_wipe(app: AppHandle) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    if bin_dir.exists() {
        let _ = fs::remove_file(bin_dir.join("yt-dlp"));
        let _ = fs::remove_file(bin_dir.join("yt-dlp.exe"));
        let _ = fs::remove_file(bin_dir.join("ffmpeg"));
        let _ = fs::remove_file(bin_dir.join("ffmpeg.exe"));
        let _ = fs::remove_file(bin_dir.join("ffprobe"));
        let _ = fs::remove_file(bin_dir.join("ffprobe.exe"));
    }
    if let Ok(conn) = get_db_connection(&app) {
        let _ = conn.execute_batch("DELETE FROM Playlist_Videos; DELETE FROM Playlists; DELETE FROM Videos; DELETE FROM Artists;");
    }
    let base_dir = get_base_dir(&app)?;
    if base_dir.exists() {
        let _ = fs::remove_dir_all(base_dir.join("Videos"));
        let _ = fs::remove_dir_all(base_dir.join("Thumbnails"));
        let _ = fs::remove_dir_all(base_dir.join("Descriptions"));
        let _ = fs::remove_dir_all(base_dir.join("Avatars"));
    }
    Ok(())
}

#[tauri::command]
pub async fn reindex_library(app: AppHandle) -> Result<String, String> {
    let base_dir = get_base_dir(&app)?;
    let bin_dir = get_bin_dir(&app)?;
    let (ytdlp_path, _) = crate::downloader::get_binary_paths(&bin_dir);
    let vid_dir = base_dir.join("Videos");

    if !vid_dir.exists() {
        return Ok("No video directory found. Database matches clean state.".into());
    }

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
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM Videos WHERE id = ?1 AND title IS NOT NULL AND channel_name IS NOT NULL",
                [id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if count == 0 {
            missing_metadata_ids.push(id.clone());
        }
    }

    if !missing_metadata_ids.is_empty() && ytdlp_path.exists() {
        for chunk in missing_metadata_ids.chunks(20) {
            let mut cmd = Command::new(&ytdlp_path);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000);

            cmd.arg("--force-ipv4");
            cmd.arg("--flat-playlist");
            cmd.args([
                "--extractor-args",
                "youtube:player_client=web_safari,web_embedded",
            ]);
            cmd.args(["--print", "%(id)s|%(uploader)s|%(title)s"]);

            for id in chunk {
                cmd.arg(format!("https://www.youtube.com/watch?v={}", id));
            }

            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    let tx = conn.transaction().map_err(|e| e.to_string())?;
                    for line in out_str.lines() {
                        let parts: Vec<&str> = line.splitn(3, '|').collect();
                        if parts.len() == 3 {
                            let id = parts[0];
                            let channel = parts[1];
                            let title = parts[2];
                            let video_path = vid_dir.join(format!("{}.mp4", id));
                            let thumbnail_path =
                                base_dir.join("Thumbnails").join(format!("{}.jpg", id));

                            let _ = tx.execute(
                                "INSERT OR IGNORE INTO Artists (name, avatar_path) VALUES (?1, ?2)",
                                [channel, &format!("{}.jpg", channel)],
                            );
                            let _ = tx.execute(
                                "INSERT INTO Videos (id, title, channel_name, video_path, thumbnail_path, is_favorite) 
                                 VALUES (?1, ?2, ?3, ?4, ?5, 0) 
                                 ON CONFLICT(id) DO UPDATE SET title = excluded.title, channel_name = excluded.channel_name, video_path = excluded.video_path",
                                (id, title, channel, video_path.to_str().unwrap(), thumbnail_path.to_str().unwrap()),
                            );
                        }
                    }
                    tx.commit().map_err(|e| e.to_string())?;
                }
            }
        }
    }

    let _ = conn.execute(
        "DELETE FROM Artists WHERE name NOT IN (SELECT DISTINCT channel_name FROM Videos WHERE channel_name IS NOT NULL)",
        [],
    );

    Ok(format!(
        "Successfully indexed database logic. Verified {} files.",
        physical_ids.len()
    ))
}
