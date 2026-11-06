#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_in_clear_browser])
        .run(tauri::generate_context!())
        .expect("error while running Retreat Planner");
}
