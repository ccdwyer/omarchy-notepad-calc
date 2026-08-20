# UI goldens

These PNGs are **Linux `Item.grabToImage` captures** of `Panel.qml`'s `chrome` Item
(1× / 1.25× / 2× × demo / longline / emoji / url). They are not synthetic stand-ins.

**This macOS checkout cannot produce them.** The target runtime is Linux
Quickshell + Qt6, which only exists on the GitHub Actions runner.

## Gate

- **First Linux CI run (this directory has no 12 PNGs):**
  `tests/ui/ci-linux.sh` runs `UPDATE_UI_GOLDENS=1 tests/ui/run.sh`, writes the
  12 captures here, prints **`UI baselines bootstrapped`**, uploads artifact
  `notepad-calc-ui-captures`, and the workflow commits/pushes them. **Exit 0.**
  Pixel-diff is skipped that run (not a same-run tautology).
- **Later Linux CI runs (PNGs present in git):** a **fresh** temp capture is
  pixel-diffed against these files (2% AE). Divergence **fails**. That is the
  real visual gate.
- **macOS:** `tests/ui/run.sh` skip-warns (no qml/Quickshell).

## Manual bootstrap (if the workflow cannot push)

```sh
# on a Linux runner with Quickshell on QML2_IMPORT_PATH:
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
git add tests/goldens/ui/*.png
git commit -m "chore: bootstrap Linux Item.grabToImage UI goldens"
```

Or download artifact `notepad-calc-ui-captures` and copy the 12 PNGs here.
