// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Disable WebKitGTK Bubblewrap sandbox to prevent spurious WebKitWebProcess seccomp crash traps on Arch Linux / Wayland / Hyprland
        if std::env::var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS").is_err() {
            std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");
        }
        // Force hardware accelerated compositor mode in WebKitGTK to ensure native display refresh rate (100Hz+)
        if std::env::var("WEBKIT_FORCE_COMPOSITING_MODE").is_err() {
            std::env::set_var("WEBKIT_FORCE_COMPOSITING_MODE", "1");
        }
        // Force dedicated GPU rasterization and thread pipeline
        if std::env::var("WEBKIT_GPU_POLICY").is_err() {
            std::env::set_var("WEBKIT_GPU_POLICY", "force");
        }
        // Uncap GTK frame clock to match high refresh rate monitor (100Hz, 120Hz, 144Hz+)
        if std::env::var("GDK_FRAME_CLOCK_FPS").is_err() {
            std::env::set_var("GDK_FRAME_CLOCK_FPS", "0");
        }
        // Enable DMA-BUF hardware acceleration by default for zero-copy GPU compositing.
        // If running in a virtual machine or troubled environment, user can set VIVESTREAM_SAFE_GRAPHICS=1.
        if let Ok(safe) = std::env::var("VIVESTREAM_SAFE_GRAPHICS") {
            if safe == "1" {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
    }

    vivestream_next_lib::run()
}
