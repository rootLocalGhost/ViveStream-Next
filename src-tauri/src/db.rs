use crate::models::{ArtistEntry, Playlist, VideoEntry};
use crate::system::get_base_dir;
use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub fn get_db_connection(app: &AppHandle) -> Result<Connection, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let db_path = config_dir.join("ViveStream-Next.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app)?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS Artists (
            name TEXT PRIMARY KEY,
            avatar_path TEXT
        );
        CREATE TABLE IF NOT EXISTS Videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            channel_name TEXT,
            video_path TEXT NOT NULL,
            thumbnail_path TEXT,
            is_favorite BOOLEAN DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(channel_name) REFERENCES Artists(name)
        );
        CREATE TABLE IF NOT EXISTS Playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS Playlist_Videos (
            playlist_id TEXT,
            video_id TEXT,
            sort_order INTEGER,
            PRIMARY KEY (playlist_id, video_id),
            FOREIGN KEY(playlist_id) REFERENCES Playlists(id) ON DELETE CASCADE,
            FOREIGN KEY(video_id) REFERENCES Videos(id) ON DELETE CASCADE
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn map_video_row(
    row: &rusqlite::Row,
    base_dir: &std::path::Path,
) -> Result<VideoEntry, rusqlite::Error> {
    let id: String = row.get(0)?;
    let channel: String = row.get(2)?;

    // [IMPROVEMENT]: Dynamically reconstruct paths based on the current OS `base_dir`
    // instead of relying on the static string stored in the database at the time of download.
    // This allows the user to safely migrate their OS drive without breaking the library.
    let stored_video_path: String = row.get(3)?;
    let ext = std::path::Path::new(&stored_video_path)
        .extension()
        .unwrap_or(std::ffi::OsStr::new("mp4"))
        .to_string_lossy();

    let video_path = base_dir
        .join("Videos")
        .join(format!("{}.{}", id, ext))
        .to_string_lossy()
        .into_owned();

    let thumbnail_path = base_dir
        .join("Thumbnails")
        .join(format!("{}.jpg", id))
        .to_string_lossy()
        .into_owned();

    let subtitle_path = base_dir
        .join("Videos")
        .join(format!("{}.vtt", id))
        .to_string_lossy()
        .into_owned();

    let avatar_path = base_dir
        .join("Avatars")
        .join(format!("{}.jpg", channel))
        .to_string_lossy()
        .into_owned();

    let desc_path = base_dir
        .join("Descriptions")
        .join(format!("{}.txt", id))
        .to_string_lossy()
        .into_owned();

    Ok(VideoEntry {
        id,
        title: row.get(1)?,
        channel,
        video_path,
        thumbnail_path,
        avatar_path,
        subtitle_path,
        desc_path,
    })
}

#[tauri::command]
pub async fn get_downloaded_videos(app: AppHandle) -> Result<Vec<VideoEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let base_dir = get_base_dir(&app)?;
        let mut stmt = conn.prepare("SELECT id, title, channel_name, video_path, thumbnail_path FROM Videos ORDER BY added_at DESC").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| map_video_row(row, &base_dir))
            .map_err(|e| e.to_string())?;
        let mut videos = Vec::new();
        for video in iter {
            videos.push(video.map_err(|e| e.to_string())?);
        }
        Ok(videos)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn check_favorite(app: AppHandle, id: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let mut stmt = conn
            .prepare("SELECT is_favorite FROM Videos WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let is_fav: i32 = stmt.query_row([&id], |row| row.get(0)).unwrap_or(0);
        Ok(is_fav == 1)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn toggle_favorite(app: AppHandle, id: String, is_favorite: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let fav_int = if is_favorite { 1 } else { 0 };
        conn.execute(
            "UPDATE Videos SET is_favorite = ?1 WHERE id = ?2",
            rusqlite::params![fav_int, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_favorites(app: AppHandle) -> Result<Vec<VideoEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let base_dir = get_base_dir(&app)?;
        let mut stmt = conn.prepare("SELECT id, title, channel_name, video_path, thumbnail_path FROM Videos WHERE is_favorite = 1 ORDER BY added_at DESC").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| map_video_row(row, &base_dir))
            .map_err(|e| e.to_string())?;
        let mut videos = Vec::new();
        for video in iter {
            videos.push(video.map_err(|e| e.to_string())?);
        }
        Ok(videos)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_artists(app: AppHandle) -> Result<Vec<ArtistEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let base_dir = get_base_dir(&app)?;
        let mut stmt = conn
            .prepare("SELECT name FROM Artists ORDER BY name ASC")
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let avatar_path = base_dir
                    .join("Avatars")
                    .join(format!("{}.jpg", name))
                    .to_string_lossy()
                    .into_owned();
                Ok(ArtistEntry { name, avatar_path })
            })
            .map_err(|e| e.to_string())?;
        let mut artists = Vec::new();
        for a in iter {
            artists.push(a.map_err(|e| e.to_string())?);
        }
        Ok(artists)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_videos_by_artist(app: AppHandle, name: String) -> Result<Vec<VideoEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let base_dir = get_base_dir(&app)?;
        let mut stmt = conn.prepare("SELECT id, title, channel_name, video_path, thumbnail_path FROM Videos WHERE channel_name = ?1 ORDER BY added_at DESC").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map(rusqlite::params![name], |row| map_video_row(row, &base_dir))
            .map_err(|e| e.to_string())?;
        let mut videos = Vec::new();
        for video in iter {
            videos.push(video.map_err(|e| e.to_string())?);
        }
        Ok(videos)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_playlist(app: AppHandle, name: String) -> Result<Playlist, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            .to_string();
        conn.execute(
            "INSERT INTO Playlists (id, name) VALUES (?1, ?2)",
            rusqlite::params![id, name],
        )
        .map_err(|e| e.to_string())?;
        Ok(Playlist {
            id,
            name,
            created_at: "Just now".to_string(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_playlists(app: AppHandle) -> Result<Vec<Playlist>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let mut stmt = conn.prepare("SELECT id, name, DATETIME(created_at, 'localtime') FROM Playlists ORDER BY created_at DESC").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(Playlist {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut lists = Vec::new();
        for list in iter {
            lists.push(list.map_err(|e| e.to_string())?);
        }
        Ok(lists)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_playlist(app: AppHandle, playlist_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        conn.execute(
            "DELETE FROM Playlists WHERE id = ?1",
            rusqlite::params![playlist_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_video_to_playlist(
    app: AppHandle,
    playlist_id: String,
    video_id: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let sort_order: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM Playlist_Videos WHERE playlist_id = ?1",
                rusqlite::params![playlist_id],
                |row| row.get(0),
            )
            .unwrap_or(1);
        conn.execute(
            "INSERT OR IGNORE INTO Playlist_Videos (playlist_id, video_id, sort_order) VALUES (?1, ?2, ?3)",
            rusqlite::params![playlist_id, video_id, sort_order],
        ).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_video_from_playlist(
    app: AppHandle,
    playlist_id: String,
    video_id: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        conn.execute(
            "DELETE FROM Playlist_Videos WHERE playlist_id = ?1 AND video_id = ?2",
            rusqlite::params![playlist_id, video_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_playlist_videos(
    app: AppHandle,
    playlist_id: String,
) -> Result<Vec<VideoEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let conn = get_db_connection(&app)?;
        let base_dir = get_base_dir(&app)?;
        let mut stmt = conn
            .prepare(
                "SELECT v.id, v.title, v.channel_name, v.video_path, v.thumbnail_path 
                 FROM Videos v INNER JOIN Playlist_Videos pv ON v.id = pv.video_id 
                 WHERE pv.playlist_id = ?1 ORDER BY pv.sort_order ASC",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map(rusqlite::params![playlist_id], |row| {
                map_video_row(row, &base_dir)
            })
            .map_err(|e| e.to_string())?;
        let mut videos = Vec::new();
        for video in iter {
            videos.push(video.map_err(|e| e.to_string())?);
        }
        Ok(videos)
    })
    .await
    .map_err(|e| e.to_string())?
}
