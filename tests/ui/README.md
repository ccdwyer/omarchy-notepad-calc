# QML / Quickshell UI tests (Linux CI only)

These tests **do not run on the macOS dev box**.

Acceptance (real Quickshell FileView/Process — **not** `tests/unit-stubs`):

```sh
tests/ui/run.sh     # grabToImage on chrome Item → temp PNGs → diff vs tests/goldens/ui
tests/ui/demo.sh    # install to $DEST, load $DEST/BarWidget.qml
tests/ui/soak.sh    # 500-line keystroke replay, RSS, exactly one rate attempt, 1 hour
```

`tests/ui/setup-qml-env.sh` locates the Nix Quickshell QML module (`…/qml/Quickshell/qmldir`)
and a compatible `qml` binary, and exports both on `QML2_IMPORT_PATH` / `QML_BIN`.
`qs.Commons` / `qs.Ui` stubs under `tests/stubs/qs` stand in for Omarchy theme tokens only.

Goldens cannot be generated on macOS. Missing baselines skip-warn locally.
**First Linux CI run** generates grabToImage captures (`UPDATE_UI_GOLDENS=1`),
prints `UI baselines bootstrapped`, uploads `notepad-calc-ui-captures`, commits
them, and **exits 0**. **Later runs** pixel-diff against those committed PNGs
and fail on divergence.

```sh
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
git add tests/goldens/ui/*.png
```
