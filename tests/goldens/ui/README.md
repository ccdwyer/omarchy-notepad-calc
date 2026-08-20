# UI goldens

These PNGs are **Linux `Item.grabToImage` captures** of `Panel.qml`'s `chrome` Item
(1× / 1.25× / 2× × demo / longline / emoji / url). They are not synthetic stand-ins.

This macOS checkout cannot produce them. Linux CI (`.github/workflows/test.yml`)
captures them via `tests/ui/UiTest.qml`. If the twelve files are missing, CI
bootstraps from a grab, then independently recaptures and pixel-diffs (2% AE).

Refresh on a Linux runner with Quickshell on `QML2_IMPORT_PATH`:

```sh
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
```

Then commit the PNGs so subsequent runs regress against a stored baseline.
