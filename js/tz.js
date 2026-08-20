// Bundled IANA transition table for ~50 city zones, ±2 years around 2026.
// Generated from well-known DST rules (US, EU, AU-east, NZ, none).
// No Qt, no Intl, no OS zoneinfo at runtime.

function nthWeekdayUTC(year, month0, n, weekday) {
    var first = new Date(Date.UTC(year, month0, 1))
    var firstW = first.getUTCDay()
    var day = 1 + ((weekday - firstW + 7) % 7) + (n - 1) * 7
    return day
}

function lastWeekdayUTC(year, month0, weekday) {
    var last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
    var lastObj = new Date(Date.UTC(year, month0, last))
    var lastW = lastObj.getUTCDay()
    var delta = (lastW - weekday + 7) % 7
    return last - delta
}

function trans(at, offset, abbr) {
    return { at: at, offset: offset, abbr: abbr }
}

function localToAt(year, month0, day, hour, min, offsetSec) {
    return Date.UTC(year, month0, day, hour, min, 0) - offsetSec * 1000
}

function usTransitions(stdOff, dstOff, stdAbbr, dstAbbr, y0, y1) {
    var out = []
    for (var y = y0; y <= y1; y++) {
        var mar = nthWeekdayUTC(y, 2, 2, 0)
        var nov = nthWeekdayUTC(y, 10, 1, 0)
        out.push(trans(localToAt(y, 2, mar, 2, 0, stdOff), dstOff, dstAbbr))
        out.push(trans(localToAt(y, 10, nov, 2, 0, dstOff), stdOff, stdAbbr))
    }
    return out
}

function euTransitions(stdOff, dstOff, stdAbbr, dstAbbr, y0, y1) {
    var out = []
    for (var y = y0; y <= y1; y++) {
        var mar = lastWeekdayUTC(y, 2, 0)
        var oct = lastWeekdayUTC(y, 9, 0)
        out.push(trans(Date.UTC(y, 2, mar, 1, 0, 0), dstOff, dstAbbr))
        out.push(trans(Date.UTC(y, 9, oct, 1, 0, 0), stdOff, stdAbbr))
    }
    return out
}

function auEastTransitions(stdOff, dstOff, stdAbbr, dstAbbr, y0, y1) {
    var out = []
    for (var y = y0; y <= y1; y++) {
        var apr = nthWeekdayUTC(y, 3, 1, 0)
        var oct = nthWeekdayUTC(y, 9, 1, 0)
        out.push(trans(localToAt(y, 3, apr, 3, 0, dstOff), stdOff, stdAbbr))
        out.push(trans(localToAt(y, 9, oct, 2, 0, stdOff), dstOff, dstAbbr))
    }
    return out
}

function nzTransitions(stdOff, dstOff, stdAbbr, dstAbbr, y0, y1) {
    var out = []
    for (var y = y0; y <= y1; y++) {
        var apr = nthWeekdayUTC(y, 3, 1, 0)
        var sep = lastWeekdayUTC(y, 8, 0)
        out.push(trans(localToAt(y, 3, apr, 3, 0, dstOff), stdOff, stdAbbr))
        out.push(trans(localToAt(y, 8, sep, 2, 0, stdOff), dstOff, dstAbbr))
    }
    return out
}

var Y0 = 2024
var Y1 = 2028

function Z(id, cities, abbrs, stdOff, dstOff, stdAbbr, dstAbbr, rule) {
    var transitions = []
    if (rule === "us") transitions = usTransitions(stdOff, dstOff, stdAbbr, dstAbbr, Y0, Y1)
    else if (rule === "eu") transitions = euTransitions(stdOff, dstOff, stdAbbr, dstAbbr, Y0, Y1)
    else if (rule === "au-east") transitions = auEastTransitions(stdOff, dstOff, stdAbbr, dstAbbr, Y0, Y1)
    else if (rule === "nz") transitions = nzTransitions(stdOff, dstOff, stdAbbr, dstAbbr, Y0, Y1)
    transitions.sort(function (a, b) { return a.at - b.at })
    return {
        id: id,
        cities: cities,
        abbrs: abbrs,
        stdOffset: stdOff,
        dstOffset: dstOff,
        stdAbbr: stdAbbr,
        dstAbbr: dstAbbr,
        rule: rule,
        transitions: transitions
    }
}

var H = 3600

var ZONES = [
    Z("UTC", ["utc", "gmt"], { UTC: 0, GMT: 0 }, 0, 0, "UTC", "UTC", "none"),
    Z("America/New_York", ["new york", "nyc", "boston", "miami", "atlanta", "detroit", "washington"], { EST: -5 * H, EDT: -4 * H }, -5 * H, -4 * H, "EST", "EDT", "us"),
    Z("America/Chicago", ["chicago", "dallas", "houston", "minneapolis"], { CST: -6 * H, CDT: -5 * H }, -6 * H, -5 * H, "CST", "CDT", "us"),
    Z("America/Denver", ["denver", "salt lake city", "salt lake"], { MST: -7 * H, MDT: -6 * H }, -7 * H, -6 * H, "MST", "MDT", "us"),
    Z("America/Los_Angeles", ["los angeles", "la", "seattle", "san francisco", "portland"], { PST: -8 * H, PDT: -7 * H }, -8 * H, -7 * H, "PST", "PDT", "us"),
    Z("America/Phoenix", ["phoenix"], {}, -7 * H, -7 * H, "MST", "MST", "none"),
    Z("America/Anchorage", ["anchorage"], { AKST: -9 * H, AKDT: -8 * H }, -9 * H, -8 * H, "AKST", "AKDT", "us"),
    Z("Pacific/Honolulu", ["honolulu", "hawaii"], { HST: -10 * H }, -10 * H, -10 * H, "HST", "HST", "none"),
    Z("America/Toronto", ["toronto"], {}, -5 * H, -4 * H, "EST", "EDT", "us"),
    Z("America/Vancouver", ["vancouver"], {}, -8 * H, -7 * H, "PST", "PDT", "us"),
    Z("America/Montreal", ["montreal"], {}, -5 * H, -4 * H, "EST", "EDT", "us"),
    Z("America/Mexico_City", ["mexico city"], {}, -6 * H, -6 * H, "CST", "CST", "none"),
    Z("America/Sao_Paulo", ["sao paulo", "são paulo"], {}, -3 * H, -3 * H, "BRT", "BRT", "none"),
    Z("America/Buenos_Aires", ["buenos aires"], {}, -3 * H, -3 * H, "ART", "ART", "none"),
    Z("Europe/London", ["london"], { BST: 1 * H }, 0, 1 * H, "GMT", "BST", "eu"),
    Z("Europe/Dublin", ["dublin"], {}, 0, 1 * H, "GMT", "IST", "eu"),
    Z("Europe/Paris", ["paris", "brussels", "amsterdam", "madrid", "rome", "berlin", "zurich", "vienna", "prague", "stockholm", "oslo", "copenhagen", "warsaw"], { CET: 1 * H, CEST: 2 * H }, 1 * H, 2 * H, "CET", "CEST", "eu"),
    Z("Europe/Lisbon", ["lisbon"], { WET: 0, WEST: 1 * H }, 0, 1 * H, "WET", "WEST", "eu"),
    Z("Europe/Helsinki", ["helsinki", "athens"], { EET: 2 * H, EEST: 3 * H }, 2 * H, 3 * H, "EET", "EEST", "eu"),
    Z("Europe/Moscow", ["moscow"], { MSK: 3 * H }, 3 * H, 3 * H, "MSK", "MSK", "none"),
    Z("Europe/Istanbul", ["istanbul"], { TRT: 3 * H }, 3 * H, 3 * H, "TRT", "TRT", "none"),
    Z("Africa/Cairo", ["cairo"], {}, 2 * H, 2 * H, "EET", "EET", "none"),
    Z("Africa/Johannesburg", ["johannesburg", "cape town"], { SAST: 2 * H }, 2 * H, 2 * H, "SAST", "SAST", "none"),
    Z("Africa/Nairobi", ["nairobi"], { EAT: 3 * H }, 3 * H, 3 * H, "EAT", "EAT", "none"),
    Z("Asia/Dubai", ["dubai"], { GST: 4 * H }, 4 * H, 4 * H, "GST", "GST", "none"),
    Z("Asia/Jerusalem", ["tel aviv", "jerusalem"], {}, 2 * H, 3 * H, "IST", "IDT", "eu"),
    Z("Asia/Kolkata", ["mumbai", "delhi", "kolkata", "bangalore", "india"], {}, 5.5 * H, 5.5 * H, "IST", "IST", "none"),
    Z("Asia/Bangkok", ["bangkok", "jakarta"], { ICT: 7 * H }, 7 * H, 7 * H, "ICT", "ICT", "none"),
    Z("Asia/Singapore", ["singapore"], { SGT: 8 * H }, 8 * H, 8 * H, "SGT", "SGT", "none"),
    Z("Asia/Hong_Kong", ["hong kong"], { HKT: 8 * H }, 8 * H, 8 * H, "HKT", "HKT", "none"),
    Z("Asia/Shanghai", ["shanghai", "beijing", "china"], { CST: 8 * H }, 8 * H, 8 * H, "CST", "CST", "none"),
    Z("Asia/Taipei", ["taipei"], { CST: 8 * H }, 8 * H, 8 * H, "CST", "CST", "none"),
    Z("Asia/Manila", ["manila"], { PHT: 8 * H }, 8 * H, 8 * H, "PHT", "PHT", "none"),
    Z("Asia/Seoul", ["seoul"], { KST: 9 * H }, 9 * H, 9 * H, "KST", "KST", "none"),
    Z("Asia/Tokyo", ["tokyo"], { JST: 9 * H }, 9 * H, 9 * H, "JST", "JST", "none"),
    Z("Australia/Sydney", ["sydney", "melbourne"], { AEST: 10 * H, AEDT: 11 * H }, 10 * H, 11 * H, "AEST", "AEDT", "au-east"),
    Z("Australia/Perth", ["perth"], { AWST: 8 * H }, 8 * H, 8 * H, "AWST", "AWST", "none"),
    Z("Pacific/Auckland", ["auckland"], { NZST: 12 * H, NZDT: 13 * H }, 12 * H, 13 * H, "NZST", "NZDT", "nz"),
    Z("America/Bogota", ["bogota"], { COT: -5 * H }, -5 * H, -5 * H, "COT", "COT", "none"),
    Z("America/Lima", ["lima"], { PET: -5 * H }, -5 * H, -5 * H, "PET", "PET", "none"),
    Z("America/Santiago", ["santiago"], {}, -4 * H, -3 * H, "CLT", "CLST", "none"),
    Z("America/Halifax", ["halifax"], { AST: -4 * H, ADT: -3 * H }, -4 * H, -3 * H, "AST", "ADT", "us"),
    Z("Atlantic/Reykjavik", ["reykjavik", "iceland"], {}, 0, 0, "GMT", "GMT", "none"),
    Z("Africa/Lagos", ["lagos"], { WAT: 1 * H }, 1 * H, 1 * H, "WAT", "WAT", "none"),
    Z("Africa/Casablanca", ["casablanca"], {}, 1 * H, 1 * H, "WET", "WET", "none"),
    Z("Asia/Riyadh", ["riyadh"], {}, 3 * H, 3 * H, "AST", "AST", "none"),
    Z("Asia/Karachi", ["karachi"], { PKT: 5 * H }, 5 * H, 5 * H, "PKT", "PKT", "none"),
    Z("Asia/Dhaka", ["dhaka"], {}, 6 * H, 6 * H, "BST", "BST", "none"),
    Z("Asia/Yangon", ["yangon", "rangoon"], {}, 6.5 * H, 6.5 * H, "MMT", "MMT", "none"),
    Z("Asia/Ho_Chi_Minh", ["ho chi minh", "saigon", "hanoi"], { ICT: 7 * H }, 7 * H, 7 * H, "ICT", "ICT", "none"),
    Z("Pacific/Guam", ["guam"], { ChST: 10 * H }, 10 * H, 10 * H, "ChST", "ChST", "none"),
    Z("Pacific/Fiji", ["fiji", "suva"], {}, 12 * H, 12 * H, "FJT", "FJT", "none"),
    Z("Pacific/Port_Moresby", ["port moresby"], { PGT: 10 * H }, 10 * H, 10 * H, "PGT", "PGT", "none")
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
    // City names and IANA ids remain the documented form.
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
    var off = zone.stdOffset
    // Before first transition: winter of Y0. US/EU: January is standard.
    if (zone.rule === "au-east" || zone.rule === "nz") off = zone.dstOffset
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
    var abbr = zone.stdAbbr
    if (zone.rule === "au-east" || zone.rule === "nz") abbr = zone.dstAbbr
    for (var i = 0; i < list.length; i++) {
        if (list[i].at <= utcMs) abbr = list[i].abbr
        else break
    }
    return abbr
}

function localToUtc(y, m, d, hh, mm, zone) {
    var asIfUtc = Date.UTC(y, m - 1, d, hh, mm, 0)
    var guess = asIfUtc - zone.stdOffset * 1000
    var off1 = offsetAt(zone, guess)
    var utc = asIfUtc - off1 * 1000
    var off2 = offsetAt(zone, utc)
    if (off2 !== off1) utc = asIfUtc - off2 * 1000
    return utc
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
        convertWall: convertWall,
        nthWeekdayUTC: nthWeekdayUTC,
        lastWeekdayUTC: lastWeekdayUTC
    }
}
