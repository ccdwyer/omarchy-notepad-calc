#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")
const Engine = require("../js/engine.js")
const Units = require("../js/units.js")
const Tz = require("../js/tz.js")
const Format = require("../js/format.js")
const Rates = require("../js/rates.js")

const ROOT = path.resolve(__dirname, "..")
const OUT_DIR = path.join(ROOT, "docs")
const rates = Rates.parseRatesJson(fs.readFileSync(path.join(ROOT, "data/rates.json"), "utf8"))

function ctx() {
  return {
    units: Units,
    tz: Tz,
    rates: rates,
    ratesMod: Rates,
    now: new Date(Date.UTC(2026, 7, 19, 12, 0, 0)),
    nowDate: { y: 2026, m: 8, d: 19 },
    format: Format.formatQty
  }
}

const before = fs.readFileSync(path.join(ROOT, "data/first-run.calc"), "utf8")
const after = before.replace("monitors = 2 × $429", "monitors = 3 × $429")

function rowsOf(text) {
  const lines = text.replace(/\n$/, "").split("\n")
  const results = Engine.evalSheet(lines, ctx())
  return lines.map((line, i) => ({
    line: line,
    display: (results[i] && results[i].display) || "",
    kind: results[i] && results[i].kind
  }))
}

const a = rowsOf(before)
const b = rowsOf(after)
const changed = []
for (let i = 0; i < b.length; i++) {
  if ((a[i] && a[i].display) !== b[i].display && b[i].display) changed.push(i)
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function frameSvg(rows, pulseRows, pulseAlpha, caption) {
  const W = 1100
  const H = 640
  const lh = 26
  const left = 36
  const top = 88
  const resultsX = 860
  let body = ""
  rows.forEach((row, i) => {
    const y = top + i * lh
    const pulsing = pulseRows.indexOf(i) >= 0 && pulseAlpha > 0
    if (pulsing) {
      body += '<rect x="' + (resultsX - 8) + '" y="' + (y - 18) + '" width="220" height="' + lh +
        '" rx="4" fill="#7aa2f7" fill-opacity="' + pulseAlpha + '"/>\n'
    }
    const textFill = row.line.indexOf("monitors =") === 0 ? "#c0caf5" : "#a9b1d6"
    body += '<text x="' + left + '" y="' + y + '" font-family="JetBrains Mono, Menlo, monospace" font-size="15" fill="' +
      textFill + '">' + escapeXml(row.line) + "</text>\n"
    if (row.display) {
      body += '<text x="' + (W - 36) + '" y="' + y + '" text-anchor="end" font-family="JetBrains Mono, Menlo, monospace" font-size="15" fill="#7aa2f7">' +
        escapeXml(row.display) + "</text>\n"
    }
  })
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">\n' +
    '<rect width="100%" height="100%" fill="#1a1b26"/>\n' +
    '<text x="36" y="38" font-family="JetBrains Mono, Menlo, sans-serif" font-size="22" font-weight="700" fill="#c0caf5">Σ  Omarchy battlestation</text>\n' +
    '<text x="420" y="38" font-family="JetBrains Mono, Menlo, sans-serif" font-size="14" fill="#565f89">rates: 2026-08-18</text>\n' +
    '<text x="720" y="38" font-family="JetBrains Mono, Menlo, sans-serif" font-size="14" fill="#7aa2f7">' +
    escapeXml(caption) + "</text>\n" +
    '<line x1="36" y1="54" x2="1064" y2="54" stroke="#3b3f51" stroke-width="1"/>\n' +
    '<rect x="848" y="60" width="228" height="552" fill="#16161e"/>\n' +
    body + "</svg>\n"
}

const frames = [
  { rows: a, pulse: [], alpha: 0, caption: "every line is plain text", hold: 8 },
  { rows: a, pulse: [], alpha: 0, caption: "change 2 × $429 → 3 ×", hold: 5 },
  { rows: b, pulse: changed, alpha: 0.40, caption: "ripple", hold: 4 },
  { rows: b, pulse: changed, alpha: 0.18, caption: "ripple", hold: 3 },
  { rows: b, pulse: [], alpha: 0, caption: "downstream lines updated", hold: 8 }
]

const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "notepad-calc-hero-"))
fs.mkdirSync(OUT_DIR, { recursive: true })

let n = 0
frames.forEach((f) => {
  const svg = frameSvg(f.rows, f.pulse, f.alpha, f.caption)
  const svgPath = path.join(tmp, "f" + String(n).padStart(3, "0") + ".svg")
  fs.writeFileSync(svgPath, svg)
  for (let h = 0; h < f.hold; h++) {
    const png = path.join(tmp, "p" + String(n).padStart(4, "0") + ".png")
    const rsvg = spawnSync("rsvg-convert", ["-w", "1100", "-o", png, svgPath], { encoding: "utf8" })
    if (rsvg.status !== 0) {
      const r = spawnSync("magick", ["-background", "#1a1b26", svgPath, png], { encoding: "utf8" })
      if (r.status !== 0) {
        process.stderr.write((rsvg.stderr || "") + (r.stderr || "rasterize failed\n"))
        process.exit(1)
      }
    }
    n += 1
  }
})

const gif = path.join(OUT_DIR, "ripple.gif")
const ff = spawnSync("ffmpeg", [
  "-y", "-framerate", "10", "-i", path.join(tmp, "p%04d.png"),
  "-filter_complex",
  "scale=880:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
  "-loop", "0",
  gif
], { encoding: "utf8" })
if (ff.status !== 0) {
  process.stderr.write(ff.stderr || "ffmpeg failed\n")
  process.exit(1)
}
process.stdout.write("wrote " + gif + " (" + n + " frames, pulse rows " + changed.join(",") + ")\n")
