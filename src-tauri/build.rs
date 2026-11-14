fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "check_environment",
                "toggle_node_state",
                "quarantine_node_to_trash",
                "scan_custom_nodes",
                "set_minimize_to_tray",
                "sync_tray_status",
                "get_desktop_runtime_info",
                "pick_directory",
                "pick_file",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}


