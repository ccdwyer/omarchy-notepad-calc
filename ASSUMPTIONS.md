# Assumptions

Conservative choices where the Omarchy / Quickshell API was not 100% certain. Authoritative platform contract: `docs/quattro-shell-reference.md`. Prefer documented types (`Process`, `FileView`, `IpcHandler`, `PanelWindow`, `StdioCollector`) and degrade.

## Plugin host

- **Single `bar-widget` kind**, as the spec's tribunal applied-changes require. `Panel.qml` is loaded internally via `Loader` from `BarWidget.qml` and is **not** a separate `panel` kind (double-registration risk).
- **`barWidget` metadata block** (displayName / category / defaultSection / defaults / schema) is required by the Quattro reference when `kinds` includes `bar-widget`. The spec's example omitted it; the reference wins.
- **Settings are inline** on the `shell.json` bar entry (`defaultCurrency`). No plugin-owned settings file. Sheets and rates live under `~/.local/share/notepad-calc/` as *documents / cache*, not settings.
- **`keepLoaded` is omitted.** The chip stays mounted while the widget is on the bar, so the nested `PanelWindow` can remain instantiated (`Loader { active: true }`) without a second kind.
- **Injected properties:** `bar`, `shell`, `manifest`, `pluginRegistry`, plus schema keys (`defaultCurrency`). The widget still functions if some of these are missing.
- **IPC:** `omarchy-shell shell call io.github.chris.notepad-calc toggle|open|close`. An `IpcHandler` on the bar widget uses the plugin id as `target`. If the host only routes `call` to service/panel kinds, the chip click is the documented path.
- **Third-party id** is `io.github.chris.notepad-calc` (not `omarchy.*`).
- **Hot-reload:** saving under `~/.config/omarchy/plugins/` reloads; we do not call `rescanPlugins` ourselves.

## Quickshell

- **Theme tokens** `Color.menu.*`, `Color.accent`, `Style.*`, `Border.*`, `WidgetButton`, `BarWidget`, `BorderSurface`, `PanelWindow`, `WlrLayershell` — copied from first-party clipboard / desktop-undo. Monospace: try `Style.font.monoFamily` then `Style.font.monospace`, then `JetBrains Mono`.
- **Reduced motion:** `Style.reduceMotion` if present, else `OMARCHY_REDUCED_MOTION=1`. Pulse becomes a static highlight.
- **`FileView`:** `path`, `text()`, `setText`, `atomicWrites`, `printErrors`, `watchChanges`, `onLoaded` / `onLoadFailed` / `reload()` — same surface as desktop-undo's journal. Directory listing is **not** assumed; we `ls` via `Process`.
- **`Process` + `StdioCollector { waitForEnd: true }`** for helper detection, `ls`, `mkdir`, `wl-copy`.
- **Clipboard:** try `Quickshell.clipboardText` (may not exist); fall back to `wl-copy`. Isolated in `copyText()`.
- **Plugin directory:** `Qt.resolvedUrl(".")` with the `file://` prefix stripped (same adapter as desktop-undo).
- **JS imports:** `import "js/engine.js" as Engine` — no `.pragma library` (the engine is pure). `typeof module !== "undefined"` guards Node `module.exports`; QML does not define `module`.
- **No invented Quickshell APIs.** No `QTimeZone` bridge (tribunal: it does not exist). Timezones are a bundled transition table in `js/tz.js`.

## Engine / data

- **ECB set is ~30 currencies.** Bundled snapshot dated `2026-08-18`. Demo EUR amounts follow that snapshot (`$120/mo × 14 months in EUR` → `€1,448.28` at USD=1.16), not the spec's illustrative `€1,545.60`.
- **Timezone table** encodes well-known IANA DST rules (US, EU, AU-east, NZ, none) for 2024–2028 rather than parsing TZif at runtime. We do not have a live tz database in the plugin process. Abbreviations `IST` and `CST` are marked ambiguous and refused.
- **`in` vs inches:** `in` before a unit/currency/zone is the conversion operator; `in` after a number with no conversion target is inches. `12 in in cm` is the spelled-out form.
- **Money keeps its currency amount** (not SI-mixed with seconds). `$120/mo × 14 months` cancels via the tagged `perUnit`. Dimensionless `× 12` on a `/mo` quantity is treated as twelve of that period so the spec's year-cost line holds.
- **Dual harness:** Node runs `tests/run.js` against the same `js/*.js`. A QML-runtime harness is `tests/EngineTest.qml` for `qmljs` when that binary exists; this machine cannot run it.

## Helper

- Spec: the parser is pure JS, **no helper required for the product**. The competition brief also asked for a helper binary + missing-binary fallback. Both ship:
  - `src/rates-refresh` (Rust) → `bin/notepad-calc-rates`
  - `compat/rates-refresh.sh` (curl + sed/awk)
  - bundled `data/rates.json` if both are missing or the fetch fails
- Refresh is at most daily, 5s timeout, single-flight, atomic replace. Never on panel-open as the only path.

## Out of scope (intentional)

- A second Quickshell process.
- Writing Hyprland config.
- Click-to-cycle display units (tribunal rejected; click-to-copy owns the gesture).
- A standalone overlay kind.
- `Intl`, Qt globals, or engine-divergent regex in `engine.js`.
