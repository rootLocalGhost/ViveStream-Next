// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Force hardware accelerated compositor mode in WebKitGTK to ensure 60+ FPS rendering and GPU compositing
        if std::env::var("WEBKIT_FORCE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_FORCE_COMPOSITING_MODE", "1");
        }
        // Force dedicated GPU rasterization and thread pipeline
        if std::env::var("WEBKIT_GPU_POLICY").is_err() {
            std::env::set_var("WEBKIT_GPU_POLICY", "force");
        }
        // Fix WebKitGTK 2.40+ DMA-BUF renderer crashes on Wayland / Hyprland / EGL surfaceless allocation failures
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    vivestream_next_lib::run()
}
