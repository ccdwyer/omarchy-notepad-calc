#!/usr/bin/env node
// Rebuild tests/fixtures/tz-table.json from the TZDB-backed js/tz.js.
// To regenerate transitions from IANA zoneinfo, run: python3 tools/tzgen.py

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
process.stdout.write("wrote " + dest + " (" + out.length + " zones, TZDB transitions)\n")
