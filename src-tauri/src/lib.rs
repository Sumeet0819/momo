use tauri::WebviewWindow;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks, Networks, CpuRefreshKind, RefreshKind, MemoryRefreshKind};
use std::sync::Mutex;
use tauri::State;

/// Shared sysinfo instance kept alive across calls so network deltas work
pub struct SysState(pub Mutex<System>);

#[derive(Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Boty is active.", name)
}

#[tauri::command]
async fn set_window_expanded(window: WebviewWindow, expanded: bool) -> Result<(), String> {
    // Collapsed: just the notch bar height; Expanded: notch + panel
    let (new_w, new_h): (f64, f64) = if expanded {
        (780.0, 640.0)
    } else {
        (780.0, 42.0)
    };

    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let mon_pos = monitor.position();
    let scale = monitor.scale_factor();
    let monitor_w = monitor.size().width as f64 / scale;

    // Centered horizontally on current monitor, docked at the top
    let new_x = mon_pos.x + (((monitor_w - new_w) / 2.0) * scale) as i32;
    let new_y = mon_pos.y; // Flush to the top of the display

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(new_w, new_h)))
        .map_err(|e| e.to_string())?;

    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            new_x,
            new_y,
        )))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,          // Overall CPU %
    pub cpu_per_core: Vec<f32>,  // Per-core %
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub ram_pct: f32,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_pct: f32,
    pub net_rx_kbps: f64,        // KB/s received
    pub net_tx_kbps: f64,        // KB/s transmitted
    pub battery_pct: f32,        // 0-100, or -1 if no battery
    pub battery_charging: bool,
    pub process_count: usize,
    pub uptime_secs: u64,
}

#[tauri::command]
fn get_system_stats(sys_state: State<SysState>) -> Result<SystemStats, String> {
    let mut sys = sys_state.0.lock().map_err(|e| e.to_string())?;

    // Refresh CPU (requires two calls spaced apart — we rely on the Mutex-held state
    // being refreshed repeatedly; on first call it may read 0% which is fine)
    sys.refresh_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::new().with_cpu_usage())
            .with_memory(MemoryRefreshKind::new().with_ram())
            .with_processes(sysinfo::ProcessRefreshKind::new())
    );

    // CPU
    let cpu_per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let cpu_usage = if cpu_per_core.is_empty() {
        0.0
    } else {
        cpu_per_core.iter().sum::<f32>() / cpu_per_core.len() as f32
    };

    // RAM
    let ram_total_mb = sys.total_memory() / 1024 / 1024;
    let ram_used_mb  = sys.used_memory()  / 1024 / 1024;
    let ram_pct = if ram_total_mb > 0 {
        (ram_used_mb as f32 / ram_total_mb as f32) * 100.0
    } else { 0.0 };

    // Disk (aggregate all)
    let disks = Disks::new_with_refreshed_list();
    let (disk_total, disk_used) = disks.iter().fold((0u64, 0u64), |(t, u), d| {
        (t + d.total_space(), u + (d.total_space().saturating_sub(d.available_space())))
    });
    let disk_total_gb = disk_total as f64 / 1_073_741_824.0;
    let disk_used_gb  = disk_used  as f64 / 1_073_741_824.0;
    let disk_pct = if disk_total > 0 {
        (disk_used as f32 / disk_total as f32) * 100.0
    } else { 0.0 };

    // Network (aggregate all interfaces, KB/s since last refresh)
    let mut networks = Networks::new_with_refreshed_list();
    networks.refresh();
    let (rx_bytes, tx_bytes) = networks.iter().fold((0u64, 0u64), |(r, t), (_, data)| {
        (r + data.received(), t + data.transmitted())
    });
    // These are bytes since last refresh (~1 refresh cycle ≈ instant snapshot)
    let net_rx_kbps = rx_bytes as f64 / 1024.0;
    let net_tx_kbps = tx_bytes as f64 / 1024.0;

    // Process count
    let process_count = sys.processes().len();

    // Uptime
    let uptime_secs = System::uptime();

    // Battery — use the `battery` crate
    let (battery_pct, battery_charging) = get_battery_info();

    Ok(SystemStats {
        cpu_usage,
        cpu_per_core,
        ram_used_mb,
        ram_total_mb,
        ram_pct,
        disk_used_gb,
        disk_total_gb,
        disk_pct,
        net_rx_kbps,
        net_tx_kbps,
        battery_pct,
        battery_charging,
        process_count,
        uptime_secs,
    })
}

fn get_battery_info() -> (f32, bool) {
    let manager = match battery::Manager::new() {
        Ok(m) => m,
        Err(_) => return (-1.0, false),
    };
    let batteries = match manager.batteries() {
        Ok(b) => b,
        Err(_) => return (-1.0, false),
    };
    for bat in batteries.flatten() {
        let pct = bat.state_of_charge().value * 100.0;
        let charging = bat.state() == battery::State::Charging;
        return (pct, charging);
    }
    (-1.0, false)
}

#[tauri::command]
async fn execute_desktop_tool(tool_id: String, args: serde_json::Value) -> Result<ToolResult, String> {
    match tool_id.as_str() {
        "open_app" => {
            let app_name = args.get("appName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            
            // Strict allowlist validation
            let target_exe = match app_name.as_str() {
                "notepad" | "notepad.exe"                  => "notepad.exe",
                "calculator" | "calc" | "calc.exe"         => "calc.exe",
                "terminal" | "cmd" | "cmd.exe"             => "cmd.exe",
                "explorer" | "explorer.exe"                => "explorer.exe",
                "mspaint" | "paint"                        => "mspaint.exe",
                "taskmgr" | "taskmanager" | "task manager" => "taskmgr.exe",
                "wordpad"                                  => "wordpad.exe",
                "control" | "controlpanel"                 => "control.exe",
                "regedit"                                  => "regedit.exe",
                _ => return Err(format!("Application '{}' is not in the security allowlist.", app_name)),
            };

            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                Command::new(target_exe)
                    .spawn()
                    .map_err(|e| format!("Failed to launch {}: {}", target_exe, e))?;
            }

            Ok(ToolResult {
                success: true,
                message: format!("Successfully launched allowlisted application: {}", target_exe),
                data: None,
            })
        }
        "open_url" => {
            let url = args.get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if !url.starts_with("https://") && !url.starts_with("http://") {
                return Err("Only valid http/https URLs are permitted.".into());
            }

            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                Command::new("rundll32")
                    .args(["url.dll,FileProtocolHandler", url])
                    .spawn()
                    .map_err(|e| format!("Failed to open URL: {}", e))?;
            }

            Ok(ToolResult {
                success: true,
                message: format!("Opened URL in default browser: {}", url),
                data: None,
            })
        }
        "web_search" => {
            let query = args.get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let search_url = format!("https://www.google.com/search?q={}", urlencoding_simple(query));

            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                Command::new("rundll32")
                    .args(["url.dll,FileProtocolHandler", &search_url])
                    .spawn()
                    .map_err(|e| format!("Failed to run web search: {}", e))?;
            }

            Ok(ToolResult {
                success: true,
                message: format!("Initiated web search for '{}'", query),
                data: None,
            })
        }
        _ => Err(format!("Unrecognized tool identifier: {}", tool_id)),
    }
}

fn urlencoding_simple(input: &str) -> String {
    let mut encoded = String::new();
    for b in input.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            b' ' => encoded.push('+'),
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Pre-warm the sysinfo system object
    let mut init_sys = System::new_all();
    init_sys.refresh_all();

    tauri::Builder::default()
        .manage(SysState(Mutex::new(init_sys)))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let mon_pos = monitor.position();
                    let scale = monitor.scale_factor();
                    let monitor_w = monitor.size().width as f64 / scale;
                    let win_w = 780.0;
                    let new_x = mon_pos.x + (((monitor_w - win_w) / 2.0) * scale) as i32;
                    let new_y = mon_pos.y;
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                        new_x,
                        new_y,
                    )));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_window_expanded,
            execute_desktop_tool,
            get_system_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
