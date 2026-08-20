#!/usr/bin/env node
"use strict"

const Engine = require("../js/engine.js")
const Units = require("../js/units.js")
const Tz = require("../js/tz.js")
const Format = require("../js/format.js")
const Rates = require("../js/rates.js")
const fs = require("fs")
const path = require("path")

const rates = Rates.parseRatesJson(
  fs.readFileSync(path.join(__dirname, "../data/rates.json"), "utf8")
)

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

function buildSheet(n) {
  const lines = []
  lines.push("soak sheet")
  lines.push("base = 1")
  for (let i = 0; i < n; i++) {
    if (i % 17 === 0) lines.push("")
    else if (i % 23 === 0) lines.push("note line " + i + " stays prose")
    else lines.push("base + " + i)
  }
  lines.push("sum")
  return lines
}

function run(log) {
  const lines = buildSheet(500)
  if (lines.length < 500) throw new Error("soak sheet too short: " + lines.length)
  const c = ctx()
  const heap0 = typeof process.memoryUsage === "function" ? process.memoryUsage().heapUsed : 0
  const t0 = Date.now()
  let last = null
  const rounds = 8
  for (let r = 0; r < rounds; r++) {
    last = Engine.evalSheet(lines, c)
    if (!last || last.length !== lines.length)
      throw new Error("soak round " + r + " length " + (last && last.length))
  }
  const dt = Date.now() - t0
  const heap1 = typeof process.memoryUsage === "function" ? process.memoryUsage().heapUsed : 0
  const growth = heap1 - heap0
  if (log) {
    log("ok  soak " + lines.length + " lines × " + rounds + " evals in " + dt + "ms")
    log("ok  soak heap delta " + Math.round(growth / 1024) + " KiB")
  }
  if (dt > 8000) throw new Error("soak too slow: " + dt + "ms")
  const results = last.filter((row) => row && row.kind === "result")
  if (results.length < 400) throw new Error("too few result rows: " + results.length)
  return { passed: 2, failed: 0, failures: [], dt: dt, lines: lines.length }
}

if (require.main === module) {
  try {
    run(function (s) { process.stdout.write(s + "\n") })
  } catch (e) {
    process.stderr.write(String(e && e.stack ? e.stack : e) + "\n")
    process.exit(1)
  }
}

module.exports = { run: run, buildSheet: buildSheet }
