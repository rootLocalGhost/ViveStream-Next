use crate::db::get_db_connection;
use std::fs;
use std::path::PathBuf;
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
    // Nuke the entire bin directory to cleanly remove Deno, plugins, and old executables
    if bin_dir.exists() {
        let _ = fs::remove_dir_all(&bin_dir);
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
        let _ = fs::remove_dir_all(&bin_dir);
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
