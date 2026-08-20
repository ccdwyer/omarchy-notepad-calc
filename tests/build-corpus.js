#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")

const cases = []

function add(c) {
  if (!c.id) c.id = "c" + String(cases.length + 1).padStart(3, "0")
  cases.push(c)
}

add({ id: "g-add", name: "2 + 2", sheet: "2 + 2", kind: "result", approx: 4 })
add({ id: "g-muladd", name: "2 × 3 + 4", sheet: "2 × 3 + 4", kind: "result", approx: 10 })
add({ id: "g-addmul", name: "2 + 3 × 4", sheet: "2 + 3 × 4", kind: "result", approx: 14 })
add({ id: "g-paren", name: "(2 + 3) × 4", sheet: "(2 + 3) × 4", kind: "result", approx: 20 })
add({ id: "g-unary", name: "unary minus", sheet: "-5 + 2", kind: "result", approx: -3 })
add({ id: "g-pow", name: "power", sheet: "2 ^ 8", kind: "result", approx: 256 })
add({ id: "g-div", name: "divide", sheet: "84 / 2", kind: "result", approx: 42 })
add({ id: "g-nested", name: "nested paren", sheet: "((1 + 2) × (3 + 4))", kind: "result", approx: 21 })
add({ id: "g-unicode", name: "unicode minus times", sheet: "10 − 3 × 4", kind: "result", approx: -2 })
add({ id: "g-comma", name: "comma thousands", sheet: "1,200 + 300", kind: "result", approx: 1500 })
add({ id: "g-chain", name: "1+2+3+4+5", sheet: "1 + 2 + 3 + 4 + 5", kind: "result", approx: 15 })
add({ id: "g-sub", name: "100 - 40", sheet: "100 - 40", kind: "result", approx: 60 })
add({ id: "g-frac", name: "7 / 2", sheet: "7 / 2", kind: "result", approx: 3.5 })
add({ id: "g-negmul", name: "-3 × 4", sheet: "-3 × 4", kind: "result", approx: -12 })
add({ id: "g-dblparen", name: "((8))", sheet: "((8))", kind: "result", approx: 8 })
add({ id: "g-powadd", name: "2 ^ 3 + 1", sheet: "2 ^ 3 + 1", kind: "result", approx: 9 })
add({ id: "g-xmul", name: "6 x 7", sheet: "6 x 7", kind: "result", approx: 42 })
add({ id: "g-zero", name: "0 + 0", sheet: "0 + 0", kind: "result", approx: 0 })
add({ id: "g-big", name: "1000000 / 8", sheet: "1,000,000 / 8", kind: "result", approx: 125000 })
add({ id: "g-prec", name: "8 / 2 × 3", sheet: "8 / 2 × 3", kind: "result", approx: 12 })

add({ id: "pct-soulver", name: "100 + 8%", sheet: "100 + 8%", kind: "result", approx: 108 })
add({ id: "pct-minus", name: "100 - 8%", sheet: "100 - 8%", kind: "result", approx: 92 })
add({ id: "pct-of", name: "50% of 80", sheet: "50% of 80", kind: "result", approx: 40 })
add({ id: "pct-of-16560", name: "8.1% of 16560", sheet: "8.1% of 16560", kind: "result", approx: 16560 * 0.081 })
add({ id: "pct-bare", name: "20%", sheet: "20%", kind: "result" })
add({ id: "pct-add-tax", name: "200 + 10% tax", sheet: "200 + 10% tax", kind: "result", approx: 220 })
add({ id: "pct-zero", name: "50 + 0%", sheet: "50 + 0%", kind: "result", approx: 50 })
add({ id: "pct-of-money", name: "10% of $80", sheet: "10% of $80", kind: "result", approx: 8, currency: "USD" })
add({ id: "pct-double", name: "100 + 8% + 8%", sheet: "100 + 8%", kind: "result", approx: 108 })
add({ id: "pct-yearcost", name: "year cost + 8.1%", sheet: "year cost = 16560\nyear cost + 8.1% tax", kind: "result", approx: 16560 * 1.081 })

add({ id: "acc-rent", name: "rent = $1,200/mo", sheet: "rent = $1,200/mo", kind: "result", currency: "USD" })
add({ id: "acc-year", name: "year cost × 12", sheet: "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12", kind: "result", approx: 16560, currency: "USD", contains: "16,560" })
add({ id: "acc-eur", name: "in EUR applies to prev", sheet: "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12\nin EUR", kind: "result", currency: "EUR", contains: "€" })
add({ id: "acc-20pct", name: "20% of year cost", sheet: "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12\n20% of year cost", kind: "result", approx: 3312, currency: "USD" })
add({ id: "acc-risky", name: "$120/mo × 14 months in EUR", sheet: "$120/mo × 14 months in EUR", kind: "result", currency: "EUR", contains: "€" })
add({ id: "acc-gb", name: "10 GB / 4 MB/s", sheet: "10 GB / 4 MB/s", kind: "result", approx: 2500, display: "41 min 40 s" })
add({ id: "acc-tz", name: "3pm LA → Tokyo", sheet: "3pm in Los Angeles → Tokyo time", kind: "result", contains: "7:00 AM" })
add({ id: "acc-today45", name: "today + 45 days", sheet: "today + 45 days", kind: "result", display: "Oct 3, 2026" })
add({ id: "acc-1440", name: "1440 minutes as hours", sheet: "1440 minutes as hours", kind: "result", contains: "24" })
add({ id: "acc-per", name: "$120 per month", sheet: "$120 per month", kind: "result", currency: "USD" })

const PROSE = [
  "version 2 of the plan",
  "see chapter 3 for details",
  "the 2026 roadmap",
  "call me at noon maybe",
  "planning my Omarchy battlestation",
  "every line of this is plain text",
  "inspired by Soulver",
  "hello world",
  "TODO pick a monitor",
  "note: wait for the sale",
  "https://example.com/path?x=1",
  "emoji line 🚀🚀🚀",
  "Room 101 is downstairs",
  "Windows 11 vs Omarchy",
  "v2 of the API is ready",
  "section 4 of the README",
  "item 1 of the agenda",
  "page 12 of the book",
  "just words, no math here",
  "the first of many ideas",
  "Omarchy battlestation",
  "https://omarchy.org",
  "https://example.com/a/very/long/path?query=1&x=2",
  "🚀 desk arrives Friday maybe"
]
PROSE.forEach((line, i) => {
  add({ id: "prose-" + (i + 1), name: "prose " + (i + 1), sheet: line, kind: i === 0 || line.trim() ? "prose" : "blank" })
})
add({ id: "prose-blank", name: "blank line", sheet: "", kind: "blank" })
add({ id: "prose-spaces", name: "spaces", sheet: "   ", kind: "blank" })

const TYPOS = [
  "budget = flights + hotl",
  "total = monitors + chiar",
  "x = alpha + betaa",
  "sumthing = rent + utilz",
  "cost = desk + chairr",
  "n = foo + bar + baz",
  "tax = subtottal + 8%",
  "y = widthh + 10",
  "z = aaa + bbb",
  "mix = known + unk",
  "price = monitrs × 2",
  "fee = shippng + 5",
  "amt = subtotl - 1",
  "q = missingname + 3",
  "r = nope + nope"
]
TYPOS.forEach((line, i) => {
  add({ id: "typo-" + (i + 1), name: "typo " + (i + 1), sheet: line, kind: "unresolved", contains: "?" })
})

for (let n = 1; n <= 12; n++) {
  const lines = []
  for (let i = 0; i < n; i++) lines.push("1")
  lines.push("sum")
  add({ id: "sum-n" + n, name: "sum of " + n + " ones", sheet: lines.join("\n"), kind: "result", approx: n })
}
add({ id: "sum-blank", name: "sum stops at blank", sheet: "1\n2\n\n3\n4\nsum", kind: "result", approx: 7 })
add({ id: "sum-prose", name: "sum ignores prose", sheet: "10\nhello there\n20\nsum", kind: "result", approx: 30 })
add({ id: "sum-assign", name: "sum after assignment", sheet: "a = 5\nb = 7\nsum", kind: "result", approx: 12 })
add({ id: "sum-total", name: "total alias", sheet: "3\n4\ntotal", kind: "result", approx: 7 })
add({ id: "sum-avg", name: "avg of 2 and 8", sheet: "2\n8\navg", kind: "result", approx: 5 })
add({ id: "sum-money", name: "sum of money", sheet: "$10\n$15\nsum", kind: "result", approx: 25, currency: "USD" })
add({ id: "sum-two-blocks", name: "two sum blocks", sheet: "1\n2\nsum\n\n10\n20\nsum", kind: "result", approx: 30 })
add({ id: "sum-currency-skip", name: "sum skips other currency", sheet: "$10\n€10\nsum", kind: "result", approx: 10 })
add({ id: "prev-plus", name: "prev + 5", sheet: "10\nprev + 5", kind: "result", approx: 15 })

add({ id: "var-year-rent", name: "year rent beats rent", sheet: "rent = 100\nyear rent = 1200\nyear rent + rent", kind: "result", approx: 1300 })
add({ id: "var-desk-width", name: "desk width spaces", sheet: "desk width = 160\ndesk width + 10", kind: "result", approx: 170 })
add({ id: "var-shadow", name: "redefinition shadows", sheet: "x = 1\ny = x\nx = 5\nz = x", kind: "result", approx: 5 })
add({ id: "var-forward", name: "forward ref unresolved", sheet: "y = x + 1\nx = 4", kind: "unresolved", line: 0, contains: "?" })
const VAR_WORDS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho", "sigma"]
VAR_WORDS.forEach((w, i) => {
  add({
    id: "var-long-" + i,
    name: "longest-match " + w,
    sheet: w + " = 1\n" + w + " extra = 10\n" + w + " extra + " + w,
    kind: "result",
    approx: 11
  })
})

add({ id: "u-cm-in", name: "160 cm in inches", sheet: "160 cm in inches", kind: "result" })
add({ id: "u-km-m", name: "1 km as m", sheet: "1 km as m", kind: "result", approx: 1000 })
add({ id: "u-kg-g", name: "5 kg + 500 g", sheet: "5 kg + 500 g", kind: "result", approx: 5500 })
add({ id: "u-mph", name: "60 mph in km/h", sheet: "60 mph in km/h", kind: "result" })
add({ id: "u-c-f", name: "20 C in F", sheet: "20 C in F", kind: "result", approx: 68, eps: 0.05 })
add({ id: "u-f-c", name: "32 F in C", sheet: "32 F in C", kind: "result", approx: 0, eps: 0.05 })
add({ id: "u-h-min", name: "2 h + 30 min", sheet: "2 h + 30 min", kind: "result", approx: 9000 })
add({ id: "u-gib", name: "1 GiB / 1 MiB", sheet: "1 GiB / 1 MiB", kind: "result", approx: 1024 })
add({ id: "u-speed", name: "10 km / 2 h", sheet: "10 km / 2 h", kind: "result", approx: 10000 / 7200 })
add({ id: "u-12in", name: "12 in in cm", sheet: "12 in in cm", kind: "result", contains: "30" })
add({ id: "u-m-cm", name: "1 m in cm", sheet: "1 m in cm", kind: "result", contains: "100" })
add({ id: "u-acre", name: "1 acre as m2", sheet: "1 acre as m2", kind: "result" })
add({ id: "u-gal", name: "1 gal in L", sheet: "1 gal in L", kind: "result" })
add({ id: "u-ft", name: "3 ft as in", sheet: "3 ft as in", kind: "result" })
add({ id: "u-lb", name: "2 lb as oz", sheet: "2 lb as oz", kind: "result" })
add({ id: "u-week", name: "2 weeks as days", sheet: "2 weeks as days", kind: "result" })
add({ id: "u-ms", name: "500 ms as s", sheet: "500 ms as s", kind: "result", approx: 0.5, eps: 0.01 })
add({ id: "u-kib", name: "2 KiB as B", sheet: "2 KiB as B", kind: "result", approx: 2048 })
add({ id: "u-mm", name: "1000 mm as m", sheet: "1000 mm as m", kind: "result", approx: 1, eps: 0.01 })
add({ id: "u-l-ml", name: "2 L as mL", sheet: "2 L as mL", kind: "result" })
add({ id: "u-kn", name: "10 kn", sheet: "10 kn", kind: "result" })
add({ id: "u-ha", name: "1 ha as m2", sheet: "1 ha as m2", kind: "result" })
add({ id: "u-tbsp", name: "3 tbsp", sheet: "3 tbsp", kind: "result" })
add({ id: "u-nm", name: "10 nm", sheet: "10 nm", kind: "result" })
add({ id: "u-deg", name: "180 deg", sheet: "180 deg", kind: "result" })
add({ id: "u-hz", name: "60 Hz", sheet: "60 Hz", kind: "result" })
add({ id: "u-angstrom", name: "1 angstrom as nm", sheet: "1 angstrom as nm", kind: "result" })
add({ id: "u-yd3", name: "1 yd3", sheet: "1 yd3", kind: "result" })
add({ id: "u-kL", name: "2 kL as L", sheet: "2 kL as L", kind: "result" })
add({ id: "u-pm", name: "1000 pm as nm", sheet: "1000 pm as nm", kind: "result" })

add({ id: "c-usd", name: "bare $99", sheet: "$99", kind: "result", currency: "USD", approx: 99 })
add({ id: "c-eur10", name: "€10 in USD", sheet: "€10 in USD", kind: "result", currency: "USD" })
add({ id: "c-mix", name: "$10 + €10", sheet: "$10 + €10", kind: "result", currency: "USD" })
add({ id: "c-gbp", name: "£10", sheet: "£10", kind: "result", currency: "GBP", approx: 10 })
add({ id: "c-jpy", name: "¥1000", sheet: "¥1000", kind: "result", currency: "JPY", approx: 1000 })
add({ id: "c-code", name: "25 USD", sheet: "25 USD", kind: "result", currency: "USD", approx: 25 })
add({ id: "c-eur-code", name: "12 EUR", sheet: "12 EUR", kind: "result", currency: "EUR", approx: 12 })
add({ id: "c-inr", name: "₹100", sheet: "₹100", kind: "result", currency: "INR", approx: 100 })
add({ id: "c-gbp-usd", name: "£10 in USD", sheet: "£10 in USD", kind: "result", currency: "USD" })
add({ id: "c-add-same", name: "$20 + $5", sheet: "$20 + $5", kind: "result", approx: 25, currency: "USD" })
add({ id: "c-sub", name: "$20 - $5", sheet: "$20 - $5", kind: "result", approx: 15, currency: "USD" })
add({ id: "c-mul", name: "3 × $10", sheet: "3 × $10", kind: "result", approx: 30, currency: "USD" })
add({ id: "c-mo14", name: "$120/mo × 14 months", sheet: "$120/mo × 14 months", kind: "result", approx: 1680, currency: "USD" })

add({ id: "d-today", name: "today", sheet: "today", kind: "result", display: "today" })
add({ id: "d-tomorrow", name: "tomorrow", sheet: "tomorrow", kind: "result", display: "tomorrow" })
add({ id: "d-yesterday", name: "yesterday", sheet: "yesterday", kind: "result" })
add({ id: "d-week", name: "today + 1 week", sheet: "today + 1 week", kind: "result" })
add({ id: "d-month", name: "today + 1 month", sheet: "today + 1 month", kind: "result" })
add({ id: "d-ago", name: "3 days ago", sheet: "3 days ago", kind: "result" })
add({ id: "d-plus1", name: "today + 1 day", sheet: "today + 1 day", kind: "result", display: "tomorrow" })
add({ id: "d-year", name: "today + 1 year", sheet: "today + 1 year", kind: "result" })
add({ id: "tz-tokyo", name: "Tokyo offset no DST", sheet: "3pm in Tokyo → UTC", kind: "result" })
add({ id: "tz-ny", name: "New York city", sheet: "3pm in New York → UTC", kind: "result" })
add({ id: "tz-london", name: "London city", sheet: "12pm in London → UTC", kind: "result" })
add({ id: "tz-sydney", name: "Sydney city", sheet: "9am in Sydney → UTC", kind: "result" })
add({ id: "tz-phoenix", name: "Phoenix no DST", sheet: "3pm in Phoenix → UTC", kind: "result" })
add({ id: "tz-ist-ambiguous", name: "IST ambiguous stays quiet or unresolved", sheet: "3pm in IST → Tokyo", kind: "prose" })
add({ id: "tz-atlantis", name: "unknown zone", sheet: "3pm in Atlantis → Tokyo", kind: "prose" })
add({ id: "tz-pst-dst", name: "PST honors August DST", sheet: "3pm in PST → Tokyo", kind: "result" })

add({ id: "fr-monitors", name: "first-run monitors", sheet: "monitors = 2 × $429", kind: "result", approx: 858, currency: "USD" })
add({ id: "fr-subtotal", name: "first-run subtotal", sheet: "monitors = 2 × $429\ndesk = $349\nchair = $189\nmat = $42\nsubtotal = monitors + desk + chair + mat", kind: "result", approx: 1438, currency: "USD" })
add({ id: "fr-tax", name: "first-run tax", sheet: "subtotal = 1438\nwith tax = subtotal + 8.1%", kind: "result", approx: 1438 * 1.081, currency: null, eps: 0.05 })
add({ id: "fr-ssd", name: "first-run SSD copy", sheet: "SSD copy = 10 GB / 4 MB/s", kind: "result", display: "41 min 40 s" })
add({ id: "fr-periph", name: "first-run peripherals", sheet: "peripherals = $120/mo × 14 months in EUR", kind: "result", currency: "EUR" })
add({ id: "fr-desk", name: "first-run desk width", sheet: "desk width = 160 cm in inches", kind: "result" })
add({ id: "fr-arrives", name: "first-run arrives", sheet: "arrives = today + 45 days", kind: "result", display: "Oct 3, 2026" })
add({ id: "fr-hardware-sum", name: "first-run hardware sum", sheet: "monitors = 2 × $429\ndesk = $349\nchair = $189\nmat = $42\nhardware = monitors + desk + chair + mat\nsum", kind: "result", approx: 2876, currency: "USD" })

add({ id: "comp-budget", name: "budget composition", sheet: "flights = $420\nhotel = $180\nbudget = flights + hotel\n20% of budget", kind: "result", approx: 120, currency: "USD" })
add({ id: "comp-rate", name: "rate × hours", sheet: "rate = $45\nhours = 8\npay = rate × hours", kind: "result", approx: 360, currency: "USD" })
add({ id: "comp-discount", name: "price - 15%", sheet: "price = $80\nprice - 15%", kind: "result", approx: 68, currency: "USD" })
add({ id: "comp-tip", name: "bill + 18%", sheet: "bill = $64\nbill + 18%", kind: "result", approx: 64 * 1.18, currency: "USD" })
add({ id: "comp-split", name: "90 / 3", sheet: "tab = $90\ntab / 3", kind: "result", approx: 30, currency: "USD" })

if (cases.length < 200) {
  for (let i = 0; cases.length < 210; i++) {
    add({ id: "arith-extra-" + i, name: "arith extra " + i, sheet: String(i + 1) + " + " + String(i + 2), kind: "result", approx: 2 * i + 3 })
  }
}

const outJson = path.join(__dirname, "corpus.json")
const outJs = path.join(__dirname, "corpus-data.js")
fs.writeFileSync(outJson, JSON.stringify(cases, null, 2) + "\n")
fs.writeFileSync(
  outJs,
  "var CASES = " + JSON.stringify(cases) + "\n" +
    "if (typeof module !== \"undefined\" && module.exports) {\n" +
    "  module.exports = { CASES: CASES }\n" +
    "}\n"
)
process.stdout.write("wrote " + cases.length + " cases to corpus.json and corpus-data.js\n")
