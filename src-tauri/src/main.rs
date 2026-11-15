#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};

use tauri_plugin_dialog::DialogExt;

/// Zillow often answers Brave with Access Denied. Open it in Chrome or Firefox.
/// Land.com and Lands of America deny every page from this computer, so the app
/// does not open those hosts.
fn clear_browser(host: &str) -> bool {
    let host = host.trim_start_matches("www.");
    host == "zillow.com" || host.ends_with(".zillow.com")
}

fn https_host(url: &str) -> Option<&str> {
    let rest = url.strip_prefix("https://")?;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.rsplit('@').next()?;
    let host = host.split(':').next()?;
    if host.is_empty() { None } else { Some(host) }
}

fn spawn_browser(bin: &str, url: &str) -> bool {
    Command::new(bin)
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

#[tauri::command]
fn open_in_clear_browser(url: String) -> Result<(), String> {
    let host = https_host(&url).ok_or("Only https links can be opened this way.")?;
    if !clear_browser(host) {
        return Err("This site opens in the default browser.".into());
    }
    let bins: &[&str] = if cfg!(windows) {
        &["chrome", "msedge", "firefox"]
    } else {
        &["google-chrome", "google-chrome-stable", "firefox", "chromium"]
    };
    if bins.iter().any(|bin| spawn_browser(bin, &url)) {
        Ok(())
    } else {
        Err("Chrome or Firefox is not installed.".into())
    }
}

/// Save a plan file the user picks with the system dialog. Returns where it went, or None if they cancelled.
#[tauri::command]
async fn export_plan(app: tauri::AppHandle, contents: String, file_name: String) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Export plan")
        .set_file_name(&file_name)
        .add_filter("Retreat Planner plan", &["json"])
        .blocking_save_file();
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| format!("Couldn't write {}: {e}", path.display()))?;
    Ok(Some(path.display().to_string()))
}

/// Read a plan file the user picks with the system dialog. Returns its text, or None if they cancelled.
#[tauri::command]
async fn import_plan(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Import plan")
        .add_filter("Retreat Planner plan", &["json"])
        .blocking_pick_file();
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 2_000_000 {
        return Err("That file is too big to be a plan.".into());
    }
    std::fs::read_to_string(&path).map(Some).map_err(|e| format!("Couldn't read {}: {e}", path.display()))
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_in_clear_browser, export_plan, import_plan])
        .run(tauri::generate_context!())
        .expect("error while running Retreat Planner");
}
