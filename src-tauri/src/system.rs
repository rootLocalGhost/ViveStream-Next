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

#[tauri::command]
pub async fn get_clipboard_text() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.get_text().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_clipboard_text(text: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct PaletteResult {
    pub dominant: String,
    pub palette: Vec<String>,
}

#[tauri::command]
pub async fn extract_video_dominant_colors(
    app: AppHandle,
    video_id: String,
    timestamp: f64,
) -> Result<PaletteResult, String> {
    let base_dir = get_base_dir(&app)?;
    let video_path = base_dir.join("Videos").join(format!("{}.mp4", video_id));
    if !video_path.exists() {
        return Ok(PaletteResult {
            dominant: "#f25c54".to_string(),
            palette: vec![
                "#f25c54".to_string(),
                "#ef233c".to_string(),
                "#3b82f6".to_string(),
                "#10b981".to_string(),
                "#a855f7".to_string(),
            ],
        });
    }

    let bin_dir = get_bin_dir(&app)?;
    let ffmpeg_bin = bin_dir.join("ffmpeg");
    let ffmpeg_cmd = if ffmpeg_bin.exists() {
        ffmpeg_bin.to_string_lossy().to_string()
    } else {
        "ffmpeg".to_string()
    };

    tokio::task::spawn_blocking(move || {
        let ts_str = format!("{:.3}", timestamp.max(0.0));
        let output = std::process::Command::new(ffmpeg_cmd)
            .args([
                "-ss",
                &ts_str,
                "-i",
                &video_path.to_string_lossy(),
                "-vframes",
                "1",
                "-vf",
                "scale=48:27",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgb24",
                "pipe:1",
            ])
            .output()
            .map_err(|e| e.to_string())?;

        let bytes = output.stdout;
        if bytes.len() < 48 * 27 * 3 {
            return Ok(PaletteResult {
                dominant: "#f25c54".to_string(),
                palette: vec![
                    "#f25c54".to_string(),
                    "#ef233c".to_string(),
                    "#3b82f6".to_string(),
                    "#10b981".to_string(),
                    "#a855f7".to_string(),
                ],
            });
        }

        use std::collections::HashMap;
        // (count, sum_r, sum_g, sum_b)
        let mut buckets: HashMap<(u8, u8, u8), (usize, usize, usize, usize)> = HashMap::new();

        for chunk in bytes.chunks_exact(3) {
            let r = chunk[0];
            let g = chunk[1];
            let b = chunk[2];

            // Ignore pure black letterbox pixels
            if r < 16 && g < 16 && b < 16 {
                continue;
            }

            let qr = ((r as f32 / 32.0).floor() * 32.0 + 16.0).min(255.0) as u8;
            let qg = ((g as f32 / 32.0).floor() * 32.0 + 16.0).min(255.0) as u8;
            let qb = ((b as f32 / 32.0).floor() * 32.0 + 16.0).min(255.0) as u8;

            let entry = buckets.entry((qr, qg, qb)).or_insert((0, 0, 0, 0));
            entry.0 += 1;
            entry.1 += r as usize;
            entry.2 += g as usize;
            entry.3 += b as usize;
        }

        if buckets.is_empty() {
            return Ok(PaletteResult {
                dominant: "#f25c54".to_string(),
                palette: vec![
                    "#f25c54".to_string(),
                    "#ef233c".to_string(),
                    "#3b82f6".to_string(),
                    "#10b981".to_string(),
                    "#a855f7".to_string(),
                ],
            });
        }

        let mut sorted: Vec<_> = buckets
            .into_values()
            .map(|(count, sum_r, sum_g, sum_b)| {
                let r = (sum_r / count) as u8;
                let g = (sum_g / count) as u8;
                let b = (sum_b / count) as u8;
                let rn = r as f32 / 255.0;
                let gn = g as f32 / 255.0;
                let bn = b as f32 / 255.0;
                let max = rn.max(gn).max(bn);
                let min = rn.min(gn).min(bn);
                let chroma = max - min;
                let lightness = (max + min) / 2.0;
                let value = max;
                let hsv_saturation = if max == 0.0 { 0.0 } else { chroma / max };

                let is_washed_out_white = value > 0.78 && hsv_saturation < 0.35;
                let glare_penalty = if is_washed_out_white { 0.15 } else { 1.0 };
                let is_mud = value < 0.10 && chroma < 0.06;
                let mud_penalty = if is_mud { 0.20 } else { 1.0 };

                let sat_weight = 0.25 + hsv_saturation.powf(1.4) * 2.8 + chroma * 1.5;
                let light_weight = (1.0 - (lightness - 0.5).abs() * 0.8).max(0.5);
                let score = (count as f32).powf(1.2) * sat_weight * light_weight * glare_penalty * mud_penalty;
                (score, count, r, g, b)
            })
            .collect();
        sorted.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let dominant = format!("#{:02x}{:02x}{:02x}", sorted[0].2, sorted[0].3, sorted[0].4);
        let mut palette = Vec::new();

        for item in sorted {
            let hex = format!("#{:02x}{:02x}{:02x}", item.2, item.3, item.4);
            let is_distinct = palette.iter().all(|existing: &String| {
                if let (Ok(er), Ok(eg), Ok(eb)) = (
                    u8::from_str_radix(&existing[1..3], 16),
                    u8::from_str_radix(&existing[3..5], 16),
                    u8::from_str_radix(&existing[5..7], 16),
                ) {
                    let dr = (item.2 as f32 - er as f32).powi(2);
                    let dg = (item.3 as f32 - eg as f32).powi(2);
                    let db = (item.4 as f32 - eb as f32).powi(2);
                    (dr + dg + db).sqrt() > 32.0
                } else {
                    true
                }
            });
            if is_distinct {
                palette.push(hex);
                if palette.len() >= 8 {
                    break;
                }
            }
        }

        if palette.is_empty() {
            palette.push(dominant.clone());
        }

        Ok(PaletteResult { dominant, palette })
    })
    .await
    .map_err(|e| e.to_string())?
}
