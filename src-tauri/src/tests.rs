#[cfg(test)]
mod tests {
    use crate::downloader::get_binary_paths;
    use crate::models::VideoEntry;
    use std::path::PathBuf;

    #[test]
    fn test_get_binary_paths() {
        let bin_dir = PathBuf::from("/mock/bin/folder");
        let (ytdlp, ffmpeg) = get_binary_paths(&bin_dir);

        #[cfg(target_os = "windows")]
        {
            assert_eq!(ytdlp, bin_dir.join("yt-dlp.exe"));
            assert_eq!(ffmpeg, bin_dir.join("ffmpeg.exe"));
        }

        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(ytdlp, bin_dir.join("yt-dlp"));
            assert_eq!(ffmpeg, bin_dir.join("ffmpeg"));
        }
    }

    #[test]
    fn test_video_entry_serialization() {
        let entry = VideoEntry {
            id: "123".to_string(),
            title: "Test Video".to_string(),
            channel: "Test Channel".to_string(),
            video_path: "/videos/123.mp4".to_string(),
            thumbnail_path: "/thumbs/123.jpg".to_string(),
            avatar_path: "/avatars/Test Channel.jpg".to_string(),
            subtitle_path: "/videos/123.vtt".to_string(),
            desc_path: "/descriptions/123.txt".to_string(),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("123"));
        assert!(json.contains("Test Video"));
        assert!(json.contains("Test Channel"));
    }
}
