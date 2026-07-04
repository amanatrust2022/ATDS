//! lib.rs — DiagnosticOS Tauri v2 core library.
//!
//! Responsibilities:
//!   - Sidecar lifecycle (spawn, crash-watch, restart with retry)
//!   - Port conflict detection (3000 → 3001 → 3002)
//!   - LAN IP detection
//!   - Log rotation (daily, 7-day retention)
//!   - System tray (menu, dynamic LAN label, close-to-tray)
//!   - Auto-updater (silent check on startup, native dialog)
//!   - First-run wizard gate (config.json presence check)
//!   - Auto-start on Windows login
//!   - Environment variable injection into the Node process

pub mod setup;

use std::{
    fs,
    io::Write,
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tauri_plugin_updater::UpdaterExt;

// ─── Managed State ────────────────────────────────────────────────────────────

/// Shared mutable state for the sidecar Node.js process.
pub struct SidecarState {
    /// Handle to the running CommandChild, or None if not started / crashed.
    pub child: Mutex<Option<CommandChild>>,
    /// Port the Next.js server is currently bound to.
    pub port: Mutex<u16>,
    /// Number of consecutive crash-restarts attempted in this session.
    pub retry_count: Mutex<u32>,
}

// ─── Directory Helpers ────────────────────────────────────────────────────────

/// Returns %APPDATA% on Windows, falling back to ~/.local/share on other OSes.
pub(crate) fn appdata_base() -> PathBuf {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // macOS / Linux fallback (not expected in production but keeps code portable)
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(".local").join("share")
        })
}

/// Returns %APPDATA%\AmanaDiagnostics — the app's data directory.
/// This must match the path used in lib/localDb.ts (IS_LOCAL_HUB branch).
pub(crate) fn amana_dir() -> PathBuf {
    appdata_base().join("AmanaDiagnostics")
}

// ─── Port Detection ───────────────────────────────────────────────────────────

/// Returns true if something is already listening on `port`.
fn is_port_in_use(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(100)).is_ok()
}

/// Try ports `start`, `start+1`, `start+2` and return the first free one.
/// Falls back to `start` if all three are busy.
pub(crate) fn find_free_port(start: u16) -> u16 {
    for port in [start, start + 1, start + 2] {
        if !is_port_in_use(port) {
            return port;
        }
    }
    write_log(&format!(
        "[WARN] Ports {start}–{} all busy, using {start} anyway",
        start + 2
    ));
    start
}

// ─── LAN IP Detection ────────────────────────────────────────────────────────

/// Returns the machine's primary LAN IP address.
/// Uses a UDP socket trick (connect to 8.8.8.8:80 without sending anything)
/// to discover which interface the OS prefers for external traffic.
pub(crate) fn get_lan_ip() -> String {
    use std::net::UdpSocket;
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/// Build today's log file path: %APPDATA%\AmanaDiagnostics\logs\server-YYYY-MM-DD.log
fn log_file_path() -> PathBuf {
    let today = chrono::Local::now().format("%Y-%m-%d");
    amana_dir().join("logs").join(format!("server-{today}.log"))
}

/// Create the logs directory if it doesn't exist.
fn ensure_log_dir() {
    let dir = amana_dir().join("logs");
    fs::create_dir_all(dir).ok();
}

/// Delete log files older than 7 days.
fn cleanup_old_logs() {
    let log_dir = amana_dir().join("logs");
    let cutoff = chrono::Local::now() - chrono::TimeDelta::days(7);
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("log") {
                continue;
            }
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    let modified: chrono::DateTime<chrono::Local> = modified.into();
                    if modified < cutoff {
                        fs::remove_file(&path).ok();
                    }
                }
            }
        }
    }
}

/// Append a timestamped line to the current day's log file.
pub(crate) fn write_log(line: &str) {
    let path = log_file_path();
    let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "[{ts}] {line}");
    }
}

// ─── Server Health Check ──────────────────────────────────────────────────────

/// Returns true if a TCP connection can be established to localhost:{port}.
pub(crate) fn is_server_ready(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

// ─── Config Reader ────────────────────────────────────────────────────────────

/// Read Supabase credentials from config.json, if present.
/// Returns (supabase_url, supabase_anon_key) — either may be None.
fn read_supabase_config() -> (Option<String>, Option<String>) {
    let config_path = amana_dir().join("config.json");
    if !config_path.exists() {
        return (None, None);
    }
    let Ok(content) = fs::read_to_string(&config_path) else {
        return (None, None);
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) else {
        return (None, None);
    };
    let url = v["supabase_url"].as_str().map(str::to_string);
    let key = v["supabase_anon_key"].as_str().map(str::to_string);
    (url, key)
}

// ─── Sidecar Spawn ────────────────────────────────────────────────────────────

/// Spawn the Next.js server as a Tauri sidecar process.
///
/// The bundled node binary is referenced as `binaries/node` (matching
/// `bundle.externalBin` in tauri.conf.json). The standalone Next.js output
/// is bundled as a resource under `nextjs/` and located via `resource_dir()`.
///
/// Environment variables are injected before spawning.
pub fn spawn_nextjs(app: &AppHandle, port: u16) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir error: {e}"))?;

    let nextjs_dir = resource_dir.join("nextjs");
    let server_js = nextjs_dir.join("server.js");

    if !server_js.exists() {
        return Err(format!(
            "server.js not found at {}. Run `npm run build` first.",
            server_js.display()
        ));
    }

    // Ensure app data directories exist
    let amana = amana_dir();
    fs::create_dir_all(&amana).map_err(|e| format!("Cannot create AmanaDiagnostics dir: {e}"))?;
    ensure_log_dir();
    cleanup_old_logs();

    let db_path = amana.join("amana_clinic.db");
    let (supabase_url, supabase_key) = read_supabase_config();

    // Build the environment variable list for the Node process
    let mut envs: Vec<(String, String)> = vec![
        ("NODE_ENV".into(), "production".into()),
        ("IS_LOCAL_HUB".into(), "true".into()),
        ("NEXT_PUBLIC_LOCAL_SERVER_MODE".into(), "true".into()),
        ("PORT".into(), port.to_string()),
        // Bind to all interfaces so LAN devices can reach the server
        ("HOSTNAME".into(), "0.0.0.0".into()),
        // Path to the SQLite database — must match localDb.ts IS_LOCAL_HUB branch
        ("DB_PATH".into(), db_path.to_string_lossy().into_owned()),
    ];

    if let Some(url) = supabase_url {
        envs.push(("NEXT_PUBLIC_SUPABASE_URL".into(), url));
    }
    if let Some(key) = supabase_key {
        envs.push(("NEXT_PUBLIC_SUPABASE_ANON_KEY".into(), key));
    }

    write_log(&format!(
        "[SPAWN] node {} on port {port}",
        server_js.display()
    ));

    let (rx, child) = app
        .shell()
        .sidecar("binaries/node")
        .map_err(|e| format!("Sidecar lookup failed: {e}"))?
        .args([server_js.to_string_lossy().as_ref()])
        .current_dir(&nextjs_dir)
        .envs(envs)
        .spawn()
        .map_err(|e| format!("Spawn failed: {e}"))?;

    // Store the process handle and reset retry counter
    {
        let state = app.state::<SidecarState>();
        *state.child.lock().unwrap() = Some(child);
        *state.retry_count.lock().unwrap() = 0;
    }

    // Spawn a background task: forward logs and restart on crash
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut rx = rx;

        loop {
            match rx.recv().await {
                Some(CommandEvent::Stdout(data)) => {
                    write_log(&format!(
                        "[OUT] {}",
                        String::from_utf8_lossy(&data).trim_end()
                    ));
                }
                Some(CommandEvent::Stderr(data)) => {
                    write_log(&format!(
                        "[ERR] {}",
                        String::from_utf8_lossy(&data).trim_end()
                    ));
                }
                Some(CommandEvent::Error(msg)) => {
                    write_log(&format!("[PROC_ERROR] {msg}"));
                }
                Some(CommandEvent::Terminated(payload)) => {
                    write_log(&format!(
                        "[TERMINATED] exit_code={:?} signal={:?}",
                        payload.code, payload.signal
                    ));

                    // Clear the stored child handle
                    let (retry_num, current_port) = {
                        let state = app_clone.state::<SidecarState>();
                        *state.child.lock().unwrap() = None;
                        let mut retries = state.retry_count.lock().unwrap();
                        let port = *state.port.lock().unwrap();
                        let r = *retries;
                        if r < 3 {
                            *retries += 1;
                        }
                        (r, port)
                    };

                    if retry_num < 3 {
                        write_log(&format!(
                            "[RESTART] Crash detected — attempt {} of 3 in 2 s...",
                            retry_num + 1
                        ));
                        tokio::time::sleep(Duration::from_secs(2)).await;
                        if let Err(e) = spawn_nextjs(&app_clone, current_port) {
                            write_log(&format!("[RESTART_FAILED] {e}"));
                        }
                    } else {
                        write_log(
                            "[FATAL] Node process crashed 3 times in a row. Not restarting. \
                             Use tray → 'Restart Server' to try again manually.",
                        );
                    }
                    break; // This task's rx is dead — the new spawn creates a new task
                }

                None => break,

                // CommandEvent is #[non_exhaustive] — ignore future variants
                _ => {}
            }
        }
    });

    Ok(())
}

// ─── Navigate WebView ─────────────────────────────────────────────────────────

/// Navigate the main window to the Next.js app URL.
pub(crate) fn navigate_to_app(app: &AppHandle, port: u16) {
    if let Some(window) = app.get_webview_window("main") {
        let url = format!("http://localhost:{port}");
        window
            .eval(&format!("window.location.href = '{url}'"))
            .ok();
    }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

/// Build a tray context menu with the current LAN address label.
pub(crate) fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    lan_ip: &str,
    port: u16,
) -> tauri::Result<Menu<R>> {
    let open =
        MenuItem::with_id(app, "open", "Open DiagnosticOS", true, None::<&str>)?;
    let restart =
        MenuItem::with_id(app, "restart", "Restart Server", true, None::<&str>)?;
    let update =
        MenuItem::with_id(app, "update", "Check for Updates", true, None::<&str>)?;
    let logs =
        MenuItem::with_id(app, "logs", "View Logs", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    // Non-clickable LAN address label
    let lan = MenuItem::with_id(
        app,
        "lan",
        format!("LAN: {lan_ip}:{port}"),
        false, // disabled = non-clickable label
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(app, &[&open, &restart, &update, &logs, &sep1, &lan, &sep2, &quit])
}

/// Build and register the system tray icon with the initial placeholder menu.
fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../../icons/32x32.png"))
        .expect("Failed to decode tray icon — run `cargo tauri icon` to generate icons first");

    let initial_menu = build_tray_menu(app, "detecting…", 3000)?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("DiagnosticOS")
        .icon(icon)
        .menu(&initial_menu)
        .show_menu_on_left_click(false)
        .on_menu_event({
            let app = app.clone();
            move |_tray_app, event| {
                handle_tray_menu(app.clone(), event.id.as_ref());
            }
        })
        .on_tray_icon_event({
            let app = app.clone();
            move |_tray, event| {
                // Left-click on tray icon → show/focus window
                if let TrayIconEvent::Click { .. } = event {
                    show_main_window(&app);
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Handle tray menu item selection.
fn handle_tray_menu(app: AppHandle, id: &str) {
    match id {
        "open" => show_main_window(&app),

        "restart" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                restart_server(&app).await;
            });
        }

        "update" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(app).await;
            });
        }

        "logs" => open_logs_folder(),

        "quit" => {
            write_log("[QUIT] User requested quit from tray.");
            kill_sidecar(&app);
            app.exit(0);
        }

        _ => {}
    }
}

/// Show and focus the main window (un-minimise if needed).
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.show().ok();
        window.unminimize().ok();
        window.set_focus().ok();
    }
}

/// Kill the running Node.js sidecar process if alive.
fn kill_sidecar(app: &AppHandle) {
    let state = app.state::<SidecarState>();
    let mut guard = state.child.lock().unwrap();
    if let Some(child) = guard.take() {
        write_log("[KILL] Terminating Node.js process.");
        let _ = child.kill();
    }
}

/// Kill the sidecar, wait briefly, then respawn it on the same port.
async fn restart_server(app: &AppHandle) {
    write_log("[RESTART_MANUAL] Manual restart requested.");
    kill_sidecar(app);

    // Reset retry count so the new process gets 3 fresh crash attempts
    {
        let state = app.state::<SidecarState>();
        *state.retry_count.lock().unwrap() = 0;
    }

    tokio::time::sleep(Duration::from_millis(800)).await;

    let port = {
        let state = app.state::<SidecarState>();
        *state.port.lock().unwrap()
    };

    // Navigate back to splash while server restarts
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval("window.location.href = 'tauri://localhost/index.html'");
    }

    if let Err(e) = spawn_nextjs(app, port) {
        write_log(&format!("[RESTART_MANUAL_FAIL] {e}"));
        return;
    }

    // Poll until ready
    let mut ready = false;
    for i in 0u32..60 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if is_server_ready(port) {
            ready = true;
            write_log(&format!("[RESTART_MANUAL_OK] Ready after {}ms", (i + 1) * 500));
            break;
        }
    }

    if ready {
        navigate_to_app(app, port);
    } else {
        write_log("[RESTART_MANUAL_TIMEOUT] Server still not ready after 30 s.");
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.eval(
                "document.getElementById('status').textContent = \
                 'Error: Server restart timed out. Check logs.';\
                 document.getElementById('spinner').style.display='none';",
            );
        }
    }
}

/// Open the logs folder in Windows Explorer (or Finder / xdg-open on other OSes).
fn open_logs_folder() {
    let log_dir = amana_dir().join("logs");
    fs::create_dir_all(&log_dir).ok();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(log_dir.to_string_lossy().as_ref())
            .spawn()
            .ok();
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(log_dir.to_string_lossy().as_ref())
            .spawn()
            .ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(log_dir.to_string_lossy().as_ref())
            .spawn()
            .ok();
    }
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────

/// Check for updates silently. If one is available, show a native dialog.
/// If the user accepts, download and install (app restarts automatically).
pub(crate) async fn check_for_updates(app: AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log::warn!("[UPDATER] Not available: {e}");
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            log::info!("[UPDATER] Update available: v{version}");
            write_log(&format!("[UPDATER] v{version} available."));

            let confirmed = app
                .dialog()
                .message(format!(
                    "A new version of DiagnosticOS (v{version}) is available.\n\
                     Install now? The app will restart automatically."
                ))
                .title("Update Available")
                .buttons(MessageDialogButtons::OkCancel)
                .blocking_show();

            if confirmed {
                write_log(&format!("[UPDATER] User accepted — downloading v{version}…"));
                match update
                    .download_and_install(
                        |_chunk, _total| {
                            // progress callback — could emit an event here
                        },
                        || {
                            write_log("[UPDATER] Download complete, applying…");
                        },
                    )
                    .await
                {
                    Ok(()) => write_log("[UPDATER] Update applied — restarting."),
                    Err(e) => {
                        write_log(&format!("[UPDATER_ERROR] {e}"));
                        log::error!("[UPDATER] Install failed: {e}");
                    }
                }
            } else {
                write_log("[UPDATER] User deferred update.");
            }
        }
        Ok(None) => {
            log::info!("[UPDATER] App is up to date.");
        }
        Err(e) => {
            log::warn!("[UPDATER] Check failed: {e}");
        }
    }
}

// ─── Main Startup Flow ────────────────────────────────────────────────────────

/// Shared helper: spawn Next.js, poll for readiness, update tray, navigate.
/// Called by both the normal startup path and the setup wizard finish path.
pub(crate) async fn start_server_and_navigate(app: AppHandle, port: u16) {
    // Spawn the sidecar
    if let Err(e) = spawn_nextjs(&app, port) {
        write_log(&format!("[SPAWN_ERROR] {e}"));
        log::error!("[STARTUP] Spawn failed: {e}");
        if let Some(w) = app.get_webview_window("main") {
            let msg = e.replace('\'', "\\'");
            let _ = w.eval(&format!(
                "document.getElementById('status').textContent = 'Error: {msg}';\
                 document.getElementById('spinner').style.display='none';"
            ));
        }
        return;
    }

    // Poll every 500 ms for up to 30 s
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
        let lan_ip = get_lan_ip();
        write_log(&format!("[LAN] Address: {lan_ip}:{port}"));

        // Update tray menu with actual LAN address
        if let Ok(menu) = build_tray_menu(&app, &lan_ip, port) {
            if let Some(tray) = app.tray_by_id("main-tray") {
                tray.set_menu(Some(menu)).ok();
            }
        }

        // Navigate the WebView to the Next.js app
        navigate_to_app(&app, port);

        // Check for updates after the UI has loaded (3 s delay)
        tokio::time::sleep(Duration::from_secs(3)).await;
        check_for_updates(app).await;
    } else {
        write_log("[TIMEOUT] Server did not respond within 30 s.");
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.eval(
                "document.getElementById('status').textContent = \
                 'Error: Server start timed out (30 s). Please restart the app or view logs.';\
                 document.getElementById('spinner').style.display='none';",
            );
        }
    }
}

/// Top-level startup sequence:
///   1. Check for config.json — if missing, show setup wizard and return.
///   2. Find a free port.
///   3. Spawn Next.js and navigate once ready.
async fn run_startup_flow(app: AppHandle) {
    write_log("[STARTUP] DiagnosticOS starting.");

    let config_path = amana_dir().join("config.json");

    if !config_path.exists() {
        // First launch — show the setup wizard
        write_log("[STARTUP] No config.json — showing setup wizard.");
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.eval("window.location.href = 'tauri://localhost/setup.html'");
        }
        // The wizard calls the `finish_wizard` command when done.
        return;
    }

    let port = find_free_port(3000);
    {
        let state = app.state::<SidecarState>();
        *state.port.lock().unwrap() = port;
    }
    write_log(&format!("[STARTUP] Using port {port}"));

    start_server_and_navigate(app, port).await;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        // ── Plugins ─────────────────────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            // MacosLauncher is irrelevant on Windows but required by the API
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            // No extra CLI arguments passed to the app on startup
            None,
        ))
        // ── State ───────────────────────────────────────────────────────────
        .manage(SidecarState {
            child: Mutex::new(None),
            port: Mutex::new(3000),
            retry_count: Mutex::new(0),
        })
        // ── Invoke Handlers ─────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            setup::validate_invite_code,
            setup::save_config,
            setup::finish_wizard,
        ])
        // ── Setup ────────────────────────────────────────────────────────────
        .setup(|app| {
            // Register this app to launch on Windows login
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;
                if let Err(e) = app.autolaunch().enable() {
                    log::warn!("[AUTOSTART] Could not register: {e}");
                }
            }

            // Intercept the window close button → hide to tray instead of quitting
            let window = app
                .get_webview_window("main")
                .expect("The 'main' window must be defined in tauri.conf.json");

            let win_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    win_clone.hide().ok();
                    log::info!("[WINDOW] Minimised to tray.");
                }
            });

            // Build the system tray
            setup_tray(app.handle())?;

            // Run the startup flow asynchronously so the window renders first
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                run_startup_flow(handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Fatal error while running DiagnosticOS");
}
