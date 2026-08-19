use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct VideoEntry {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub video_path: String,
    pub thumbnail_path: String,
    pub avatar_path: String,
    pub subtitle_path: String,
    pub desc_path: String,
}

#[derive(Serialize)]
pub struct VideoMetadataResponse {
    pub playlist_title: Option<String>,
    pub entries: Vec<VideoEntry>,
}

#[derive(Serialize)]
pub struct ArtistEntry {
    pub name: String,
    pub avatar_path: String,
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
    pub bin_folder: std::path::PathBuf,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DownloadHistoryEntry {
    pub id: String,
    pub video_id: String,
    pub title: String,
    pub channel: String,
    pub url: String,
    pub status: String,
    pub dl_type: String,
    pub error_msg: Option<String>,
    pub created_at: String,
}
