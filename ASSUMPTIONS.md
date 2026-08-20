# Assumptions

Conservative choices where the Omarchy / Quickshell API was not 100% certain. Authoritative platform contract: `docs/quattro-shell-reference.md`. Prefer documented types (`Process`, `FileView`, `IpcHandler`, `PanelWindow`, `StdioCollector`) and degrade.

## Plugin host

- **Single `bar-widget` kind**, as the spec's tribunal applied-changes require. `Panel.qml` is loaded internally via `Loader` from `BarWidget.qml` and is **not** a separate `panel` kind (double-registration risk).
- **`barWidget` metadata block** (displayName / category / defaultSection / defaults / schema) is required by the Quattro reference when `kinds` includes `bar-widget`. The spec's example omitted it; the reference wins.
- **Settings are inline** on the `shell.json` bar entry (`defaultCurrency`). No plugin-owned settings file. Sheets and rates live under `~/.local/share/notepad-calc/` as *documents / cache*, not settings. `defaultCurrency` is passed through `makeCtx()`; a dimensionless `100 in EUR` converts **100 of the default currency** through the ECB snapshot (not “100 EUR as a label”).
- **`keepLoaded` is omitted.** The chip stays mounted while the widget is on the bar, so the nested `PanelWindow` can remain instantiated (`Loader { active: true }`) without a second kind.
- **Injected properties:** `bar`, `shell`, `manifest`, `pluginRegistry`, plus schema keys (`defaultCurrency`). The widget still functions if some of these are missing.
- **IPC.** Quattro `call <id> <method> <arg>` invokes a method **on the loaded plugin entry point** (`BarWidget.qml` root), not on a nested `IpcHandler`. The root therefore defines string-argument `summon` / `hide` / `toggle` (delegating to `open` / `close`). Documented keybinds always pass `'{}'`. An `IpcHandler` on the same object is an additional direct IPC surface with the same verbs. Host-level `shell summon|hide|toggle <id>` is for panel/overlay kinds and is not used here.
- **Third-party id** is `io.github.chris.notepad-calc` (not `omarchy.*`).
- **Hot-reload:** saving under `~/.config/omarchy/plugins/` reloads; we do not call `rescanPlugins` ourselves.

## Quickshell

- **Theme tokens** `Color.menu.*`, `Color.accent`, `Style.*`, `Border.*`, `WidgetButton`, `BarWidget`, `BorderSurface`, `PanelWindow`, `WlrLayershell` — copied from first-party clipboard / desktop-undo.
- **Reduced motion:** `Style.reduceMotion` if present, else `OMARCHY_REDUCED_MOTION=1`. Pulse is a static 0.4 accent highlight that still **expires at `pulseMs` (300)** via `pulseTick`.
- **`FileView` / `Process` / `StdioCollector`** as documented. Clipboard is `wl-copy` via `Process` only.
- **Plugin directory:** `js/fileurl.js` strips `file://` and `decodeURIComponent`s the path so installs under escaped names work.
- **JS imports:** `import "js/engine.js" as Engine` — no `.pragma library`. `typeof module !== "undefined"` guards Node `module.exports`.
- **No `QTimeZone` bridge.** Timezones are `js/tz.js`, generated from **IANA TZDB transition timestamps** for 2024–2028 (`python3 tools/tzgen.py`). Generic US/EU/AU rules are not used. Every advertised zone has edge tests in `tests/fixtures/tz-edges.json`.
- **Clipboard:** `wl-copy` via `Process`. If it is missing, the panel sets `statusMsg` instead of failing silently.
- **Test seam:** `Panel.testHarness` reparents the `chrome` **Item** into a `QtQuick.Window` so CI can call **Item.grabToImage** (not Window). Production still uses `PanelWindow` + `WlrLayershell`.

## Rates refresh

- **Attempt marker is written when a refresh starts**, before curl/helper, success or fail. `mkdir -p` of the data dir and the `lastRatesAttempt` write run in **one** `Process` so a same-day reload cannot race an empty directory. XML with a date but **zero** currency cubes is rejected and does not replace the cache.
- **`boot()` does not refresh.** `BarWidget` calls `startDailyRates()` once after the panel loads. `open()` only reseeds/loads the sheet.
- Failed attempts keep the last valid snapshot (user file or bundled `data/rates.json`).
- Each attempt also logs `RATES_ATTEMPT <date>` (soak asserts **exactly 1**).

## First-run seed

- Seed is a `cp` of `data/first-run.calc` performed by the helper `Process`, not a `FileView.text()` read of the bundled file. That removes the race where FileView had not loaded when the process finished.

## Tests — what runs where

**This macOS checkout cannot run Hyprland, Quickshell, Omarchy, or qmllint.** Local `node tests/run.js` is the engine corpus only. It does **not** validate QML UI, soak RSS, or the fresh-machine demo.

Those three run in **GitHub Actions on Ubuntu**:

| Script | What it actually does |
|---|---|
| `tests/run-qml.sh` | Same ≥200-case corpus under `qml6` (qt6-declarative) |
| `tests/ui/run.sh` | Loads **Panel.qml**, `grabToImage` on the **chrome Item**, writes 12 PNGs to a **temp dir**. If committed goldens exist, pixel-diffs against them. If they are **absent**, macOS skip-warns; Linux CI **bootstraps** (`UPDATE_UI_GOLDENS=1`), prints `UI baselines bootstrapped`, **exits 0**, and uploads the PNGs as an artifact. Committing them back is a separate **maintainer-only** job (see below). |
| `tests/ui/soak.sh` | Instantiates Panel with **real Quickshell**, 500-line keystroke replay, **1 hour**, RSS growth **< 5 MB**, **exactly one** `RATES_ATTEMPT`. |
| `tests/ui/demo.sh` | Empty `HOME`, installs the plugin to `~/.config/omarchy/plugins/<id>`, writes `shell.json` with a **single** bar-layout entry, loads **`$DEST/BarWidget.qml`** (not the checkout Panel.qml). Requires real Quickshell. |

`qs.Commons` / `qs.Ui` are Omarchy-only; CI injects `tests/stubs/qs` (theme tokens). **Quickshell I/O stubs live in `tests/unit-stubs/` and are not on the acceptance import path.** `tests/ui/setup-qml-env.sh` puts the **Nix Quickshell** `…/qml` directory (the parent of `Quickshell/qmldir`) and a **Nix-compatible `qml` binary** on `QML2_IMPORT_PATH` / `QML_BIN` before UI, demo, and soak. The job **fails** if that module cannot be imported. Network isolation uses `unshare --net` or `sudo unshare --net`; if neither works the job **fails**. `tests/offline.sh` also **fails closed** when a net namespace cannot be created.

Golden PNGs must be Linux `Item.grabToImage` captures of `Panel.qml`. There is no stand-in generator. **This Mac cannot produce them** (no Quickshell/Qt6).

The CI is split into two jobs to avoid a GitHub Actions pwn-request (never combine `contents: write` with a checkout of untrusted PR code):

- **`qml-ui-soak-demo`** runs on every push and pull_request with a **read-only** token and the default checkout. When goldens are **absent** it generates the 12 PNGs (`UPDATE_UI_GOLDENS=1`), prints `UI baselines bootstrapped`, **uploads** them as artifact `notepad-calc-ui-captures`, and **exits 0** (the submitted branch is not guaranteed-red). When PNGs are **present** in git it pixel-diffs a fresh temp capture against those baselines (2% AE) and **fails on divergence**. This job **never commits** — safe to run PR code because it holds no write token.
- **`bootstrap-ui-goldens`** commits the baselines. It runs **only** on a manual `workflow_dispatch` or a push to the repo's **own default branch** — never on `pull_request` — with `contents: write`, checking out a **trusted repo branch** (`github.ref_name`, never a fork PR head). A maintainer runs it once to seed the goldens; thereafter the read-only PR job enforces the real diff.

Manual seed (any Linux runner with Quickshell): `UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh` then commit `tests/goldens/ui/*.png`.

CI also runs `cargo test` and `cargo build --release` for `src/rates-refresh`.

Ship source with `./pack.sh` (`git archive`), never a working-tree tarball. `bin/`, `target/`, review logs, and `.serena/` are gitignored and `export-ignore`.

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
