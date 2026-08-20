# UI goldens

These PNGs are **Linux `Item.grabToImage` captures** of `Panel.qml`'s `chrome` Item
(1× / 1.25× / 2× × demo / longline / emoji / url). They are not synthetic stand-ins.
This macOS checkout **cannot** produce them.

## Gate

- **Baselines absent:** `tests/ui/run.sh` skip-warns (does not fail). Linux CI still
  captures with `UPDATE_UI_GOLDENS=1` and uploads artifact `notepad-calc-ui-captures`.
- **Baselines present in git:** a **fresh** temp capture is pixel-diffed against
  these files (2% AE). That is the real regression gate — not a same-run compare.

## Bootstrap (commit the Linux captures)

1. Run GitHub Actions job `Panel.qml UI + soak + fresh demo`.
2. Download artifact `notepad-calc-ui-captures`.
3. Copy the 12 PNGs into this directory.
4. `git add tests/goldens/ui/*.png && git commit`

Or on a Linux runner with Quickshell on `QML2_IMPORT_PATH`:

```sh
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
git add tests/goldens/ui/*.png
```
