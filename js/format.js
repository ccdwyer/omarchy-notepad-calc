// Hand-rolled display formatting. No Intl, no Qt.

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function pad2(n) {
    var s = String(Math.abs(n | 0))
    if (s.length < 2) s = "0" + s
    return s
}

function groupInt(n) {
    var sign = n < 0 ? "-" : ""
    var s = String(Math.abs(Math.floor(n)))
    var out = ""
    while (s.length > 3) {
        out = "," + s.slice(-3) + out
        s = s.slice(0, -3)
    }
    return sign + s + out
}

function fixedDec(n, d) {
    if (d <= 0) return String(Math.round(n))
    var m = Math.pow(10, d)
    var x = Math.round(n * m) / m
    var s = String(x)
    var i = s.indexOf(".")
    if (i < 0) {
        s += "."
        i = s.length - 1
    }
    while (s.length - i - 1 < d) s += "0"
    return s
}

function formatGroupedNumber(n, decimals) {
    var neg = n < 0
    var abs = Math.abs(n)
    var s = fixedDec(abs, decimals)
    var parts = s.split(".")
    var grouped = groupInt(Number(parts[0]))
    if (neg && grouped.charAt(0) !== "-") grouped = "-" + grouped
    if (decimals > 0) return grouped + "." + parts[1]
    return grouped
}

function formatMoney(amount, code, ratesMod) {
    var dec = 2
    if (ratesMod && typeof ratesMod.decimalsFor === "function")
        dec = ratesMod.decimalsFor(code)
    else if (code === "JPY" || code === "KRW" || code === "HUF" || code === "ISK" || code === "IDR")
        dec = 0
    var num = formatGroupedNumber(amount, dec)
    var sym = "$"
    if (ratesMod && typeof ratesMod.symbolFor === "function")
        sym = ratesMod.symbolFor(code)
    else {
        var map = { EUR: "€", USD: "$", GBP: "£", JPY: "¥", INR: "₹", KRW: "₩" }
        sym = map[code] || (code + " ")
    }
    if (sym.length > 2 && sym.charAt(sym.length - 1) !== " ")
        return num + " " + sym
    return sym + num
}

function formatDuration(seconds) {
    var sign = seconds < 0 ? "-" : ""
    var t = Math.abs(seconds)
    var round = Math.round(t)
    if (Math.abs(t - round) < 1e-9) t = round
    var days = Math.floor(t / 86400)
    t -= days * 86400
    var hours = Math.floor(t / 3600)
    t -= hours * 3600
    var mins = Math.floor(t / 60)
    t -= mins * 60
    var secs = t
    var parts = []
    if (days) parts.push(days + " d")
    if (hours) parts.push(hours + " h")
    if (mins) parts.push(mins + " min")
    if (secs !== 0 || parts.length === 0) {
        if (Math.abs(secs - Math.round(secs)) < 1e-9)
            parts.push(Math.round(secs) + " s")
        else
            parts.push(formatGroupedNumber(secs, 2) + " s")
    }
    return sign + parts.join(" ")
}

function ymd(y, m, d) {
    return { y: y, m: m, d: d }
}

function dateFromMs(ms) {
    var dt = new Date(ms)
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

function weekdayOf(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysBetween(a, b) {
    var am = Date.UTC(a.y, a.m - 1, a.d)
    var bm = Date.UTC(b.y, b.m - 1, b.d)
    return Math.round((bm - am) / 86400000)
}

function formatDate(date, nowDate) {
    if (!date) return ""
    var y = date.y
    var m = date.m
    var d = date.d
    if (nowDate) {
        var delta = daysBetween(nowDate, date)
        if (delta === 0) return "today"
        if (delta === 1) return "tomorrow"
        if (delta === -1) return "yesterday"
        if (delta > 1 && delta < 7)
            return WEEKDAYS[weekdayOf(y, m, d)]
    }
    return MONTHS[m - 1] + " " + d + ", " + y
}

function formatTimeOfDay(hh, mm) {
    var h = hh
    var ap = "AM"
    if (h >= 12) ap = "PM"
    if (h === 0) h = 12
    else if (h > 12) h = h - 12
    return h + ":" + pad2(mm) + " " + ap
}

function formatDateTime(local, nowDate) {
    var time = formatTimeOfDay(local.hh, local.mm)
    var dateBit = ""
    if (nowDate) {
        var delta = daysBetween(nowDate, ymd(local.y, local.m, local.d))
        if (delta === 1) dateBit = " tomorrow"
        else if (delta === -1) dateBit = " yesterday"
        else if (delta === 0) dateBit = ""
        else dateBit = ", " + MONTHS[local.m - 1] + " " + local.d
    } else {
        dateBit = ", " + MONTHS[local.m - 1] + " " + local.d
    }
    var abbr = local.abbr ? ", " + local.abbr : ""
    return time + dateBit + abbr
}

function formatPlain(n) {
    if (!isFinite(n)) return "—"
    var abs = Math.abs(n)
    if (abs !== 0 && (abs >= 1e7 || abs < 1e-6)) {
        var exp = n.toExponential(4)
        return exp
    }
    var dec = 0
    if (Math.abs(n - Math.round(n)) > 1e-9) {
        var s = String(Math.abs(n))
        var i = s.indexOf(".")
        dec = i < 0 ? 0 : Math.min(6, s.length - i - 1)
        if (dec < 2 && abs < 1) dec = 2
    }
    if (abs >= 1000) return formatGroupedNumber(n, Math.min(dec, 2))
    if (dec === 0) return String(Math.round(n))
    var out = String(Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec))
    return out
}

function formatQty(qty, ctx) {
    if (!qty) return ""
    if (qty.kind === "unresolved") {
        var n = qty.names && qty.names.length ? qty.names[0] : "name"
        return "?" + n
    }
    if (qty.kind === "blank" || qty.kind === "prose") return ""
    if (qty.kind !== "result" && qty.kind !== "qty") {
        if (qty.display) return qty.display
        return ""
    }
    ctx = ctx || {}
    var ratesMod = ctx.ratesMod
    var nowDate = ctx.nowDate
    if (qty.isDateTime && qty.local)
        return formatDateTime(qty.local, nowDate)
    if (qty.isDate && qty.date)
        return formatDate(qty.date, nowDate)
    if (qty.isPercent)
        return formatPlain(qty.percentValue !== undefined ? qty.percentValue : qty.value * 100) + "%"
    if (qty.currency) {
        var money = formatMoney(qty.value, qty.currency, ratesMod)
        if (qty.perUnit && qty.dim && (qty.dim.T || 0) === -1)
            return money + "/" + qty.perUnit.display
        return money
    }
    var units = ctx.units
    if (qty.unitHint && units && typeof units.lookup === "function") {
        var u = units.lookup(qty.unitHint) || (qty.unitObj || null)
        if (u && u.dim && ctx.units && ctx.units.dimIsDuration && ctx.units.dimIsDuration(u.dim) && !qty.asUnit) {
            // fall through to humanize when natural duration
        }
    }
    if (qty.asUnit && qty.unitObj) {
        var shown = qty.value / qty.unitObj.factor
        return formatPlain(shown) + " " + qty.unitObj.display
    }
    if (units && typeof units.dimIsDuration === "function" && units.dimIsDuration(qty.dim) && !qty.asUnit)
        return formatDuration(qty.value)
    if (qty.unitObj) {
        var v = qty.value / qty.unitObj.factor
        return formatPlain(v) + " " + qty.unitObj.display
    }
    if (qty.unitHint)
        return formatPlain(qty.value) + " " + qty.unitHint
    return formatPlain(qty.value)
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        pad2: pad2,
        groupInt: groupInt,
        formatGroupedNumber: formatGroupedNumber,
        formatMoney: formatMoney,
        formatDuration: formatDuration,
        formatDate: formatDate,
        formatTimeOfDay: formatTimeOfDay,
        formatDateTime: formatDateTime,
        formatPlain: formatPlain,
        formatQty: formatQty,
        daysBetween: daysBetween,
        MONTHS: MONTHS,
        WEEKDAYS: WEEKDAYS
    }
}
