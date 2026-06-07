mod db;
mod downloader;
mod media_controls;
mod models;
mod system;

use db::*;
use downloader::*;
use media_controls::*;
use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, PlatformConfig};
use std::sync::Mutex;
use system::*;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Err(e) = init_db(&app_handle) {
                eprintln!("Database initialization error: {}", e);
            }

            if let Some(icon) = app.default_window_icon() {
                let handle = app.handle().clone();
                let _ = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .tooltip("ViveStream")
                    .on_tray_icon_event(move |tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(&handle);
            }

            #[cfg(target_os = "windows")]
            let hwnd = Some(
                app.get_webview_window("main").unwrap().hwnd().unwrap().0 as *mut std::ffi::c_void,
            );
            #[cfg(not(target_os = "windows"))]
            let hwnd = None;

            let config = PlatformConfig {
                dbus_name: "vivestream_next",
                display_name: "ViveStream",
                hwnd,
            };

            if let Ok(mut controls) = MediaControls::new(config) {
                let emit_handle = app.handle().clone();
                controls
                    .attach(move |event| match event {
                        MediaControlEvent::Play => {
                            let _ = emit_handle.emit("media-play", ());
                        }
                        MediaControlEvent::Pause => {
                            let _ = emit_handle.emit("media-pause", ());
                        }
                        MediaControlEvent::Next => {
                            let _ = emit_handle.emit("media-next", ());
                        }
                        MediaControlEvent::Previous => {
                            let _ = emit_handle.emit("media-prev", ());
                        }
                        _ => {}
                    })
                    .unwrap();

                let _ = controls.set_metadata(MediaMetadata {
                    title: Some("ViveStream Idle"),
                    ..Default::default()
                });

                app.manage(Mutex::new(controls));
            }

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_binaries,
            download_binaries,
            get_video_metadata,
            download_video,
            get_downloaded_videos,
            check_favorite,
            toggle_favorite,
            get_favorites,
            get_artists,
            get_videos_by_artist,
            create_playlist,
            get_playlists,
            delete_playlist,
            add_video_to_playlist,
            remove_video_from_playlist,
            get_playlist_videos,
            wipe_dependencies,
            clean_database_and_media,
            nuclear_wipe,
            reindex_library,
            update_media_metadata,
            update_playback_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
