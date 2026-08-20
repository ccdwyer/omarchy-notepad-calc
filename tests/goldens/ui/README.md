# UI goldens

These PNGs are **Linux `Item.grabToImage` captures** of `Panel.qml`'s `chrome` Item
(1× / 1.25× / 2× × demo / longline / emoji / url). They are not synthetic stand-ins.

Linux CI (`tests/ui/run.sh`) writes captures to a **temp dir** and pixel-diffs them
against **this directory**. Missing goldens fail. CI does **not** mint a baseline
and immediately compare a second capture to it.

This macOS checkout cannot produce the PNGs. Refresh on a Linux runner with
Quickshell on `QML2_IMPORT_PATH`, then commit the files:

```sh
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
git add tests/goldens/ui/*.png
```
