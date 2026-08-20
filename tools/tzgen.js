#!/usr/bin/env node
// Rebuild tests/fixtures/tz-table.json from js/tz.js so the transition
// table is inspectable. Runtime still uses js/tz.js directly (no Qt/OS tz).

"use strict"

const fs = require("fs")
const path = require("path")
const Tz = require(path.join(__dirname, "../js/tz.js"))

const out = Tz.ZONES.map((z) => ({
  id: z.id,
  cities: z.cities,
  stdOffset: z.stdOffset,
  dstOffset: z.dstOffset,
  stdAbbr: z.stdAbbr,
  dstAbbr: z.dstAbbr,
  rule: z.rule,
  transitions: z.transitions.map((t) => ({
    at: t.at,
    iso: new Date(t.at).toISOString(),
    offset: t.offset,
    abbr: t.abbr
  }))
}))

const dest = path.join(__dirname, "../tests/fixtures/tz-table.json")
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n")
process.stdout.write("wrote " + dest + " (" + out.length + " zones)\n")
