mod db;
mod downloader;
mod media_controls;
mod models;
mod server;
mod system;

#[cfg(test)]
mod tests; // Added tests module

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

#[cfg(target_os = "linux")]
fn suppress_ayatana_warnings() {
    unsafe {
        extern "C" fn dummy_log_handler(
            _log_domain: *const std::os::raw::c_char,
            _log_level: i32,
            _message: *const std::os::raw::c_char,
            _user_data: *mut std::ffi::c_void,
        ) {}

        extern "C" {
            fn g_log_set_handler(
                log_domain: *const std::os::raw::c_char,
                log_levels: i32,
                log_func: Option<
                    unsafe extern "C" fn(
                        *const std::os::raw::c_char,
                        i32,
                        *const std::os::raw::c_char,
                        *mut std::ffi::c_void,
                    ),
                >,
                user_data: *mut std::ffi::c_void,
            ) -> u32;
        }

        if let Ok(domain) = std::ffi::CString::new("libayatana-appindicator") {
            g_log_set_handler(
                domain.as_ptr(),
                0xFF,
                Some(dummy_log_handler),
                std::ptr::null_mut(),
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    suppress_ayatana_warnings();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            if let Err(e) = init_db(&app_handle) {
                eprintln!("Database initialization error: {}", e);
            }

            let server_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(base_dir) = crate::system::get_base_dir(&server_handle) {
                    crate::server::start_server(base_dir).await;
                }
            });

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
            update_playback_status,
            update_video_added_at,
            update_video_details,
            update_playlist_title,
            update_playlist_order,
            upload_artist_avatar,
            upload_playlist_cover,
            upload_playlist_banner,
            delete_video,
            get_download_history,
            clear_download_history_db,
            delete_download_history_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
