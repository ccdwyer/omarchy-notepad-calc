# QML / Quickshell UI tests (Linux CI only)

These tests **do not run on the macOS dev box**. They load `Panel.qml`, send synthetic edits, `grabToImage` at 1×/1.25×/2×, pixel-diff long-line / emoji / URL / demo captures, replay 500-line keystrokes while sampling RSS, and install the plugin into a fresh `HOME` for the battlestation demo.

```sh
# on a Linux runner with qt6-declarative:
tests/ui/run.sh
tests/ui/demo.sh
tests/ui/soak.sh            # default 1 hour; CI passes milliseconds as argv
```

`qs.Commons` / `qs.Ui` are Omarchy shell modules; CI provides `tests/stubs/qs`. Quickshell is installed when nixpkgs succeeds; otherwise `tests/stubs/Quickshell` supplies `FileView` / `Process` / `PanelWindow` so `Panel.qml` still loads.
