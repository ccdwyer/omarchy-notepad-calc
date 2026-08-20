# UI goldens

These PNGs are **Linux `Item.grabToImage` captures** of `Panel.qml`'s `chrome` Item
(1× / 1.25× / 2× × demo / longline / emoji / url). They are not synthetic stand-ins.

**This macOS checkout cannot produce them.** The target runtime is Linux
Quickshell + Qt6, which only exists on the GitHub Actions runner.

## Gate

The CI is split into two jobs so that no `contents: write` token is ever held
while untrusted PR code runs (GitHub Actions pwn-request hardening).

- **`qml-ui-soak-demo`** — runs on every push and PR with a **read-only** token.
  - *No 12 PNGs here yet:* `tests/ui/ci-linux.sh` runs
    `UPDATE_UI_GOLDENS=1 tests/ui/run.sh`, writes the 12 captures, prints
    **`UI baselines bootstrapped`**, uploads artifact `notepad-calc-ui-captures`,
    and **exits 0** (not a same-run tautology, and the branch is not
    guaranteed-red). It does **not** commit.
  - *PNGs present in git:* a **fresh** temp capture is pixel-diffed against these
    files (2% AE). Divergence **fails**. That is the real visual gate.
- **`bootstrap-ui-goldens`** — commits the baselines. Runs **only** on a manual
  `workflow_dispatch` or a push to the repo's **own default branch** (never a
  PR), with `contents: write` and a trusted `github.ref_name` checkout. A
  maintainer runs it once to seed the goldens; the read-only PR job then enforces
  the diff on every change.
- **macOS:** `tests/ui/run.sh` skip-warns (no qml/Quickshell).

## Manual bootstrap

```sh
# on a Linux runner with Quickshell on QML2_IMPORT_PATH:
UPDATE_UI_GOLDENS=1 REQUIRE_QML_UI=1 tests/ui/run.sh
git add tests/goldens/ui/*.png
git commit -m "chore: bootstrap Linux Item.grabToImage UI goldens"
```

Or download artifact `notepad-calc-ui-captures` and copy the 12 PNGs here.
