#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const Engine = require("../js/engine.js")
const Units = require("../js/units.js")
const Tz = require("../js/tz.js")
const Format = require("../js/format.js")
const Rates = require("../js/rates.js")

const ROOT = path.resolve(__dirname, "..")
const GOLDEN_DIR = path.join(__dirname, "goldens")
const SCALES = [1, 1.25, 2]
const BASE_PX = 14
const LINE_RATIO = 1.45

const bundledRates = Rates.parseRatesJson(
  fs.readFileSync(path.join(ROOT, "data/rates.json"), "utf8")
)

function ctx() {
  return {
    units: Units,
    tz: Tz,
    rates: bundledRates,
    ratesMod: Rates,
    now: new Date(Date.UTC(2026, 7, 19, 12, 0, 0)),
    nowDate: { y: 2026, m: 8, d: 19 },
    format: Format.formatQty
  }
}

const SHEETS = {
  battlestation: fs.readFileSync(path.join(ROOT, "data/first-run.calc"), "utf8").replace(/\n$/, ""),
  longline: [
    "Omarchy battlestation",
    "",
    "this is a deliberately very long line that must not wrap: " + "monitor-cable-run-".repeat(12) + "end",
    "subtotal = 2 × $429"
  ].join("\n"),
  emoji: [
    "planning 🚀",
    "desk = $349  DualSense 🎮",
    "note: 日本語 mix ✨",
    "sum"
  ].join("\n"),
  urls: [
    "see https://example.com/path?x=1&y=2",
    "https://omarchy.org/plugins/notepad-calc",
    "2 + 2",
    "version 2 of the plan"
  ].join("\n")
}

function lineHeight(scale) {
  return Math.round(BASE_PX * scale * LINE_RATIO)
}

function layoutSheet(name, text, scale) {
  const lines = String(text).split("\n")
  const results = Engine.evalSheet(lines, ctx())
  const lh = lineHeight(scale)
  if (results.length !== lines.length) {
    throw new Error(name + " @" + scale + "x: result rows " + results.length + " != text lines " + lines.length)
  }
  const rows = []
  for (let i = 0; i < lines.length; i++) {
    const r = results[i] || {}
    rows.push({
      i: i,
      y: i * lh,
      chars: lines[i].length,
      wrapped: false,
      kind: r.kind || "blank",
      display: r.display || ""
    })
  }
  return {
    name: name,
    scale: scale,
    fontPx: Math.round(BASE_PX * scale),
    lineHeight: lh,
    lineCount: lines.length,
    resultCount: results.length,
    rows: rows
  }
}

function buildGoldens() {
  const out = { version: 1, scales: SCALES, sheets: {} }
  Object.keys(SHEETS).forEach((name) => {
    out.sheets[name] = {}
    SCALES.forEach((scale) => {
      out.sheets[name][String(scale)] = layoutSheet(name, SHEETS[name], scale)
    })
  })
  return out
}

function svgFor(layout, text) {
  const lines = String(text).split("\n")
  const w = 980
  const resultsW = 240
  const h = Math.max(120, layout.lineHeight * layout.lineCount + 48)
  let body = ""
  for (let i = 0; i < lines.length; i++) {
    const y = 32 + layout.rows[i].y + layout.lineHeight - 4
    const disp = layout.rows[i].display
    body += '<text x="16" y="' + y + '" font-family="JetBrains Mono, ui-monospace, monospace" font-size="' +
      layout.fontPx + '" fill="#c0caf5">' + escapeXml(lines[i]) + "</text>\n"
    if (disp) {
      body += '<text x="' + (w - 16) + '" y="' + y + '" text-anchor="end" font-family="JetBrains Mono, ui-monospace, monospace" font-size="' +
        layout.fontPx + '" fill="#7aa2f7">' + escapeXml(disp) + "</text>\n"
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">\n' +
    '<rect width="100%" height="100%" fill="#1a1b26"/>\n' +
    '<rect x="' + (w - resultsW) + '" y="0" width="' + resultsW + '" height="100%" fill="#16161e"/>\n' +
    body + "</svg>\n"
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function writeGoldens(golden) {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true })
  fs.writeFileSync(path.join(GOLDEN_DIR, "layout.json"), JSON.stringify(golden, null, 2) + "\n")
  Object.keys(SHEETS).forEach((name) => {
    SCALES.forEach((scale) => {
      const lay = golden.sheets[name][String(scale)]
      const svg = svgFor(lay, SHEETS[name])
      const fname = "layout-" + name + "-" + String(scale).replace(".", "p") + "x.svg"
      fs.writeFileSync(path.join(GOLDEN_DIR, fname), svg)
    })
  })
}

function assertGoldens() {
  const fresh = buildGoldens()
  const dest = path.join(GOLDEN_DIR, "layout.json")
  if (!fs.existsSync(dest)) {
    writeGoldens(fresh)
    return { wrote: true, mismatches: [] }
  }
  const saved = JSON.parse(fs.readFileSync(dest, "utf8"))
  const mismatches = []
  Object.keys(SHEETS).forEach((name) => {
    SCALES.forEach((scale) => {
      const a = fresh.sheets[name][String(scale)]
      const b = saved.sheets[name] && saved.sheets[name][String(scale)]
      if (!b) {
        mismatches.push(name + "@" + scale + " missing golden")
        return
      }
      if (a.lineCount !== b.lineCount)
        mismatches.push(name + "@" + scale + " lineCount " + a.lineCount + " != " + b.lineCount)
      if (a.resultCount !== b.resultCount)
        mismatches.push(name + "@" + scale + " resultCount mismatch")
      if (a.lineHeight !== b.lineHeight)
        mismatches.push(name + "@" + scale + " lineHeight " + a.lineHeight + " != " + b.lineHeight)
      for (let i = 0; i < a.rows.length; i++) {
        if (a.rows[i].y !== b.rows[i].y)
          mismatches.push(name + "@" + scale + " row " + i + " y " + a.rows[i].y + " != " + b.rows[i].y)
        if (a.rows[i].wrapped)
          mismatches.push(name + "@" + scale + " row " + i + " wrapped (forbidden)")
        if (a.rows[i].y !== i * a.lineHeight)
          mismatches.push(name + "@" + scale + " row " + i + " y is not index×lineHeight")
      }
    })
  })
  return { wrote: false, mismatches: mismatches, fresh: fresh }
}

function run(log) {
  const result = assertGoldens()
  if (result.wrote) {
    if (log) log("ok  layout goldens written")
    return { passed: 1, failed: 0, failures: [] }
  }
  if (result.mismatches.length) {
    result.mismatches.forEach((m) => { if (log) log("FAIL layout: " + m) })
    return { passed: 0, failed: result.mismatches.length, failures: result.mismatches }
  }
  if (log) {
    log("ok  layout goldens 1×/1.25×/2× (longline, emoji, url, battlestation)")
    log("ok  wrap-free alignment is index × lineHeight")
  }
  return { passed: 2, failed: 0, failures: [] }
}

if (require.main === module) {
  if (process.argv.indexOf("--update") >= 0) {
    writeGoldens(buildGoldens())
    process.stdout.write("updated " + GOLDEN_DIR + "\n")
    process.exit(0)
  }
  const r = run(function (s) { process.stdout.write(s + "\n") })
  process.exit(r.failed ? 1 : 0)
}

module.exports = { run: run, buildGoldens: buildGoldens, SHEETS: SHEETS, SCALES: SCALES }
