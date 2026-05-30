use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct VideoEntry {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub video_path: PathBuf,
    pub thumbnail_path: PathBuf,
}

#[derive(Serialize)]
pub struct ArtistEntry {
    pub name: String,
}

#[derive(Serialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct BinaryCheckStatus {
    pub ytdlp_exists: bool,
    pub ffmpeg_exists: bool,
    pub bin_folder: PathBuf,
}
