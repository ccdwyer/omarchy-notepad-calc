# Assumptions

Conservative choices where the Omarchy / Quickshell API was not 100% certain. Authoritative platform contract: `docs/quattro-shell-reference.md`. Prefer documented types (`Process`, `FileView`, `IpcHandler`, `PanelWindow`, `StdioCollector`) and degrade.

## Plugin host

- **Single `bar-widget` kind**, as the spec's tribunal applied-changes require. `Panel.qml` is loaded internally via `Loader` from `BarWidget.qml` and is **not** a separate `panel` kind (double-registration risk).
- **`barWidget` metadata block** (displayName / category / defaultSection / defaults / schema) is required by the Quattro reference when `kinds` includes `bar-widget`. The spec's example omitted it; the reference wins.
- **Settings are inline** on the `shell.json` bar entry (`defaultCurrency`). No plugin-owned settings file. Sheets and rates live under `~/.local/share/notepad-calc/` as *documents / cache*, not settings. `defaultCurrency` is passed through `makeCtx()`; a dimensionless `100 in EUR` converts **100 of the default currency** through the ECB snapshot (not “100 EUR as a label”).
- **`keepLoaded` is omitted.** The chip stays mounted while the widget is on the bar, so the nested `PanelWindow` can remain instantiated (`Loader { active: true }`) without a second kind.
- **Injected properties:** `bar`, `shell`, `manifest`, `pluginRegistry`, plus schema keys (`defaultCurrency`). The widget still functions if some of these are missing.
- **IPC.** Quattro `call <id> <method> <arg>` requires a final argument. Documented keybinds always pass `'{}'`. IpcHandler verbs are `toggle` / `summon` / `hide`. Host-level `shell summon|hide|toggle <id> [payloadJson]` is a **different** IPC surface and is documented separately.
- **Third-party id** is `io.github.chris.notepad-calc` (not `omarchy.*`).
- **Hot-reload:** saving under `~/.config/omarchy/plugins/` reloads; we do not call `rescanPlugins` ourselves.

## Quickshell

- **Theme tokens** `Color.menu.*`, `Color.accent`, `Style.*`, `Border.*`, `WidgetButton`, `BarWidget`, `BorderSurface`, `PanelWindow`, `WlrLayershell` — copied from first-party clipboard / desktop-undo.
- **Reduced motion:** `Style.reduceMotion` if present, else `OMARCHY_REDUCED_MOTION=1`. Pulse is a static 0.4 accent highlight that still **expires at `pulseMs` (300)** via `pulseTick`.
- **`FileView` / `Process` / `StdioCollector`** as documented. Clipboard is `wl-copy` via `Process` only.
- **Plugin directory:** `Qt.resolvedUrl(".")` with the `file://` prefix stripped.
- **JS imports:** `import "js/engine.js" as Engine` — no `.pragma library`. `typeof module !== "undefined"` guards Node `module.exports`.
- **No `QTimeZone` bridge.** Timezones are `js/tz.js`.
- **Test seam:** `Panel.testHarness` reparents the chrome into a `QtQuick.Window` so CI can `grabToImage` without a Wayland compositor. Production still uses `PanelWindow` + `WlrLayershell`.

## Rates refresh

- **Attempt marker is written when a refresh starts**, before curl/helper, success or fail. Key: `lastRatesAttempt` in `state.json`. A disconnected reopen the same calendar day does not spawn another process.
- **`boot()` does not refresh.** `BarWidget` calls `startDailyRates()` once after the panel loads. `open()` only reseeds/loads the sheet.
- Failed attempts keep the last valid snapshot (user file or bundled `data/rates.json`).
- Each attempt also logs `RATES_ATTEMPT <date>` (soak asserts ≤1).

## First-run seed

- Seed is a `cp` of `data/first-run.calc` performed by the helper `Process`, not a `FileView.text()` read of the bundled file. That removes the race where FileView had not loaded when the process finished.

## Tests — what runs where

**This macOS checkout cannot run Hyprland, Quickshell, Omarchy, or qmllint.** Local `node tests/run.js` is the engine corpus only. It does **not** validate QML UI, soak RSS, or the fresh-machine demo.

Those three run in **GitHub Actions on Ubuntu**:

| Script | What it actually does |
|---|---|
| `tests/run-qml.sh` | Same ≥200-case corpus under `qml6` (qt6-declarative) |
| `tests/ui/run.sh` | Loads **Panel.qml**, synthetic 2→3 monitor edit, `grabToImage` at 1×/1.25×/2× for long-line, emoji, URL, demo; `pixeldiff.py` on the PNGs |
| `tests/ui/soak.sh` | Instantiates Panel, 500-line sheet, keystroke replay, `/proc/<pid>/status` RSS growth **< 5 MB**, `RATES_ATTEMPT` count **≤ 1**. Default duration 1 hour; the workflow sets `NOTEPAD_CALC_SOAK_MS=120000` so the runner stays bounded — **same QML path and thresholds**. |
| `tests/ui/demo.sh` | Empty `HOME`, copies the plugin to `~/.config/omarchy/plugins/<id>`, writes `shell.json`, runs the battlestation demo offline |

`qs.Commons` / `qs.Ui` are Omarchy-only; CI injects `tests/stubs/qs`. Quickshell is installed from nixpkgs when that works; otherwise `tests/stubs/Quickshell` implements `FileView` / `Process` / `PanelWindow` so Panel.qml still loads. Neither stub is used as a substitute for the Node corpus.

The old SVG “golden” suite (`tests/layout.js` + `tests/goldens/layout-*.svg`) is **removed**. It never loaded Panel.qml.

## Engine / data

- **ECB set is ~30 currencies.** Bundled snapshot dated `2026-08-18`.
- **130 canonical units.**
- Lines containing `://` (not only at column 0) are prose, so `see https://example.com/...` does not become `?see`.

## Helper

- Spec: parser is pure JS. Helper binary + `compat/rates-refresh.sh` + bundled snapshot remain the degrade chain. Refresh at most daily, 5s timeout, single-flight, atomic replace.

## Out of scope (intentional)

- A second Quickshell process.
- Writing Hyprland config.
- Click-to-cycle display units.
- `Intl` / Qt globals in `engine.js`.
