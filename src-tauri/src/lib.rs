use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

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
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_environment,
            toggle_node_state,
            quarantine_node_to_trash,
            scan_custom_nodes
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
