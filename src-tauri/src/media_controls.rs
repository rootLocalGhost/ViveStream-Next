use souvlaki::{MediaControls, MediaMetadata, MediaPlayback};
use std::sync::Mutex;

#[tauri::command]
pub fn update_media_metadata(
    state: tauri::State<'_, Mutex<MediaControls>>,
    title: String,
    artist: String,
) -> Result<(), String> {
    if let Ok(mut controls) = state.lock() {
        let _ = controls.set_metadata(MediaMetadata {
            title: Some(&title),
            artist: Some(&artist),
            ..Default::default()
        });
    }
    Ok(())
}

#[tauri::command]
pub fn update_playback_status(
    state: tauri::State<'_, Mutex<MediaControls>>,
    playing: bool,
) -> Result<(), String> {
    if let Ok(mut controls) = state.lock() {
        let _ = controls.set_playback(if playing {
            MediaPlayback::Playing { progress: None }
        } else {
            MediaPlayback::Paused { progress: None }
        });
    }
    Ok(())
}
