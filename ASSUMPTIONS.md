# Assumptions

Conservative choices where the Omarchy / Quickshell API was not 100% certain. Authoritative platform contract: `docs/quattro-shell-reference.md`. Prefer documented types (`Process`, `FileView`, `IpcHandler`, `PanelWindow`, `StdioCollector`) and degrade.

## Plugin host

- **Single `bar-widget` kind**, as the spec's tribunal applied-changes require. `Panel.qml` is loaded internally via `Loader` from `BarWidget.qml` and is **not** a separate `panel` kind (double-registration risk).
- **`barWidget` metadata block** (displayName / category / defaultSection / defaults / schema) is required by the Quattro reference when `kinds` includes `bar-widget`. The spec's example omitted it; the reference wins.
- **Settings are inline** on the `shell.json` bar entry (`defaultCurrency`). No plugin-owned settings file. Sheets and rates live under `~/.local/share/notepad-calc/` as *documents / cache*, not settings.
- **`keepLoaded` is omitted.** The chip stays mounted while the widget is on the bar, so the nested `PanelWindow` can remain instantiated (`Loader { active: true }`) without a second kind.
- **Injected properties:** `bar`, `shell`, `manifest`, `pluginRegistry`, plus schema keys (`defaultCurrency`). The widget still functions if some of these are missing.
- **IPC.** Quattro `call <id> <method> <arg>` reaches already-loaded plugins. This bar widget stays loaded, so `omarchy-shell shell call io.github.chris.notepad-calc toggle|summon|hide` is the documented path. IpcHandler verbs are `toggle` / `summon` / `hide` (Quattro's summon/hide/toggle vocabulary). Host-level `shell summon|hide|toggle <id>` is also valid for a loaded plugin.
- **Third-party id** is `io.github.chris.notepad-calc` (not `omarchy.*`).
- **Hot-reload:** saving under `~/.config/omarchy/plugins/` reloads; we do not call `rescanPlugins` ourselves.

## Quickshell

- **Theme tokens** `Color.menu.*`, `Color.accent`, `Style.*`, `Border.*`, `WidgetButton`, `BarWidget`, `BorderSurface`, `PanelWindow`, `WlrLayershell` — copied from first-party clipboard / desktop-undo. Monospace: try `Style.font.monoFamily` then `Style.font.monospace`, then `JetBrains Mono`.
- **Reduced motion:** `Style.reduceMotion` if present, else `OMARCHY_REDUCED_MOTION=1`. Pulse is a static 0.4 accent highlight that still **expires at `pulseMs` (300)** via `pulseTick` (the tick runs even when motion is reduced; otherwise the highlight would stick). Fade interpolation is skipped; duration is not.
- **`FileView`:** `path`, `text()`, `setText`, `atomicWrites`, `printErrors`, `watchChanges`, `onLoaded` / `onLoadFailed` / `reload()` — same surface as desktop-undo's journal. Directory listing is **not** assumed; we `ls` via `Process`.
- **`Process` + `StdioCollector { waitForEnd: true }`** for helper detection, `ls`, `mkdir`, `wl-copy`.
- **Clipboard** is `wl-copy` via `Process` only. `Quickshell.clipboardText` is **not** in the Quattro reference, so we do not call it. Isolated in `copyText()`.
- **Plugin directory:** `Qt.resolvedUrl(".")` with the `file://` prefix stripped (same adapter as desktop-undo).
- **JS imports:** `import "js/engine.js" as Engine` — no `.pragma library` (the engine is pure). `typeof module !== "undefined"` guards Node `module.exports`; QML does not define `module`.
- **No `QTimeZone` bridge** (tribunal: it does not exist). Timezones are a bundled transition table in `js/tz.js`. Other Quickshell surfaces used here are the documented set above plus `wl-copy`; anything not in the reference is avoided rather than invented.

## Engine / data

- **ECB set is ~30 currencies.** Bundled snapshot dated `2026-08-18`. Demo EUR amounts follow that snapshot (`$120/mo × 14 months in EUR` → `€1,448.28` at USD=1.16), not the spec's illustrative `€1,545.60`.
- **Timezone table** encodes well-known IANA DST rules (US, EU, AU-east, NZ, none) for 2024–2028 rather than parsing TZif at runtime. We do not have a live tz database in the plugin process. Abbreviations `IST` and `CST` are marked ambiguous and refused.
- **`in` vs inches:** `in` before a unit/currency/zone is the conversion operator; `in` after a number with no conversion target is inches. `12 in in cm` is the spelled-out form.
- **Money keeps its currency amount** (not SI-mixed with seconds). `$120/mo × 14 months` cancels via the tagged `perUnit`. Dimensionless `× 12` on a `/mo` quantity is treated as twelve of that period so the spec's year-cost line holds.
- **Units:** 130 canonical ids (length/mass/time/data/area/volume/speed/temperature/data-rate/angle/frequency). Spec said "~120"; the table meets that as a count of canonical units, not aliases.
- **Dual harness:** `tests/corpus.json` (210 cases) is the source of truth. Node `tests/run.js` and QML `tests/EngineTest.qml` (`import "corpus-data.js"`) consume it. CI runs both with networking disabled. Layout goldens at 1×/1.25×/2× and a 500-line soak run in Node (this Mac cannot rasterize Qt Quick).

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
