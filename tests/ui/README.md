# QML / Quickshell UI tests (Linux CI only)

These tests **do not run on the macOS dev box**.

Acceptance (real Quickshell FileView/Process — **not** `tests/unit-stubs`):

```sh
tests/ui/run.sh     # grabToImage on chrome Item → temp PNGs → diff vs tests/goldens/ui
tests/ui/demo.sh    # install to $DEST, load $DEST/BarWidget.qml
tests/ui/soak.sh    # 500-line keystroke replay, RSS, exactly one rate attempt
```

`qs.Commons` / `qs.Ui` stubs under `tests/stubs/qs` stand in for Omarchy theme tokens only.

Refresh goldens on a Linux runner:

```sh
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
```
