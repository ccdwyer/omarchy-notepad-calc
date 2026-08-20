#!/usr/bin/env python3
"""Generate js/tz.js + tests/fixtures/tz-edges.json from the host IANA TZDB.

Transitions are actual TZDB timestamps for 2024-01-01 .. 2029-01-01 UTC.
Do not invent DST rules — sample zoneinfo.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
Y0 = 2024
Y1 = 2028

# id, cities, abbrs (advertised aliases). Offsets/abbreviations at runtime
# come from TZDB transitions, not these aliases.
ZONES = [
    ("UTC", ["utc", "gmt"], {"UTC": 0, "GMT": 0}),
    ("America/New_York", ["new york", "nyc", "boston", "miami", "atlanta", "detroit", "washington"], {"EST": -5 * 3600, "EDT": -4 * 3600}),
    ("America/Chicago", ["chicago", "dallas", "houston", "minneapolis"], {"CST": -6 * 3600, "CDT": -5 * 3600}),
    ("America/Denver", ["denver", "salt lake city", "salt lake"], {"MST": -7 * 3600, "MDT": -6 * 3600}),
    ("America/Los_Angeles", ["los angeles", "la", "seattle", "san francisco", "portland"], {"PST": -8 * 3600, "PDT": -7 * 3600}),
    ("America/Phoenix", ["phoenix"], {}),
    ("America/Anchorage", ["anchorage"], {"AKST": -9 * 3600, "AKDT": -8 * 3600}),
    ("Pacific/Honolulu", ["honolulu", "hawaii"], {"HST": -10 * 3600}),
    ("America/Toronto", ["toronto"], {}),
    ("America/Vancouver", ["vancouver"], {}),
    ("America/Montreal", ["montreal"], {}),
    ("America/Mexico_City", ["mexico city"], {}),
    ("America/Sao_Paulo", ["sao paulo", "são paulo"], {}),
    ("America/Buenos_Aires", ["buenos aires"], {}),
    ("Europe/London", ["london"], {"BST": 3600}),
    ("Europe/Dublin", ["dublin"], {}),
    ("Europe/Paris", ["paris", "brussels", "amsterdam", "madrid", "rome", "berlin", "zurich", "vienna", "prague", "stockholm", "oslo", "copenhagen", "warsaw"], {"CET": 3600, "CEST": 2 * 3600}),
    ("Europe/Lisbon", ["lisbon"], {"WET": 0, "WEST": 3600}),
    ("Europe/Helsinki", ["helsinki", "athens"], {"EET": 2 * 3600, "EEST": 3 * 3600}),
    ("Europe/Moscow", ["moscow"], {"MSK": 3 * 3600}),
    ("Europe/Istanbul", ["istanbul"], {"TRT": 3 * 3600}),
    ("Africa/Cairo", ["cairo"], {}),
    ("Africa/Johannesburg", ["johannesburg", "cape town"], {"SAST": 2 * 3600}),
    ("Africa/Nairobi", ["nairobi"], {"EAT": 3 * 3600}),
    ("Asia/Dubai", ["dubai"], {"GST": 4 * 3600}),
    ("Asia/Jerusalem", ["tel aviv", "jerusalem"], {}),
    ("Asia/Kolkata", ["mumbai", "delhi", "kolkata", "bangalore", "india"], {}),
    ("Asia/Bangkok", ["bangkok", "jakarta"], {"ICT": 7 * 3600}),
    ("Asia/Singapore", ["singapore"], {"SGT": 8 * 3600}),
    ("Asia/Hong_Kong", ["hong kong"], {"HKT": 8 * 3600}),
    ("Asia/Shanghai", ["shanghai", "beijing", "china"], {"CST": 8 * 3600}),
    ("Asia/Taipei", ["taipei"], {"CST": 8 * 3600}),
    ("Asia/Manila", ["manila"], {"PHT": 8 * 3600}),
    ("Asia/Seoul", ["seoul"], {"KST": 9 * 3600}),
    ("Asia/Tokyo", ["tokyo"], {"JST": 9 * 3600}),
    ("Australia/Sydney", ["sydney", "melbourne"], {"AEST": 10 * 3600, "AEDT": 11 * 3600}),
    ("Australia/Perth", ["perth"], {"AWST": 8 * 3600}),
    ("Pacific/Auckland", ["auckland"], {"NZST": 12 * 3600, "NZDT": 13 * 3600}),
    ("America/Bogota", ["bogota"], {"COT": -5 * 3600}),
    ("America/Lima", ["lima"], {"PET": -5 * 3600}),
    ("America/Santiago", ["santiago"], {}),
    ("America/Halifax", ["halifax"], {"AST": -4 * 3600, "ADT": -3 * 3600}),
    ("Atlantic/Reykjavik", ["reykjavik", "iceland"], {}),
    ("Africa/Lagos", ["lagos"], {"WAT": 3600}),
    ("Africa/Casablanca", ["casablanca"], {}),
    ("Asia/Riyadh", ["riyadh"], {}),
    ("Asia/Karachi", ["karachi"], {"PKT": 5 * 3600}),
    ("Asia/Dhaka", ["dhaka"], {}),
    ("Asia/Yangon", ["yangon", "rangoon"], {}),
    ("Asia/Ho_Chi_Minh", ["ho chi minh", "saigon", "hanoi"], {"ICT": 7 * 3600}),
    ("Pacific/Guam", ["guam"], {"ChST": 10 * 3600}),
    ("Pacific/Fiji", ["fiji", "suva"], {}),
    ("Pacific/Port_Moresby", ["port moresby"], {"PGT": 10 * 3600}),
]


def sample(tz: ZoneInfo, dt: datetime) -> tuple[int, str]:
    loc = dt.astimezone(tz)
    off = loc.utcoffset()
    if off is None:
        raise RuntimeError("no offset for %s at %s" % (tz, dt))
    return int(off.total_seconds()), (loc.tzname() or "")


def find_change(tz: ZoneInfo, lo: datetime, hi: datetime) -> datetime:
    """First instant in (lo, hi] where offset or abbr differs from lo."""
    base_off, base_abbr = sample(tz, lo)
    for _ in range(40):
        if (hi - lo).total_seconds() <= 1:
            return hi
        mid = lo + (hi - lo) / 2
        # datetime division may be float; normalize
        mid = lo + timedelta(seconds=(hi - lo).total_seconds() / 2)
        moff, mabbr = sample(tz, mid)
        if moff != base_off or mabbr != base_abbr:
            hi = mid
        else:
            lo = mid
    return hi


def transitions(zid: str) -> list[tuple[int, int, str]]:
    tz = ZoneInfo(zid)
    start = datetime(Y0, 1, 1, tzinfo=timezone.utc)
    end = datetime(Y1 + 1, 1, 1, tzinfo=timezone.utc)
    t = start
    off, abbr = sample(tz, t)
    out = [(int(t.timestamp() * 1000), off, abbr)]
    step = timedelta(hours=1)
    while t < end:
        nxt = t + step
        if nxt > end:
            nxt = end
        noff, nabbr = sample(tz, nxt)
        if noff != off or nabbr != abbr:
            at = find_change(tz, t, nxt)
            off, abbr = sample(tz, at)
            out.append((int(at.timestamp() * 1000), off, abbr))
        t = nxt
        if t >= end:
            break
    # Dedup identical consecutive
    dedup = []
    for row in out:
        if not dedup or dedup[-1][1:] != row[1:]:
            dedup.append(row)
        else:
            pass
    return dedup


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def js_cities(cities: list[str]) -> str:
    return "[" + ", ".join(js_str(c) for c in cities) + "]"


def js_abbrs(abbrs: dict) -> str:
    if not abbrs:
        return "{}"
    parts = []
    for k, v in abbrs.items():
        parts.append("%s: %s" % (k, v))
    return "{ " + ", ".join(parts) + " }"


def main() -> None:
    edges = []
    zone_blobs = []
    table = []
    for zid, cities, abbrs in ZONES:
        trans = transitions(zid)
        offs = [t[1] for t in trans]
        std_off = min(offs)
        dst_off = max(offs)
        std_abbr = trans[0][2]
        dst_abbr = trans[0][2]
        for _at, off, ab in trans:
            if off == dst_off:
                dst_abbr = ab
            if off == std_off:
                std_abbr = ab
        rows = []
        for at, off, ab in trans:
            rows.append("            trans(%d, %d, %s)" % (at, off, js_str(ab)))
        blob = (
            '    Z(%s, %s, %s, %d, %d, %s, %s, [\n' % (
                js_str(zid), js_cities(cities), js_abbrs(abbrs),
                std_off, dst_off, js_str(std_abbr), js_str(dst_abbr),
            )
            + ",\n".join(rows)
            + "\n    ])"
        )
        zone_blobs.append(blob)
        table.append({
            "id": zid,
            "cities": cities,
            "stdOffset": std_off,
            "dstOffset": dst_off,
            "stdAbbr": std_abbr,
            "dstAbbr": dst_abbr,
            "transitions": [
                {"at": at, "iso": datetime.fromtimestamp(at / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z"), "offset": off, "abbr": ab}
                for at, off, ab in trans
            ],
        })
        # January / July 2026 always.
        for label, dt in (
            ("2026-01-15 noon UTC", datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)),
            ("2026-07-15 noon UTC", datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)),
        ):
            off, ab = sample(ZoneInfo(zid), dt)
            edges.append({
                "id": zid,
                "ms": int(dt.timestamp() * 1000),
                "offset": off,
                "abbr": ab,
                "label": label,
            })
        # One hour each side of every real transition after the 2024-01-01 seed.
        for at, off, ab in trans[1:]:
            before = at - 3600 * 1000
            after = at + 3600 * 1000
            bdt = datetime.fromtimestamp(before / 1000, tz=timezone.utc)
            adt = datetime.fromtimestamp(after / 1000, tz=timezone.utc)
            boff, bab = sample(ZoneInfo(zid), bdt)
            aoff, aab = sample(ZoneInfo(zid), adt)
            edges.append({
                "id": zid,
                "ms": before,
                "offset": boff,
                "abbr": bab,
                "label": "1h before %s" % datetime.fromtimestamp(at / 1000, tz=timezone.utc).isoformat(),
            })
            edges.append({
                "id": zid,
                "ms": after,
                "offset": aoff,
                "abbr": aab,
                "label": "1h after %s" % datetime.fromtimestamp(at / 1000, tz=timezone.utc).isoformat(),
            })
        print("%s  %d transitions  std=%s/%d  dst=%s/%d" % (
            zid, len(trans), std_abbr, std_off, dst_abbr, dst_off))

    runtime = r'''// Generated by tools/tzgen.py from IANA TZDB. Do not edit by hand.
// Actual transition timestamps 2024-01-01 through 2029-01-01 UTC.
// No Qt, no Intl, no OS zoneinfo at runtime.

function trans(at, offset, abbr) {
    return { at: at, offset: offset, abbr: abbr }
}

function Z(id, cities, abbrs, stdOff, dstOff, stdAbbr, dstAbbr, transitions) {
    return {
        id: id,
        cities: cities,
        abbrs: abbrs,
        stdOffset: stdOff,
        dstOffset: dstOff,
        stdAbbr: stdAbbr,
        dstAbbr: dstAbbr,
        rule: "tzdb",
        transitions: transitions
    }
}

var ZONES = [
''' + ",\n".join(zone_blobs) + r'''
]

var CITY_INDEX = null
var ABBR_INDEX = null
var ID_INDEX = null
var CITY_PHRASES = null

function buildIndex() {
    CITY_INDEX = {}
    ABBR_INDEX = {}
    ID_INDEX = {}
    CITY_PHRASES = []
    for (var i = 0; i < ZONES.length; i++) {
        var z = ZONES[i]
        ID_INDEX[z.id.toLowerCase()] = z
        for (var c = 0; c < z.cities.length; c++) {
            var city = z.cities[c].toLowerCase()
            CITY_INDEX[city] = z
            CITY_PHRASES.push(city)
        }
        for (var a in z.abbrs) {
            if (!z.abbrs.hasOwnProperty(a)) continue
            var key = a.toUpperCase()
            if (ABBR_INDEX[key]) {
                ABBR_INDEX[key] = "ambiguous"
            } else {
                ABBR_INDEX[key] = z
            }
        }
    }
    // Ambiguous on purpose: IST (India vs Ireland), CST (US Central vs China).
    ABBR_INDEX.IST = "ambiguous"
    ABBR_INDEX.CST = "ambiguous"
    CITY_PHRASES.sort(function (a, b) { return b.length - a.length })
}

function zoneById(id) {
    if (!ID_INDEX) buildIndex()
    if (!id) return null
    return ID_INDEX[String(id).toLowerCase()] || null
}

function lookupZone(name) {
    if (!CITY_INDEX) buildIndex()
    if (!name) return null
    var raw = String(name).replace(/^\s+|\s+$/g, "")
    var lower = raw.toLowerCase()
    if (ID_INDEX[lower]) return ID_INDEX[lower]
    if (CITY_INDEX[lower]) return CITY_INDEX[lower]
    var up = raw.toUpperCase()
    var abbr = ABBR_INDEX[up]
    if (abbr === "ambiguous") return null
    if (abbr) return abbr
    return null
}

function cityPhrases() {
    if (!CITY_PHRASES) buildIndex()
    return CITY_PHRASES
}

function offsetAt(zone, utcMs) {
    if (!zone) return 0
    if (!zone.transitions || zone.transitions.length === 0) return zone.stdOffset
    var list = zone.transitions
    var off = list[0].offset
    for (var i = 0; i < list.length; i++) {
        if (list[i].at <= utcMs) off = list[i].offset
        else break
    }
    return off
}

function abbrAt(zone, utcMs) {
    if (!zone) return ""
    if (!zone.transitions || zone.transitions.length === 0) return zone.stdAbbr
    var list = zone.transitions
    var abbr = list[0].abbr
    for (var i = 0; i < list.length; i++) {
        if (list[i].at <= utcMs) abbr = list[i].abbr
        else break
    }
    return abbr
}

function localToUtc(y, m, d, hh, mm, zone) {
    var asIfUtc = Date.UTC(y, m - 1, d, hh, mm, 0)
    var offsets = [zone.stdOffset, zone.dstOffset]
    if (zone.transitions) {
        for (var i = 0; i < zone.transitions.length; i++)
            offsets.push(zone.transitions[i].offset)
    }
    var candidates = []
    var seen = {}
    for (var j = 0; j < offsets.length; j++) {
        var off = offsets[j]
        var utc = asIfUtc - off * 1000
        if (seen[String(utc)]) continue
        seen[String(utc)] = 1
        if (offsetAt(zone, utc) !== off) continue
        var loc = utcToLocal(utc, zone)
        if (loc.y === y && loc.m === m && loc.d === d && loc.hh === hh && loc.mm === mm)
            candidates.push(utc)
    }
    if (candidates.length === 1) return candidates[0]
    return null
}

function utcToLocal(utcMs, zone) {
    var off = offsetAt(zone, utcMs)
    var local = utcMs + off * 1000
    var dt = new Date(local)
    return {
        y: dt.getUTCFullYear(),
        m: dt.getUTCMonth() + 1,
        d: dt.getUTCDate(),
        hh: dt.getUTCHours(),
        mm: dt.getUTCMinutes(),
        ss: dt.getUTCSeconds(),
        offset: off,
        abbr: abbrAt(zone, utcMs),
        zoneId: zone.id
    }
}

function convertWall(y, m, d, hh, mm, fromZone, toZone) {
    var utc = localToUtc(y, m, d, hh, mm, fromZone)
    if (utc == null) return null
    return utcToLocal(utc, toZone)
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        ZONES: ZONES,
        zoneById: zoneById,
        lookupZone: lookupZone,
        cityPhrases: cityPhrases,
        offsetAt: offsetAt,
        abbrAt: abbrAt,
        localToUtc: localToUtc,
        utcToLocal: utcToLocal,
        convertWall: convertWall
    }
}
'''
    (ROOT / "js" / "tz.js").write_text(runtime, encoding="utf-8")
    (ROOT / "tests" / "fixtures" / "tz-table.json").write_text(
        json.dumps(table, indent=2) + "\n", encoding="utf-8"
    )
    (ROOT / "tests" / "fixtures" / "tz-edges.json").write_text(
        json.dumps(edges, indent=2) + "\n", encoding="utf-8"
    )
    print("wrote js/tz.js, tests/fixtures/tz-table.json, tests/fixtures/tz-edges.json")
    print("zones", len(ZONES), "edge samples", len(edges))


if __name__ == "__main__":
    main()
