//! setup.rs — First-run wizard Tauri commands.
//!
//! Called from setup.html via window.__TAURI__.core.invoke().
//! Validates an org invite code against the cloud API, writes config.json,
//! then triggers the normal server-start flow.

use std::{fs, time::Duration};

use tauri::{AppHandle, Manager};

use crate::{
    amana_dir, build_tray_menu, find_free_port, is_server_ready, navigate_to_app,
    spawn_nextjs, write_log, SidecarState,
};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct OrgConfig {
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub org_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org_name: Option<String>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Validate an org invite code against the DiagnosticOS cloud API.
/// Returns the org's Supabase configuration on success.
#[tauri::command]
pub async fn validate_invite_code(code: String) -> Result<OrgConfig, String> {
    let trimmed = code.trim().to_string();
    if trimmed.is_empty() {
        return Err("Invite code cannot be empty.".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let response = client
        .post("https://cloud.diagnosticos.com/api/validate-invite")
        .json(&serde_json::json!({ "code": trimmed }))
        .send()
        .await
        .map_err(|e| format!("Network error — check your internet connection: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(match status {
            404 => "Invite code not found. Please check and try again.".into(),
            410 => "Invite code has already been used.".into(),
            _ => format!("Server error ({status}): {body}"),
        });
    }

    response
        .json::<OrgConfig>()
        .await
        .map_err(|e| format!("Unexpected response from server: {e}"))
}

/// Persist the org configuration to %APPDATA%\AmanaDiagnostics\config.json.
#[tauri::command]
pub async fn save_config(config: OrgConfig) -> Result<(), String> {
    let dir = amana_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {e}"))?;

    let config_path = dir.join("config.json");
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialisation error: {e}"))?;

    fs::write(&config_path, &json).map_err(|e| format!("Cannot write config.json: {e}"))?;

    write_log(&format!(
        "[SETUP] config.json written for org_id={}",
        config.org_id
    ));
    Ok(())
}

/// Called by setup.html after config.json is saved.
/// Navigates back to the splash screen, then starts the Next.js server.
#[tauri::command]
pub async fn finish_wizard(app: AppHandle) -> Result<(), String> {
    // Find a free port
    let port = find_free_port(3000);
    {
        let state = app.state::<SidecarState>();
        *state.port.lock().unwrap() = port;
    }

    // Navigate back to splash
    if let Some(window) = app.get_webview_window("main") {
        window
            .eval("window.location.href = 'tauri://localhost/index.html'")
            .map_err(|e| format!("Navigate error: {e}"))?;
    }

    // Short pause so the splash HTML renders before we update its status text
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;

        if let Err(e) = spawn_nextjs(&handle, port) {
            write_log(&format!("[WIZARD_SPAWN_ERROR] {e}"));
            if let Some(w) = handle.get_webview_window("main") {
                let msg = e.replace('\'', "\\'");
                let _ = w.eval(&format!(
                    "document.getElementById('status').textContent = 'Error: {msg}';\
                     document.getElementById('spinner').style.display='none';"
                ));
            }
            return;
        }

        // Poll until server is ready (30 s / 500 ms = 60 attempts)
        let mut ready = false;
        for i in 0u32..60 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if is_server_ready(port) {
                ready = true;
                write_log(&format!("[READY] Server up after {}ms", (i + 1) * 500));
                break;
            }
        }

        if ready {
            // Update tray with actual LAN address
            let lan_ip = crate::get_lan_ip();
            if let Ok(menu) = build_tray_menu(&handle, &lan_ip, port) {
                if let Some(tray) = handle.tray_by_id("main-tray") {
                    tray.set_menu(Some(menu)).ok();
                }
            }
            navigate_to_app(&handle, port);

            // Background update check
            tokio::time::sleep(Duration::from_secs(3)).await;
            crate::check_for_updates(handle).await;
        } else {
            write_log("[WIZARD_TIMEOUT] Server did not start in 30 s.");
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.eval(
                    "document.getElementById('status').textContent = \
                     'Error: Server start timed out (30 s). Please restart the app.';\
                     document.getElementById('spinner').style.display='none';",
                );
            }
        }
    });

    Ok(())
}
