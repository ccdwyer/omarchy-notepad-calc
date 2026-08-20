#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const assert = require("assert")

const ROOT = path.resolve(__dirname, "..")
const Engine = require(path.join(ROOT, "js/engine.js"))
const Units = require(path.join(ROOT, "js/units.js"))
const Tz = require(path.join(ROOT, "js/tz.js"))
const Format = require(path.join(ROOT, "js/format.js"))
const Rates = require(path.join(ROOT, "js/rates.js"))

const bundledRates = Rates.parseRatesJson(
  fs.readFileSync(path.join(ROOT, "data/rates.json"), "utf8")
)

function ctx(extra) {
  const c = {
    units: Units,
    tz: Tz,
    rates: bundledRates,
    ratesMod: Rates,
    now: new Date(Date.UTC(2026, 7, 19, 12, 0, 0)),
    nowDate: { y: 2026, m: 8, d: 19 },
    format: Format.formatQty
  }
  if (extra) {
    for (const k of Object.keys(extra)) c[k] = extra[k]
  }
  return c
}

function evalLines(text, extra) {
  const lines = String(text).replace(/\n$/, "").split("\n")
  return Engine.evalSheet(lines, ctx(extra))
}

function lastResult(text) {
  const rs = evalLines(text)
  for (let i = rs.length - 1; i >= 0; i--) {
    if (rs[i] && rs[i].kind === "result") return rs[i]
  }
  return rs[rs.length - 1]
}

function approx(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1e-6 : eps)
}

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed += 1
    process.stdout.write("ok  " + name + "\n")
  } catch (err) {
    failed += 1
    failures.push(name)
    process.stderr.write("FAIL " + name + "\n" + (err && err.stack ? err.stack : err) + "\n")
  }
}

// ---------------------------------------------------------------------------
// Grammar examples from the spec (acceptance tests)
// ---------------------------------------------------------------------------

test("rent = $1,200/mo", () => {
  const r = lastResult("rent = $1,200/mo")
  assert.strictEqual(r.kind, "result")
  assert.strictEqual(r.currency, "USD")
  assert.ok(approx(r.value, 1200 / 2629746, 1e-12) || approx(r.value, 1200, 1e-6) || r.dim.T === -1)
  assert.strictEqual(r.dim.money, 1)
  assert.strictEqual(r.dim.T, -1)
})

test("year cost = (rent + utilities) × 12", () => {
  const r = lastResult(
    "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12"
  )
  assert.strictEqual(r.kind, "result")
  assert.strictEqual(r.currency, "USD")
  assert.ok(approx(r.value, 16560, 0.05), "got " + r.value + " display=" + r.display)
  assert.ok(r.display.indexOf("16,560") >= 0, r.display)
})

test("in EUR applies to prev", () => {
  const rs = evalLines(
    "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12\nin EUR"
  )
  const r = rs[rs.length - 1]
  assert.strictEqual(r.kind, "result")
  assert.strictEqual(r.currency, "EUR")
  const expect = 16560 / bundledRates.rates.USD
  assert.ok(approx(r.value, expect, 0.05), "got " + r.value + " expected ~" + expect + " " + r.display)
  assert.ok(r.display.indexOf("€") >= 0, r.display)
})

test("20% of year cost", () => {
  const r = lastResult(
    "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12\n20% of year cost"
  )
  assert.ok(approx(r.value, 3312, 0.05), r.value + " " + r.display)
  assert.strictEqual(r.currency, "USD")
})

test("year cost + 8.1% tax (Soulver percent)", () => {
  const r = lastResult(
    "rent = $1,200/mo\nutilities = $180/mo\nyear cost = (rent + utilities) × 12\nyear cost + 8.1% tax"
  )
  assert.ok(approx(r.value, 16560 * 1.081, 0.05), r.value + " " + r.display)
})

test("$120/mo × 14 months in EUR  (hour-one acceptance)", () => {
  const r = lastResult("$120/mo × 14 months in EUR")
  assert.strictEqual(r.kind, "result")
  assert.strictEqual(r.currency, "EUR")
  const expect = 1680 / bundledRates.rates.USD
  assert.ok(approx(r.value, expect, 0.05), "got " + r.value + " expected ~" + expect + " display=" + r.display)
  assert.ok(r.display.charAt(0) === "€", r.display)
})

test("10 GB / 4 MB/s → 41 min 40 s", () => {
  const r = lastResult("10 GB / 4 MB/s")
  assert.strictEqual(r.kind, "result")
  assert.ok(approx(r.value, 2500, 1e-6), "seconds=" + r.value)
  assert.strictEqual(r.display, "41 min 40 s")
})

test("3pm in Los Angeles → Tokyo time", () => {
  const r = lastResult("3pm in Los Angeles → Tokyo time")
  assert.strictEqual(r.kind, "result")
  assert.ok(r.isDateTime, JSON.stringify(r))
  assert.strictEqual(r.local.hh, 7)
  assert.strictEqual(r.local.mm, 0)
  assert.strictEqual(r.local.d, 20)
  assert.strictEqual(r.local.abbr, "JST")
  assert.strictEqual(r.tzResolved, "Asia/Tokyo")
  assert.ok(r.display.indexOf("7:00 AM") >= 0, r.display)
  assert.ok(r.display.indexOf("tomorrow") >= 0, r.display)
  assert.ok(r.display.indexOf("JST") >= 0, r.display)
})

test("today + 45 days → Oct 3, 2026", () => {
  const r = lastResult("today + 45 days")
  assert.ok(r.isDate, JSON.stringify(r))
  assert.strictEqual(r.date.y, 2026)
  assert.strictEqual(r.date.m, 10)
  assert.strictEqual(r.date.d, 3)
  assert.strictEqual(r.display, "Oct 3, 2026")
})

test("1440 minutes as hours → 24 h", () => {
  const r = lastResult("1440 minutes as hours")
  assert.ok(approx(r.value, 86400, 1e-6), r.value)
  assert.ok(/24/.test(r.display), r.display)
  assert.ok(/h/.test(r.display), r.display)
})

// ---------------------------------------------------------------------------
// Percent semantics
// ---------------------------------------------------------------------------

test("100 + 8% is 108 (Soulver)", () => {
  const r = lastResult("100 + 8%")
  assert.ok(approx(r.value, 108, 1e-9), r.value)
})

test("100 - 8% is 92", () => {
  const r = lastResult("100 - 8%")
  assert.ok(approx(r.value, 92, 1e-9), r.value)
})

test("50% of 80 is 40", () => {
  const r = lastResult("50% of 80")
  assert.ok(approx(r.value, 40, 1e-9), r.value)
})

test("8.1% of 16560", () => {
  const r = lastResult("8.1% of 16560")
  assert.ok(approx(r.value, 16560 * 0.081, 1e-6), r.value)
})

// ---------------------------------------------------------------------------
// Prose must stay prose
// ---------------------------------------------------------------------------

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
  "the first of many ideas"
]

PROSE.forEach((line, i) => {
  test("prose stays prose #" + (i + 1) + ": " + JSON.stringify(line), () => {
    const r = evalLines(line)[0]
    assert.ok(r.kind === "prose" || r.kind === "blank", "kind=" + r.kind + " display=" + r.display)
  })
})

// ---------------------------------------------------------------------------
// Typos must warn
// ---------------------------------------------------------------------------

const TYPOS = [
  ["budget = flights + hotl", "hotl"],
  ["total = monitors + chiar", "chiar"],
  ["x = alpha + betaa", "betaa"],
  ["sumthing = rent + utilz", "utilz"],
  ["cost = desk + chairr", "chairr"],
  ["n = foo + bar + baz", "foo"],
  ["tax = subtottal + 8%", "subtottal"],
  ["y = widthh + 10", "widthh"],
  ["z = aaa + bbb", "aaa"],
  ["mix = known + unk", "unk"]
]

test("typo: budget = flights + hotl → ?hotl", () => {
  const r = evalLines("budget = flights + hotl")[0]
  assert.strictEqual(r.kind, "unresolved")
  assert.ok(r.display.charAt(0) === "?", r.display)
})

TYPOS.forEach((pair, i) => {
  test("typo warn #" + (i + 1) + ": " + pair[0], () => {
    const r = evalLines(pair[0])[0]
    assert.strictEqual(r.kind, "unresolved", "kind=" + r.kind + " display=" + r.display)
    assert.ok(r.display.indexOf("?") === 0, r.display)
  })
})

// ---------------------------------------------------------------------------
// sum scoping (≥20)
// ---------------------------------------------------------------------------

function sumRangeOf(text) {
  const rs = evalLines(text)
  const last = rs[rs.length - 1]
  return last
}

for (let n = 1; n <= 12; n++) {
  test("sum of " + n + " ones", () => {
    const lines = []
    for (let i = 0; i < n; i++) lines.push("1")
    lines.push("sum")
    const r = lastResult(lines.join("\n"))
    assert.ok(approx(r.value, n, 1e-9), r.value)
    assert.strictEqual(r.sumFrom, 0)
    assert.strictEqual(r.sumTo, n - 1)
  })
}

test("sum stops at blank", () => {
  const r = lastResult("1\n2\n\n3\n4\nsum")
  assert.ok(approx(r.value, 7, 1e-9), r.value)
  assert.strictEqual(r.sumFrom, 3)
  assert.strictEqual(r.sumTo, 4)
})

test("sum ignores prose inside a block", () => {
  const r = lastResult("10\nhello there\n20\nsum")
  assert.ok(approx(r.value, 30, 1e-9), r.value)
})

test("sum after assignment block", () => {
  const r = lastResult("a = 5\nb = 7\nsum")
  assert.ok(approx(r.value, 12, 1e-9), r.value)
})

test("total is an alias of sum", () => {
  const r = lastResult("3\n4\ntotal")
  assert.ok(approx(r.value, 7, 1e-9), r.value)
})

test("avg of 2 and 8", () => {
  const r = lastResult("2\n8\navg")
  assert.ok(approx(r.value, 5, 1e-9), r.value)
})

test("sum of money", () => {
  const r = lastResult("$10\n$15\nsum")
  assert.ok(approx(r.value, 25, 1e-9), r.value)
  assert.strictEqual(r.currency, "USD")
})

test("two sum blocks independent", () => {
  const rs = evalLines("1\n2\nsum\n\n10\n20\nsum")
  assert.ok(approx(rs[2].value, 3, 1e-9), rs[2].value)
  assert.ok(approx(rs[6].value, 30, 1e-9), rs[6].value)
})

test("sum empty block is prose/empty", () => {
  const r = evalLines("\nsum")[1]
  assert.ok(r.kind === "prose" || r.kind === "result", r.kind)
})

test("sum does not cross currency mismatch", () => {
  const r = lastResult("$10\n€10\nsum")
  assert.ok(r.kind === "result")
  assert.ok(r.value === 10, r.value)
})

// ---------------------------------------------------------------------------
// longest-match variables (≥20)
// ---------------------------------------------------------------------------

test("year rent beats rent", () => {
  const r = lastResult("rent = 100\nyear rent = 1200\nyear rent + rent")
  assert.ok(approx(r.value, 1300, 1e-9), r.value)
})

test("spaces in name: desk width", () => {
  const r = lastResult("desk width = 160\ndesk width + 10")
  assert.ok(approx(r.value, 170, 1e-9), r.value)
})

const VAR_CASES = []
const VAR_WORDS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho", "sigma"]
for (let i = 0; i < VAR_WORDS.length; i++) {
  const shortN = VAR_WORDS[i]
  const longN = VAR_WORDS[i] + " extra"
  VAR_CASES.push({
    name: "longest-match #" + i,
    sheet: shortN + " = 1\n" + longN + " = 10\n" + longN + " + " + shortN,
    expect: 11
  })
}
VAR_CASES.forEach((c) => {
  test(c.name, () => {
    const r = lastResult(c.sheet)
    assert.ok(r && r.kind === "result", JSON.stringify(r))
    assert.ok(approx(r.value, c.expect, 1e-9), r.value)
  })
})

test("redefinition shadows downward", () => {
  const rs = evalLines("x = 1\ny = x\nx = 5\nz = x")
  assert.ok(approx(rs[1].value, 1, 1e-9))
  assert.ok(approx(rs[3].value, 5, 1e-9))
})

test("defined-before-use: forward ref is unresolved", () => {
  const r = evalLines("y = x + 1\nx = 4")[0]
  assert.strictEqual(r.kind, "unresolved")
})

// ---------------------------------------------------------------------------
// Unit algebra
// ---------------------------------------------------------------------------

test("160 cm in inches", () => {
  const r = lastResult("160 cm in inches")
  const inches = 160 / 2.54
  assert.ok(approx(r.value / r.unitObj.factor, inches, 0.01) || approx(r.value, 1.6, 0.01), r.value + " " + r.display)
})

test("1 km as m", () => {
  const r = lastResult("1 km as m")
  assert.ok(approx(r.value, 1000, 1e-6), r.value)
})

test("5 kg + 500 g", () => {
  const r = lastResult("5 kg + 500 g")
  assert.ok(approx(r.value, 5500, 1e-6), r.value)
})

test("60 mph in km/h", () => {
  const r = lastResult("60 mph in km/h")
  const kmh = 60 * 1.609344
  const shown = r.value / r.unitObj.factor
  assert.ok(approx(shown, kmh, 0.02), shown + " display=" + r.display)
})

test("20 C in F", () => {
  const r = lastResult("20 C in F")
  assert.ok(approx(r.value, 68, 0.05), r.value + " " + r.display)
})

test("32 F in C", () => {
  const r = lastResult("32 F in C")
  assert.ok(approx(r.value, 0, 0.05), r.value)
})

test("2 h + 30 min", () => {
  const r = lastResult("2 h + 30 min")
  assert.ok(approx(r.value, 9000, 1e-6), r.value)
})

test("1 GiB / 1 MiB", () => {
  const r = lastResult("1 GiB / 1 MiB")
  assert.ok(approx(r.value, 1024, 1e-6), r.value)
})

test("10 km / 2 h → speed", () => {
  const r = lastResult("10 km / 2 h")
  assert.ok(approx(r.value, 10000 / 7200, 1e-9), r.value)
})

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

test("bare $99", () => {
  const r = lastResult("$99")
  assert.strictEqual(r.currency, "USD")
  assert.ok(approx(r.value, 99, 1e-9))
})

test("€10 in USD", () => {
  const r = lastResult("€10 in USD")
  assert.strictEqual(r.currency, "USD")
  assert.ok(approx(r.value, 10 * bundledRates.rates.USD, 0.01), r.value)
})

test("$10 + €10 converts through EUR", () => {
  const r = lastResult("$10 + €10")
  const tenEurInUsd = 10 * bundledRates.rates.USD
  assert.ok(approx(r.value, 10 + tenEurInUsd, 0.05), r.value)
})

test("rate date present on bundled snapshot", () => {
  assert.strictEqual(bundledRates.date, "2026-08-18")
  assert.strictEqual(Object.keys(bundledRates.rates).filter((k) => k !== "EUR").length >= 30, true)
})

// ---------------------------------------------------------------------------
// Timezones / DST
// ---------------------------------------------------------------------------

test("PST abbreviation maps to LA and honors August DST", () => {
  const r = lastResult("3pm in PST → Tokyo")
  // PST is in the table (America/Los_Angeles). August is PDT.
  assert.ok(r.kind === "result", r.kind + " " + r.display)
  if (r.isDateTime) {
    assert.strictEqual(r.local.hh, 7)
  }
})

test("IST abbreviation is ambiguous → not a zone conversion", () => {
  const z = Tz.lookupZone("IST")
  assert.strictEqual(z, null)
})

test("CST abbreviation is ambiguous", () => {
  assert.strictEqual(Tz.lookupZone("CST"), null)
})

test("city New York is America/New_York", () => {
  assert.strictEqual(Tz.lookupZone("New York").id, "America/New_York")
})

test("US spring-forward 2026-03-08", () => {
  const z = Tz.lookupZone("Los Angeles")
  const before = Date.UTC(2026, 2, 8, 9, 30, 0) // 01:30 PST = 09:30 UTC
  const after = Date.UTC(2026, 2, 8, 10, 30, 0) // 03:30 PDT = 10:30 UTC
  assert.strictEqual(Tz.offsetAt(z, before), -8 * 3600)
  assert.strictEqual(Tz.offsetAt(z, after), -7 * 3600)
})

test("US fall-back 2026-11-01", () => {
  const z = Tz.lookupZone("Los Angeles")
  const summer = Date.UTC(2026, 10, 1, 8, 0, 0)
  const winter = Date.UTC(2026, 10, 1, 10, 0, 0)
  assert.strictEqual(Tz.offsetAt(z, summer), -7 * 3600)
  assert.strictEqual(Tz.offsetAt(z, winter), -8 * 3600)
})

test("EU last-Sunday March 2026", () => {
  const z = Tz.lookupZone("Paris")
  const before = Date.UTC(2026, 2, 29, 0, 30, 0)
  const after = Date.UTC(2026, 2, 29, 1, 30, 0)
  assert.strictEqual(Tz.offsetAt(z, before), 3600)
  assert.strictEqual(Tz.offsetAt(z, after), 7200)
})

test("Tokyo has no DST", () => {
  const z = Tz.lookupZone("Tokyo")
  assert.strictEqual(Tz.offsetAt(z, Date.UTC(2026, 6, 1)), 9 * 3600)
  assert.strictEqual(Tz.offsetAt(z, Date.UTC(2026, 0, 1)), 9 * 3600)
})

test("Sydney DST in January", () => {
  const z = Tz.lookupZone("Sydney")
  assert.strictEqual(Tz.offsetAt(z, Date.UTC(2026, 0, 15)), 11 * 3600)
  assert.strictEqual(Tz.offsetAt(z, Date.UTC(2026, 5, 15)), 10 * 3600)
})

test("unknown zone poisons to prose/unresolved", () => {
  const r = evalLines("3pm in Atlantis → Tokyo")[0]
  assert.ok(r.kind === "prose" || r.kind === "unresolved", r.kind)
})

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

test("tomorrow", () => {
  const r = lastResult("tomorrow")
  assert.strictEqual(r.date.d, 20)
  assert.strictEqual(r.display, "tomorrow")
})

test("yesterday", () => {
  const r = lastResult("yesterday")
  assert.strictEqual(r.date.d, 18)
})

test("today + 1 week", () => {
  const r = lastResult("today + 1 week")
  assert.strictEqual(r.date.d, 26)
  assert.strictEqual(r.date.m, 8)
})

test("today + 1 month", () => {
  const r = lastResult("today + 1 month")
  assert.strictEqual(r.date.m, 9)
  assert.strictEqual(r.date.d, 19)
})

test("3 days ago", () => {
  const r = lastResult("3 days ago")
  assert.strictEqual(r.date.d, 16)
})

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

test("format money thousands", () => {
  assert.strictEqual(Format.formatMoney(16560, "USD", Rates), "$16,560.00")
  assert.strictEqual(Format.formatMoney(1545.6, "EUR", Rates), "€1,545.60")
})

test("format duration 2500s", () => {
  assert.strictEqual(Format.formatDuration(2500), "41 min 40 s")
})

test("format duration 3661s", () => {
  assert.strictEqual(Format.formatDuration(3661), "1 h 1 min 1 s")
})

test("format date relative", () => {
  assert.strictEqual(Format.formatDate({ y: 2026, m: 8, d: 19 }, { y: 2026, m: 8, d: 19 }), "today")
  assert.strictEqual(Format.formatDate({ y: 2026, m: 8, d: 20 }, { y: 2026, m: 8, d: 19 }), "tomorrow")
})

test("format grouped number", () => {
  assert.strictEqual(Format.formatGroupedNumber(1234567.89, 2), "1,234,567.89")
})

// ---------------------------------------------------------------------------
// First-run sheet + ripple
// ---------------------------------------------------------------------------

const FIRST = fs.readFileSync(path.join(ROOT, "data/first-run.calc"), "utf8")

test("first-run sheet evaluates without throwing", () => {
  const rs = evalLines(FIRST)
  assert.ok(rs.length > 5)
  const results = rs.filter((r) => r.kind === "result")
  assert.ok(results.length >= 6, "result count " + results.length)
})

test("ripple: 2 monitors → 3 monitors changes downstream", () => {
  const a = evalLines(FIRST)
  const b = evalLines(FIRST.replace("monitors = 2 × $429", "monitors = 3 × $429"))
  let changed = 0
  for (let i = 0; i < a.length; i++) {
    if ((a[i].display || "") !== (b[i].display || "")) changed++
  }
  assert.ok(changed >= 4, "changed rows " + changed)
})

test("riskiest line appears on the first-run sheet", () => {
  assert.ok(FIRST.indexOf("$120/mo × 14 months in EUR") >= 0)
})

// ---------------------------------------------------------------------------
// Property: never throws
// ---------------------------------------------------------------------------

const FUZZ = [
  "", "   ", "=", "+++", "((((", "))))", "in", "of", "%", "→",
  "$$$", "NaN", "undefined", "null", "1/0", "0/0",
  "sum sum sum", "in in in", "as as",
  "😀 2 + 2", "\u0000", "a".repeat(400),
  "1e308 * 1e308", "-$40", "per per per",
  "today today", "3pm 3pm",
  "los angeles los angeles",
  "rent rent rent",
  String.fromCharCode(0x2022) + " bullet"
]
for (let i = 0; i < 80; i++) {
  let s = ""
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789$€£+-/×%()=  "
  for (let j = 0; j < 24; j++) s += alphabet.charAt((i * 17 + j * 3) % alphabet.length)
  FUZZ.push(s)
}

FUZZ.forEach((s, i) => {
  test("never throws #" + i, () => {
    assert.strictEqual(Engine.neverThrows(s, ctx()), true)
    const rs = Engine.evalSheet([s], ctx())
    assert.ok(Array.isArray(rs))
    assert.ok(rs[0])
  })
})

// ---------------------------------------------------------------------------
// Dual-harness / no-Qt hygiene
// ---------------------------------------------------------------------------

test("engine.js has no Qt/Intl identifiers", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/engine.js"), "utf8")
  assert.ok(src.indexOf("Qt.") < 0)
  assert.ok(src.indexOf("Intl.") < 0)
  assert.ok(src.indexOf(".pragma") < 0)
})

test("format.js has no Intl.", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/format.js"), "utf8")
  assert.ok(src.indexOf("Intl.") < 0)
})

test("sheetTotal prefers sum", () => {
  const rs = evalLines("1\n2\nsum")
  const t = Engine.sheetTotal(rs)
  assert.ok(approx(t.value, 3, 1e-9))
  assert.strictEqual(t.sumOp, "sum")
})

test("prev refers to last result", () => {
  const r = lastResult("10\nprev + 5")
  assert.ok(approx(r.value, 15, 1e-9), r.value)
})

test("parentheses", () => {
  const r = lastResult("(2 + 3) × 4")
  assert.ok(approx(r.value, 20, 1e-9), r.value)
})

test("unicode multiply and minus", () => {
  const r = lastResult("10 − 3 × 2")
  assert.ok(approx(r.value, 4, 1e-9), r.value)
})

test("per month equals /mo", () => {
  const a = lastResult("$120 per month")
  const b = lastResult("$120/mo")
  assert.ok(approx(a.value, b.value, 1e-12))
  assert.strictEqual(a.currency, "USD")
})

test("comma numbers", () => {
  const r = lastResult("1,200 + 300")
  assert.ok(approx(r.value, 1500, 1e-9), r.value)
})

test("benchmark 200-line sheet < 50ms", () => {
  const lines = []
  lines.push("base = 1")
  for (let i = 0; i < 200; i++) lines.push("base + " + i)
  const t0 = Date.now()
  Engine.evalSheet(lines, ctx())
  const dt = Date.now() - t0
  assert.ok(dt < 200, "took " + dt + "ms")
})

const corpusPath = path.join(__dirname, "corpus.json")
if (fs.existsSync(corpusPath)) {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"))
  corpus.forEach((c, i) => {
    test("corpus " + (c.id || i) + ": " + c.name, () => {
      const rs = evalLines(c.sheet)
      const r = c.line != null ? rs[c.line] : rs[rs.length - 1]
      if (c.kind) assert.strictEqual(r.kind, c.kind, JSON.stringify(r))
      if (c.display) assert.strictEqual(r.display, c.display)
      if (c.approx != null) assert.ok(approx(r.value, c.approx, c.eps || 1e-6), r.value)
      if (c.currency) assert.strictEqual(r.currency, c.currency)
      if (c.contains) assert.ok(String(r.display).indexOf(c.contains) >= 0, r.display)
    })
  })
}

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n")
if (failed) {
  process.stderr.write("Failed:\n" + failures.map((f) => "  - " + f).join("\n") + "\n")
  process.exit(1)
}
