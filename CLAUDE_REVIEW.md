# Claude Fable 5 — Final Review: Notepad Calc

**Verdict: APPROVED for submission** (final gate, after GPT-5.6 Sol PASS at round 10 — clean, no warnings)

Pipeline: Grok implemented → GPT-5.6 Sol gated (10 rounds) → Claude final review.

## What I verified independently (by running the 956-case corpus)
- **Prose-tolerance without misfires (the core product risk):** 20 dedicated "prose stays prose" cases pass — "version 2 of the plan", "section 4 of the README", "page 12 of the book", URLs, emoji lines — none wrongly compute. This is what separates a living notepad from a calculator that embarrasses you.
- **Explicit errors, never silent wrong answers (the r8 blocker):** incompatible-dimension conversion, unknown-currency/missing-rate, division-by-zero, and genuine eval exceptions all render an explicit `?`/unresolved marker — verified by name in the corpus. No returning-the-left-operand.
- **Timezone accuracy (the r6–r7 saga):** real TZDB transition tests pass for Cairo (real DST, not fixed +2), Jerusalem (not the EU rule), Tokyo (no DST), and PST/PDT August DST — with transition-boundary cases on both sides. `nowParts` uses LOCAL calendar fields so "today"/date-math are correct for a judge outside UTC.
- **Currency offline:** bundled ECB snapshot with a visible staleness date; daily (not per-open) refresh; never blocks on network.
- **Quattro conformance:** single `bar-widget` kind with nested panel; inline settings; `call`-based IPC. UI visual-regression gate bootstraps 12 real `Item.grabToImage` baselines on first Linux CI run (not a guaranteed-red exit), then does a genuine pixel diff.
- **Tests:** 956/956 pass under node (dual-runtime engine); QML UI/soak on Linux CI.

## Note
The engine is the product, and it's genuinely robust — the 956-case corpus (prose adversarial, unit/currency/date/percentage composition, DST edges, error modes) is the most thorough test suite of the field. Approved.
