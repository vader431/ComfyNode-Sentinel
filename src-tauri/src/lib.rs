use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

struct StandaloneServer(Mutex<Option<Child>>);
struct MinimizeToTrayState(AtomicBool);

#[tauri::command]
fn set_minimize_to_tray(state: tauri::State<'_, MinimizeToTrayState>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentCheckResult {
    pub is_valid: bool,
    pub has_main_py: bool,
    pub has_custom_nodes: bool,
    pub detected_root: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoveredNode {
    pub folder_name: String,
    pub clean_name: String,
    pub enabled: bool,
    pub git_url: String,
    pub current_commit: String,
    pub branch: String,
}

#[tauri::command]
fn check_environment(comfy_root: String) -> Result<EnvironmentCheckResult, String> {
    let root = Path::new(&comfy_root);
    if !root.exists() {
        return Ok(EnvironmentCheckResult {
            is_valid: false,
            has_main_py: false,
            has_custom_nodes: false,
            detected_root: comfy_root,
            error_message: Some("Path does not exist.".to_string()),
        });
    }

    let has_main_py = root.join("main.py").is_file();
    let has_custom_nodes = root.join("custom_nodes").is_dir();
    let is_valid = has_main_py && has_custom_nodes;

    Ok(EnvironmentCheckResult {
        is_valid,
        has_main_py,
        has_custom_nodes,
        detected_root: comfy_root,
        error_message: if is_valid {
            None
        } else {
            Some("Target folder does not contain both main.py and custom_nodes/".to_string())
        },
    })
}

#[tauri::command]
fn toggle_node_state(custom_nodes_path: String, folder_name: String) -> Result<String, String> {
    let base = Path::new(&custom_nodes_path);
    let original = base.join(&folder_name);

    if !original.exists() {
        return Err(format!("Node directory {:?} does not exist", original));
    }

    let is_disabled = folder_name.ends_with(".disabled");
    let target_name = if is_disabled {
        folder_name.trim_end_matches(".disabled").to_string()
    } else {
        format!("{}.disabled", folder_name)
    };

    let target_path = base.join(&target_name);
    fs::rename(&original, &target_path).map_err(|e| {
        format!("Failed to rename {:?} to {:?}: {}", original, target_path, e)
    })?;

    Ok(target_name)
}

#[tauri::command]
fn quarantine_node_to_trash(custom_nodes_path: String, folder_name: String) -> Result<(), String> {
    let target = Path::new(&custom_nodes_path).join(&folder_name);
    if !target.exists() {
        return Err(format!("Target directory {:?} does not exist", target));
    }

    trash::delete(&target).map_err(|e| {
        format!("Failed to move {:?} to system trash: {}", target, e)
    })?;

    Ok(())
}

#[tauri::command]
fn scan_custom_nodes(custom_nodes_path: String) -> Result<Vec<DiscoveredNode>, String> {
    let base = Path::new(&custom_nodes_path);
    if !base.is_dir() {
        return Err(format!("{:?} is not a directory", base));
    }

    let entries = fs::read_dir(base).map_err(|e| e.to_string())?;
    let mut discovered = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden or internal folders
            if file_name.starts_with('.') || file_name == "__pycache__" {
                continue;
            }

            let enabled = !file_name.ends_with(".disabled");
            let clean_name = file_name.trim_end_matches(".disabled").to_string();

            // Read git info if .git exists
            let git_dir = path.join(".git");
            let mut git_url = String::new();
            let mut current_commit = String::new();
            let mut branch = "main".to_string();

            if git_dir.is_dir() {
                if let Ok(config) = fs::read_to_string(git_dir.join("config")) {
                    for line in config.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("url = ") {
                            git_url = trimmed.trim_start_matches("url = ").trim().to_string();
                            break;
                        }
                    }
                }

                if let Ok(head) = fs::read_to_string(git_dir.join("HEAD")) {
                    let head_trimmed = head.trim();
                    if let Some(ref_path) = head_trimmed.strip_prefix("ref: ") {
                        branch = ref_path.split('/').last().unwrap_or("main").to_string();
                        if let Ok(commit) = fs::read_to_string(git_dir.join(ref_path)) {
                            current_commit = commit.trim().to_string();
                        }
                    } else if !head_trimmed.is_empty() {
                        current_commit = head_trimmed.to_string();
                    }
                }
            }

            discovered.push(DiscoveredNode {
                folder_name: file_name,
                clean_name,
                enabled,
                git_url,
                current_commit,
                branch,
            });
        }
    }

    Ok(discovered)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(StandaloneServer(Mutex::new(None)))
        .manage(MinimizeToTrayState(AtomicBool::new(false)))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let minimize = window
                    .app_handle()
                    .try_state::<MinimizeToTrayState>()
                    .map(|s| s.0.load(Ordering::Relaxed))
                    .unwrap_or(false);
                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show ComfyNode Sentinel", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("ComfyNode Sentinel")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _ = tray_builder.build(app)?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
                // Launch bundled Next.js standalone server on a free localhost port
                let port = TcpListener::bind("127.0.0.1:0")
                    .and_then(|l| l.local_addr())
                    .map(|a| a.port())
                    .unwrap_or(3188);

                if let Ok(resource_dir) = app.path().resource_dir() {
                    let server_dir = resource_dir.join("standalone-server");
                    let server_js = server_dir.join("server.js");
                    if server_js.exists() {
                        let bundled_node = std::env::current_exe()
                            .ok()
                            .and_then(|exe| exe.parent().map(|p| p.join(if cfg!(windows) { "node.exe" } else { "node" })))
                            .filter(|p| p.exists());

                        let mut cmd = match bundled_node {
                            Some(ref bin) => Command::new(bin),
                            None => Command::new("node"),
                        };
                        cmd.arg(&server_js)
                            .current_dir(&server_dir)
                            .env("PORT", port.to_string())
                            .env("HOSTNAME", "127.0.0.1");

                        #[cfg(target_os = "windows")]
                        {
                            use std::os::windows::process::CommandExt;
                            const CREATE_NO_WINDOW: u32 = 0x08000000;
                            cmd.creation_flags(CREATE_NO_WINDOW);
                        }

                        if let Ok(child) = cmd.spawn() {
                            if let Some(state) = app.try_state::<StandaloneServer>() {
                                if let Ok(mut guard) = state.0.lock() {
                                    *guard = Some(child);
                                }
                            }

                            let handle = app.handle().clone();
                            std::thread::spawn(move || {
                                let addr = format!("127.0.0.1:{}", port);
                                for _ in 0..40 {
                                    if TcpStream::connect(&addr).is_ok() {
                                        if let Some(win) = handle.get_webview_window("main") {
                                            if let Ok(url) = format!("http://{}/", addr).parse() {
                                                let _ = win.navigate(url);
                                            }
                                        }
                                        break;
                                    }
                                    std::thread::sleep(Duration::from_millis(150));
                                }
                            });
                        }
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_environment,
            toggle_node_state,
            quarantine_node_to_trash,
            scan_custom_nodes,
            set_minimize_to_tray
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<StandaloneServer>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_check_environment_nonexistent() {
        let res = check_environment("C:\\NonExistentPath_Test_12345".to_string()).unwrap();
        assert!(!res.is_valid);
        assert!(!res.has_main_py);
        assert!(!res.has_custom_nodes);
        assert!(res.error_message.is_some());
    }

    #[test]
    fn test_toggle_node_state_cycle() {
        let temp_dir = std::env::temp_dir().join(format!("sentinel_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).unwrap();

        let node_dir = temp_dir.join("test_custom_node");
        fs::create_dir_all(&node_dir).unwrap();

        // 1. Toggle to disabled
        let target1 = toggle_node_state(temp_dir.to_string_lossy().to_string(), "test_custom_node".to_string()).unwrap();
        assert_eq!(target1, "test_custom_node.disabled");
        assert!(temp_dir.join("test_custom_node.disabled").exists());
        assert!(!temp_dir.join("test_custom_node").exists());

        // 2. Toggle back to enabled
        let target2 = toggle_node_state(temp_dir.to_string_lossy().to_string(), "test_custom_node.disabled".to_string()).unwrap();
        assert_eq!(target2, "test_custom_node");
        assert!(temp_dir.join("test_custom_node").exists());
        assert!(!temp_dir.join("test_custom_node.disabled").exists());

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
