// Notepad Calc engine: prose-tolerant Pratt parser over a living sheet.
// Pure JS. No Qt, no Intl, no engine-divergent regex. Rates/tz/units/now via ctx.

var RESERVED = {
    in: 1, of: 1, per: 1, as: 1, from: 1, to: 1, ago: 1,
    sum: 1, total: 1, prev: 1, avg: 1, average: 1, time: 1
}

var DATEWORDS = {
    today: 1, tomorrow: 1, yesterday: 1,
    sunday: 1, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1,
    sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1,
    january: 1, february: 1, march: 1, april: 1, may: 1, june: 1,
    july: 1, august: 1, september: 1, october: 1, november: 1, december: 1,
    jan: 1, feb: 1, mar: 1, apr: 1, jun: 1, jul: 1, aug: 1, sep: 1, oct: 1, nov: 1, dec: 1
}

var MONTH_NUM = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

var WEEKDAY_NUM = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
}

var CURRENCY_CHARS = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "₩": "KRW"
}

function isDigit(ch) {
    return ch >= "0" && ch <= "9"
}

function isLetter(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")
}

function isIdentChar(ch) {
    return isLetter(ch) || ch === "'" || ch === "_"
}

function lower(s) {
    return String(s).toLowerCase()
}

function nowParts(ctx) {
    var d = ctx && ctx.now ? ctx.now : new Date()
    if (ctx && ctx.nowDate) return { y: ctx.nowDate.y, m: ctx.nowDate.m, d: ctx.nowDate.d }
    if (typeof d === "string") d = new Date(d)
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

function qtyNumber(n) {
    return {
        kind: "result",
        value: n,
        dim: { L: 0, M: 0, T: 0, data: 0, money: 0, temp: 0, A: 0 },
        currency: null,
        unitHint: null,
        unitObj: null,
        isPercent: false,
        isDate: false,
        isDateTime: false
    }
}

function cloneQty(q) {
    if (!q) return null
    var o = {}
    for (var k in q) {
        if (q.hasOwnProperty(k)) o[k] = q[k]
    }
    if (q.dim) {
        o.dim = {
            L: q.dim.L || 0, M: q.dim.M || 0, T: q.dim.T || 0,
            data: q.dim.data || 0, money: q.dim.money || 0,
            temp: q.dim.temp || 0, A: q.dim.A || 0
        }
    }
    if (q.date) o.date = { y: q.date.y, m: q.date.m, d: q.date.d }
    if (q.local) {
        o.local = {}
        for (var lk in q.local) {
            if (q.local.hasOwnProperty(lk)) o.local[lk] = q.local[lk]
        }
    }
    if (q.names) o.names = q.names.slice()
    return o
}

function unresolvedResult(names) {
    var list = []
    if (typeof names === "string") list = [names]
    else if (names && names.length) list = names.slice()
    else list = ["name"]
    return { kind: "unresolved", names: list, display: "?" + list[0] }
}

function blankResult() {
    return { kind: "blank" }
}

function proseResult() {
    return { kind: "prose" }
}

function unitsOf(ctx) { return ctx && ctx.units ? ctx.units : null }
function tzOf(ctx) { return ctx && ctx.tz ? ctx.tz : null }
function ratesOf(ctx) { return ctx && ctx.rates ? ctx.rates : null }
function ratesModOf(ctx) { return ctx && ctx.ratesMod ? ctx.ratesMod : null }

function lookupUnit(name, ctx) {
    var u = unitsOf(ctx)
    if (!u || typeof u.lookup !== "function") return null
    return u.lookup(name)
}

function lookupZone(name, ctx) {
    var t = tzOf(ctx)
    if (!t || typeof t.lookupZone !== "function") return null
    return t.lookupZone(name)
}

function isCurrencyCode(name, ctx) {
    var r = ratesModOf(ctx)
    if (r && typeof r.isCurrencyCode === "function") return r.isCurrencyCode(name)
    var n = String(name).toUpperCase()
    return n.length === 3 && n === n.toUpperCase() && n >= "AAA" && n <= "ZZZ" &&
        "EUR USD GBP JPY CNY CAD AUD CHF INR KRW SEK NOK DKK PLN CZK HUF RON BGN TRY BRL ZAR MXN ILS THB MYR PHP SGD HKD IDR NZD ISK".indexOf(n) >= 0
}

function convertMoney(amount, from, to, ctx) {
    if (from === to) return amount
    var r = ratesModOf(ctx)
    var rates = ratesOf(ctx)
    if (r && typeof r.convert === "function")
        return r.convert(amount, from, to, rates)
    return null
}

function dimOfUnit(u) {
    return {
        L: u.dim.L || 0, M: u.dim.M || 0, T: u.dim.T || 0,
        data: u.dim.data || 0, money: u.dim.money || 0,
        temp: u.dim.temp || 0, A: u.dim.A || 0
    }
}

function qtyFromUnit(n, u, ctx) {
    var q = qtyNumber(n * u.factor)
    q.dim = dimOfUnit(u)
    q.unitHint = u.id
    q.unitObj = u
    if (u.id === "C" || u.id === "F" || u.id === "K" || u.id === "R") {
        q.value = n
        q.isTemp = true
    }
    return q
}

function qtyMoney(n, code) {
    var q = qtyNumber(n)
    q.dim.money = 1
    q.currency = String(code).toUpperCase()
    q.unitHint = q.currency
    return q
}

function qtyDate(y, m, d) {
    var q = qtyNumber(0)
    q.isDate = true
    q.date = { y: y, m: m, d: d }
    q.value = Date.UTC(y, m - 1, d)
    return q
}

function qtyDateTime(local) {
    var q = qtyNumber(0)
    q.isDateTime = true
    q.local = local
    q.tzResolved = local.zoneId
    q.value = Date.UTC(local.y, local.m - 1, local.d, local.hh, local.mm, local.ss || 0)
    return q
}

function qtyPercent(n) {
    var q = qtyNumber(n / 100)
    q.isPercent = true
    q.percentValue = n
    return q
}

function dimEq(a, b, ctx) {
    var u = unitsOf(ctx)
    if (u && typeof u.dimEq === "function") return u.dimEq(a, b)
    var keys = ["L", "M", "T", "data", "money", "temp", "A"]
    for (var i = 0; i < keys.length; i++) {
        if ((a[keys[i]] || 0) !== (b[keys[i]] || 0)) return false
    }
    return true
}

function dimMul(a, b, ctx) {
    var u = unitsOf(ctx)
    if (u && typeof u.dimMul === "function") return u.dimMul(a, b)
    return {
        L: (a.L || 0) + (b.L || 0),
        M: (a.M || 0) + (b.M || 0),
        T: (a.T || 0) + (b.T || 0),
        data: (a.data || 0) + (b.data || 0),
        money: (a.money || 0) + (b.money || 0),
        temp: (a.temp || 0) + (b.temp || 0),
        A: (a.A || 0) + (b.A || 0)
    }
}

function dimDiv(a, b, ctx) {
    var u = unitsOf(ctx)
    if (u && typeof u.dimDiv === "function") return u.dimDiv(a, b)
    return {
        L: (a.L || 0) - (b.L || 0),
        M: (a.M || 0) - (b.M || 0),
        T: (a.T || 0) - (b.T || 0),
        data: (a.data || 0) - (b.data || 0),
        money: (a.money || 0) - (b.money || 0),
        temp: (a.temp || 0) - (b.temp || 0),
        A: (a.A || 0) - (b.A || 0)
    }
}

function dimZero(d, ctx) {
    var u = unitsOf(ctx)
    if (u && typeof u.dimIsZero === "function") return u.dimIsZero(d)
    return dimEq(d, { L: 0, M: 0, T: 0, data: 0, money: 0, temp: 0, A: 0 }, ctx)
}

function dimDuration(d, ctx) {
    var u = unitsOf(ctx)
    if (u && typeof u.dimIsDuration === "function") return u.dimIsDuration(d)
    return (d.T || 0) === 1 && dimEq(d, { L: 0, M: 0, T: 1, data: 0, money: 0, temp: 0, A: 0 }, ctx)
}

function pickDisplayUnit(q, ctx) {
    if (q.unitObj) return q.unitObj
    if (q.unitHint) {
        var u = lookupUnit(q.unitHint, ctx)
        if (u) return u
    }
    return null
}

function addCalendar(date, n, cal) {
    var y = date.y
    var m = date.m
    var d = date.d
    if (cal === "day") d += n
    else if (cal === "week") d += n * 7
    else if (cal === "month") m += n
    else if (cal === "year") y += n
    else d += n
    while (m > 12) { m -= 12; y += 1 }
    while (m < 1) { m += 12; y -= 1 }
    var dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    function leap(yy) { return (yy % 4 === 0 && yy % 100 !== 0) || (yy % 400 === 0) }
    while (true) {
        var md = dim[m - 1]
        if (m === 2 && leap(y)) md = 29
        if (d > md) { d -= md; m += 1; if (m > 12) { m = 1; y += 1 } }
        else if (d < 1) {
            m -= 1
            if (m < 1) { m = 12; y -= 1 }
            var prev = dim[m - 1]
            if (m === 2 && leap(y)) prev = 29
            d += prev
        } else break
    }
    return { y: y, m: m, d: d }
}

function nextWeekday(from, wd) {
    var cur = new Date(Date.UTC(from.y, from.m - 1, from.d)).getUTCDay()
    var delta = (wd - cur + 7) % 7
    if (delta === 0) delta = 7
    return addCalendar(from, delta, "day")
}

function tempToCanonical(value, unitId) {
    if (unitId === "K") return value
    if (unitId === "C") return value + 273.15
    if (unitId === "F") return (value - 32) * 5 / 9 + 273.15
    if (unitId === "R") return value * 5 / 9
    return value
}

function tempFromCanonical(k, unitId) {
    if (unitId === "K") return k
    if (unitId === "C") return k - 273.15
    if (unitId === "F") return (k - 273.15) * 9 / 5 + 32
    if (unitId === "R") return k * 9 / 5
    return k
}

function applyFormat(q, ctx) {
    if (!q) return q
    if (q.kind === "unresolved") {
        q.display = "?" + (q.names && q.names[0] ? q.names[0] : "name")
        return q
    }
    if (q.kind === "blank" || q.kind === "prose") {
        q.display = ""
        return q
    }
    var fmt = ctx && ctx.format
    if (typeof fmt === "function") {
        q.display = fmt(q, {
            units: unitsOf(ctx),
            ratesMod: ratesModOf(ctx),
            nowDate: nowParts(ctx)
        })
    } else if (!q.display) {
        if (q.currency) q.display = q.currency + " " + q.value
        else if (q.isPercent) q.display = String(q.percentValue) + "%"
        else q.display = String(q.value)
    }
    return q
}

// ---------- tokenizer ----------

function tokenize(line, ctx) {
    var s = String(line)
    var i = 0
    var n = s.length
    var tokens = []
    var tz = tzOf(ctx)
    var phrases = tz && typeof tz.cityPhrases === "function" ? tz.cityPhrases() : []

    function peek(k) { return i + k < n ? s.charAt(i + k) : "" }
    function rest() { return s.slice(i) }

    function matchPhrase() {
        var r = rest()
        var rl = lower(r)
        for (var p = 0; p < phrases.length; p++) {
            var ph = phrases[p]
            if (rl.indexOf(ph) === 0) {
                var after = r.charAt(ph.length)
                if (after && isIdentChar(after)) continue
                return ph
            }
        }
        return null
    }

    function matchUnitAt() {
        var u = unitsOf(ctx)
        if (!u || typeof u.aliasesSorted !== "function") return null
        var aliases = u.aliasesSorted()
        var r = rest()
        var rl = lower(r)
        for (var a = 0; a < aliases.length; a++) {
            var al = aliases[a]
            var all = lower(al)
            if (rl.indexOf(all) === 0) {
                var after = r.charAt(al.length)
                if (al.length <= 2 && isLetter(after)) continue
                if (after && isIdentChar(after)) continue
                if (all === "in" || all === "a" || all === "d" || all === "y" || all === "t" || all === "l") {
                    // short aliases: only if clearly a unit context (prev number handled by caller)
                    if (al.length === 1 && isLetter(after)) continue
                }
                return { alias: al, unit: u.lookup(al) }
            }
        }
        return null
    }

    while (i < n) {
        var ch = s.charAt(i)
        if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\u00a0") {
            i++
            continue
        }
        if (ch === "(") { tokens.push({ type: "lparen", raw: "(" }); i++; continue }
        if (ch === ")") { tokens.push({ type: "rparen", raw: ")" }); i++; continue }
        if (ch === "=") { tokens.push({ type: "op", op: "=", raw: "=" }); i++; continue }
        if (ch === "+" ) { tokens.push({ type: "op", op: "+", raw: "+" }); i++; continue }
        if (ch === "-" || ch === "\u2212" || ch === "\u2013") { tokens.push({ type: "op", op: "-", raw: "-" }); i++; continue }
        if (ch === "*" || ch === "\u00d7") {
            tokens.push({ type: "op", op: "*", raw: ch }); i++; continue
        }
        if (ch === "/" || ch === "\u00f7") { tokens.push({ type: "op", op: "/", raw: ch }); i++; continue }
        if (ch === "^") { tokens.push({ type: "op", op: "^", raw: "^" }); i++; continue }
        if (ch === "%") { tokens.push({ type: "op", op: "%", raw: "%" }); i++; continue }
        if (ch === "\u2192" || (ch === "-" && peek(1) === ">")) {
            if (ch === "\u2192") i += 1
            else i += 2
            tokens.push({ type: "op", op: "arrow", raw: "→" })
            continue
        }
        if (ch === ">" && peek(1) !== "") {
            // ignore stray
        }

        if (CURRENCY_CHARS[ch]) {
            var code = CURRENCY_CHARS[ch]
            i++
            while (i < n && (s.charAt(i) === " " || s.charAt(i) === "\t")) i++
            var numTok = readNumber()
            if (numTok) {
                tokens.push({ type: "money", value: numTok.value, currency: code, raw: ch + numTok.raw })
                continue
            }
            tokens.push({ type: "currency", code: code, raw: ch })
            continue
        }

        if (isDigit(ch) || (ch === "." && isDigit(peek(1)))) {
            var timeTok = readTime()
            if (timeTok) { tokens.push(timeTok); continue }
            var nTok = readNumber()
            if (nTok) { tokens.push(nTok); continue }
        }

        var um = matchUnitAt()
        if (um && um.alias.indexOf("/") >= 0) {
            tokens.push({ type: "unit", unit: um.unit, raw: s.slice(i, i + um.alias.length) })
            i += um.alias.length
            continue
        }

        var ph = matchPhrase()
        if (ph) {
            tokens.push({ type: "zone", name: ph, raw: s.slice(i, i + ph.length) })
            i += ph.length
            continue
        }

        if (isLetter(ch)) {
            var start = i
            while (i < n && isIdentChar(s.charAt(i))) i++
            var word = s.slice(start, i)
            var lw = lower(word)
            if (lw === "x" && tokens.length && (tokens[tokens.length - 1].type === "num" || tokens[tokens.length - 1].type === "money" || tokens[tokens.length - 1].type === "rparen")) {
                tokens.push({ type: "op", op: "*", raw: word })
                continue
            }
            tokens.push({ type: "word", raw: word, low: lw })
            continue
        }

        i++
    }

    function readNumber() {
        var start = i
        if (!isDigit(s.charAt(i)) && !(s.charAt(i) === "." && isDigit(peek(1)))) return null
        var buf = ""
        while (i < n) {
            var c = s.charAt(i)
            if (isDigit(c)) { buf += c; i++; continue }
            if (c === "," && isDigit(peek(1)) && isDigit(peek(2)) && isDigit(peek(3))) {
                i++
                continue
            }
            if (c === "." && isDigit(peek(1))) {
                buf += "."
                i++
                while (i < n && isDigit(s.charAt(i))) { buf += s.charAt(i); i++ }
                break
            }
            break
        }
        if (!buf.length) { i = start; return null }
        return { type: "num", value: parseFloat(buf), raw: s.slice(start, i) }
    }

    function readTime() {
        var start = i
        var hbuf = ""
        while (i < n && isDigit(s.charAt(i))) { hbuf += s.charAt(i); i++ }
        if (hbuf.length === 0 || hbuf.length > 2) { i = start; return null }
        var hh = parseInt(hbuf, 10)
        var mm = 0
        var sawColon = false
        if (s.charAt(i) === ":" && isDigit(peek(1))) {
            sawColon = true
            i++
            var mbuf = ""
            while (i < n && isDigit(s.charAt(i))) { mbuf += s.charAt(i); i++ }
            if (mbuf.length !== 2) { i = start; return null }
            mm = parseInt(mbuf, 10)
        }
        var j = i
        while (j < n && (s.charAt(j) === " " || s.charAt(j) === "\t")) j++
        var ap = ""
        var w = s.slice(j, j + 2).toLowerCase()
        if (w === "am" || w === "pm") {
            ap = w
            j += 2
            if (j < n && isIdentChar(s.charAt(j))) { i = start; return null }
            i = j
        } else if (!sawColon) {
            i = start
            return null
        }
        if (hh > 24 || mm > 59) { i = start; return null }
        if (ap === "am") {
            if (hh === 12) hh = 0
        } else if (ap === "pm") {
            if (hh !== 12) hh += 12
        }
        return { type: "time", hh: hh, mm: mm, raw: s.slice(start, i) }
    }

    return tokens
}

function splitAssign(line) {
    var s = String(line)
    var depth = 0
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i)
        if (ch === "(") depth++
        else if (ch === ")") depth--
        else if (ch === "=" && depth === 0) {
            var left = s.slice(0, i).replace(/^\s+|\s+$/g, "")
            var right = s.slice(i + 1)
            if (!left) return null
            if (!/[a-zA-Z]/.test(left)) return null
            if (/[+\-*/^]/.test(left) && left.indexOf(" ") < 0) return null
            if (/[:\/?@#]/.test(left)) return null
            return { name: lower(left).replace(/\s+/g, " "), rawName: left, expr: right }
        }
    }
    return null
}

function isConvertTarget(tok, ctx, env) {
    if (!tok) return false
    if (tok.type === "unit" || tok.type === "currency" || tok.type === "zone") return true
    if (tok.type !== "word") return false
    var lw = tok.low || lower(tok.raw)
    if (isCurrencyCode(tok.raw, ctx)) return true
    if (lookupZone(tok.raw, ctx)) return true
    if (lw !== "in" && lookupUnit(tok.raw, ctx)) return true
    return false
}

function classifyToken(tok, ctx, env) {
    if (tok.type !== "word") return tok
    var lw = tok.low
    if (lw === "in") return tok
    if (RESERVED[lw]) {
        if (lw === "sum" || lw === "total") return { type: "agg", op: "sum", raw: tok.raw }
        if (lw === "avg" || lw === "average") return { type: "agg", op: "avg", raw: tok.raw }
        if (lw === "prev") return { type: "prev", raw: tok.raw }
        if (lw === "time") return { type: "prose", raw: tok.raw }
        return { type: "op", op: lw, raw: tok.raw }
    }
    if (DATEWORDS[lw]) {
        if (MONTH_NUM[lw] !== undefined)
            return { type: "month", n: MONTH_NUM[lw], raw: tok.raw }
        if (WEEKDAY_NUM[lw] !== undefined)
            return { type: "weekday", n: WEEKDAY_NUM[lw], raw: tok.raw }
        return { type: "dateword", word: lw, raw: tok.raw }
    }
    if (isCurrencyCode(tok.raw, ctx))
        return { type: "currency", code: tok.raw.toUpperCase(), raw: tok.raw }
    var u = lookupUnit(tok.raw, ctx)
    if (u) return { type: "unit", unit: u, raw: tok.raw }
    var z = lookupZone(tok.raw, ctx)
    if (z) return { type: "zone", name: tok.raw, zone: z, raw: tok.raw }
    return tok
}

function classifyAll(tokens, ctx, env) {
    var out = []
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "word") {
            var matched = matchVarFrom(tokens, i, env)
            if (matched) {
                out.push({ type: "var", name: matched.name, raw: matched.raw })
                i += matched.consume - 1
                continue
            }
        }
        var t = tokens[i]
        if (t.type === "word" && t.low === "in") {
            var next = tokens[i + 1]
            var prev = out.length ? out[out.length - 1] : null
            if (isConvertTarget(next, ctx, env)) {
                out.push({ type: "op", op: "in", raw: t.raw })
                continue
            }
            if (prev && (prev.type === "num" || prev.type === "rparen" || prev.type === "money")) {
                var inch = lookupUnit("in", ctx)
                if (inch) {
                    out.push({ type: "unit", unit: inch, raw: t.raw })
                    continue
                }
            }
            out.push({ type: "op", op: "in", raw: t.raw })
            continue
        }
        t = classifyToken(t, ctx, env)
        if (t.type === "zone" && !t.zone) {
            t.zone = lookupZone(t.name || t.raw, ctx)
        }
        out.push(t)
    }
    return out
}

function matchVarFrom(tokens, i, env) {
    if (!env || !env.varNames || !env.varNames.length) return null
    var parts = []
    var j = i
    while (j < tokens.length && tokens[j].type === "word") {
        parts.push(tokens[j].low || lower(tokens[j].raw))
        j++
    }
    if (!parts.length) return null
    var joined = parts.join(" ")
    var names = env.varNames
    for (var k = 0; k < names.length; k++) {
        var n = names[k]
        if (joined === n) {
            return { name: n, consume: n.split(" ").length, raw: n }
        }
        if (joined.indexOf(n) === 0 && (joined.length === n.length || joined.charAt(n.length) === " ")) {
            return { name: n, consume: n.split(" ").length, raw: n }
        }
    }
    return null
}

function countStrong(tokens) {
    var n = 0
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i]
        if (t.type === "num" || t.type === "money" || t.type === "unit" || t.type === "time" ||
            t.type === "dateword" || t.type === "agg" || t.type === "prev" || t.type === "weekday" ||
            t.type === "month") n++
        if (t.type === "op" && (t.op === "+" || t.op === "-" || t.op === "*" || t.op === "/" ||
            t.op === "^" || t.op === "%" || t.op === "=")) n++
        if (t.type === "currency") n++
    }
    return n
}

function unknownWords(tokens) {
    var names = []
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "word") names.push(tokens[i].low || lower(tokens[i].raw))
    }
    return names
}

function onlyWeakOps(tokens) {
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i]
        if (t.type === "op" && (t.op === "+" || t.op === "-" || t.op === "*" || t.op === "/" ||
            t.op === "^" || t.op === "%" || t.op === "=")) return false
        if (t.type === "money" || t.type === "unit" || t.type === "currency" || t.type === "agg")
            return false
    }
    return true
}

function dropProse(tokens) {
    var out = []
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "prose") continue
        out.push(tokens[i])
    }
    return out
}

function isBareConversion(tokens) {
    var ops = []
    var rest = []
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i]
        if (t.type === "word") continue
        if (t.type === "op" && (t.op === "in" || t.op === "as" || t.op === "to")) ops.push(t)
        else rest.push(t)
    }
    if (ops.length === 0) return false
    if (rest.length === 0) return false
    for (var j = 0; j < rest.length; j++) {
        var r = rest[j]
        if (r.type === "currency" || r.type === "unit" || r.type === "zone") continue
        if (r.type === "word") continue
        return false
    }
    var hasValue = false
    for (var k = 0; k < tokens.length; k++) {
        if (tokens[k].type === "num" || tokens[k].type === "money" || tokens[k].type === "time" ||
            tokens[k].type === "var" || tokens[k].type === "dateword") hasValue = true
    }
    return !hasValue
}

function isAggregateLine(tokens) {
    var saw = false
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type === "agg") saw = true
        else if (tokens[i].type === "word" || tokens[i].type === "prose") continue
        else return false
    }
    return saw
}

// ---------- Pratt parser ----------

function Parser(tokens, ctx, env) {
    this.tokens = tokens
    this.i = 0
    this.ctx = ctx
    this.env = env
    this.unresolved = []
}

Parser.prototype.peek = function () {
    if (this.i >= this.tokens.length) return { type: "eof" }
    return this.tokens[this.i]
}

Parser.prototype.next = function () {
    var t = this.peek()
    if (t.type !== "eof") this.i++
    return t
}

Parser.prototype.prec = function (t) {
    if (!t || t.type === "eof") return 0
    if (t.type === "unit") return 70
    if (t.type === "op") {
        if (t.op === "arrow") return 8
        if (t.op === "in" || t.op === "as" || t.op === "to" || t.op === "from") return 10
        if (t.op === "ago") return 12
        if (t.op === "+") return 20
        if (t.op === "-") return 20
        if (t.op === "*") return 30
        if (t.op === "/") return 30
        if (t.op === "per") return 32
        if (t.op === "of") return 35
        if (t.op === "%") return 45
        if (t.op === "^") return 50
    }
    if (t.type === "zone") return 9
    return 0
}

Parser.prototype.parse = function (minPrec) {
    var left = this.parsePrefix()
    if (!left) return null
    while (true) {
        var t = this.peek()
        var p = this.prec(t)
        if (p <= minPrec) break
        left = this.parseInfix(left, this.next(), p)
        if (!left) return null
    }
    return left
}

Parser.prototype.parsePrefix = function () {
    var t = this.peek()
    if (t.type === "eof") return null
    if (t.type === "word") {
        var name = t.low || lower(t.raw)
        this.next()
        this.unresolved.push(name)
        return unresolvedResult([name])
    }
    if (t.type === "op" && (t.op === "+" || t.op === "-")) {
        this.next()
        var rhs = this.parse(40)
        if (!rhs || rhs.kind === "unresolved") return rhs
        if (t.op === "-") {
            if (rhs.isDate || rhs.isDateTime) return null
            rhs = cloneQty(rhs)
            rhs.value = -rhs.value
            if (rhs.percentValue !== undefined) rhs.percentValue = -rhs.percentValue
        }
        return rhs
    }
    if (t.type === "lparen") {
        this.next()
        var inner = this.parse(0)
        if (this.peek().type === "rparen") this.next()
        return inner
    }
    if (t.type === "num") {
        this.next()
        var q = qtyNumber(t.value)
        if (this.peek().type === "op" && this.peek().op === "%") {
            this.next()
            return qtyPercent(t.value)
        }
        if (this.peek().type === "unit") {
            var u = this.next().unit
            return this.applyUnit(q, u)
        }
        if (this.peek().type === "currency") {
            var c = this.next()
            return qtyMoney(t.value, c.code)
        }
        if (this.peek().type === "month") {
            var mo = this.next()
            var day = t.value
            var year = nowParts(this.ctx).y
            if (this.peek().type === "num" && this.peek().value >= 1000) {
                year = this.next().value
            }
            return qtyDate(year, mo.n, day)
        }
        return q
    }
    if (t.type === "money") {
        this.next()
        return qtyMoney(t.value, t.currency)
    }
    if (t.type === "unit") {
        this.next()
        return qtyFromUnit(1, t.unit, this.ctx)
    }
    if (t.type === "currency") {
        this.next()
        if (this.peek().type === "num") {
            var n = this.next()
            return qtyMoney(n.value, t.code)
        }
        return { kind: "currencyTarget", code: t.code }
    }
    if (t.type === "time") {
        this.next()
        return { kind: "result", isTime: true, hh: t.hh, mm: t.mm, value: t.hh * 3600 + t.mm * 60, dim: { L: 0, M: 0, T: 1, data: 0, money: 0, temp: 0, A: 0 } }
    }
    if (t.type === "dateword") {
        this.next()
        var np = nowParts(this.ctx)
        if (t.word === "today") return qtyDate(np.y, np.m, np.d)
        if (t.word === "tomorrow") return qtyDate.apply(null, dateTriple(addCalendar(np, 1, "day")))
        if (t.word === "yesterday") return qtyDate.apply(null, dateTriple(addCalendar(np, -1, "day")))
        return null
    }
    if (t.type === "weekday") {
        this.next()
        return qtyDate.apply(null, dateTriple(nextWeekday(nowParts(this.ctx), t.n)))
    }
    if (t.type === "month") {
        this.next()
        var dayN = 1
        var yearN = nowParts(this.ctx).y
        if (this.peek().type === "num") {
            dayN = this.next().value
            if (this.peek().type === "num" && this.peek().value >= 1000)
                yearN = this.next().value
        }
        return qtyDate(yearN, t.n, dayN)
    }
    if (t.type === "var") {
        this.next()
        var val = this.env.vars[t.name]
        if (!val) {
            this.unresolved.push(t.name)
            return unresolvedResult([t.name])
        }
        return cloneQty(val)
    }
    if (t.type === "prev") {
        this.next()
        if (!this.env.prevResult) return null
        return cloneQty(this.env.prevResult)
    }
    if (t.type === "agg") {
        this.next()
        return this.env.aggregate ? this.env.aggregate(t.op) : null
    }
    if (t.type === "zone") {
        this.next()
        return { kind: "zoneTarget", zone: t.zone || lookupZone(t.name, this.ctx), name: t.name }
    }
    this.next()
    return null
}

function dateTriple(d) { return [d.y, d.m, d.d] }

Parser.prototype.applyUnit = function (q, u) {
    if (!q || q.kind === "unresolved") return q
    if (q.isDate && u.calendar) {
        return q
    }
    if (q.isPercent) return q
    if (u.id === "C" || u.id === "F" || u.id === "K" || u.id === "R") {
        var tq = qtyNumber(q.value)
        tq.dim = dimOfUnit(u)
        tq.unitHint = u.id
        tq.unitObj = u
        tq.isTemp = true
        tq.value = q.value
        return tq
    }
    if (q.currency) {
        var mq = cloneQty(q)
        mq.dim = dimMul(q.dim, dimOfUnit(u), this.ctx)
        mq.unitHint = u.id
        mq.unitObj = u
        if ((mq.dim.T || 0) === -1) mq.perUnit = u
        return mq
    }
    var out = qtyNumber(q.value * u.factor)
    out.dim = dimMul(q.dim, dimOfUnit(u), this.ctx)
    out.currency = q.currency
    out.unitHint = u.id
    out.unitObj = u
    if (q.currency) out.dim.money = (out.dim.money || 0) + (q.dim.money || 0)
    if (q.dim && q.dim.money && !out.currency) out.currency = q.currency
    return out
}

Parser.prototype.parseInfix = function (left, opTok, prec) {
    if (left && left.kind === "unresolved") return left
    if (opTok.type === "unit") {
        return this.applyUnit(left, opTok.unit)
    }
    if (opTok.type === "zone") {
        return this.convertZone(left, opTok.zone || lookupZone(opTok.name, this.ctx), null)
    }
    var op = opTok.op
    if (op === "%") {
        if (left && left.kind === "result" && !left.currency && dimZero(left.dim, this.ctx))
            return qtyPercent(left.value)
        return left
    }
    if (op === "ago") {
        if (left && dimDuration(left.dim, this.ctx)) {
            var days = left.value / 86400
            var np = nowParts(this.ctx)
            var uobj = left.unitObj
            var cal = uobj && uobj.calendar ? uobj.calendar : "day"
            var n = cal === "day" ? Math.round(days) : (left.value / (uobj ? uobj.factor : 86400))
            return qtyDate.apply(null, dateTriple(addCalendar(np, -n, cal)))
        }
        return left
    }
    if (op === "of") {
        var right = this.parse(prec)
        if (!right) return unresolvedResult(this.unresolved.length ? this.unresolved : ["of"])
        if (right.kind === "unresolved") return right
        if (left && left.isPercent) return this.mul(qtyNumber(left.value), right)
        return this.mul(left, right)
    }
    if (op === "per") {
        var denom = this.parse(prec)
        if (!denom) return null
        return this.div(left, denom)
    }
    if (op === "+" || op === "-") {
        if (op === "+" && this.peek().type === "num") {
            var look = this.tokens[this.i]
            var look2 = this.tokens[this.i + 1]
            if (look2 && look2.type === "op" && look2.op === "%") {
                this.next()
                this.next()
                var pct = look.value
                var scaled = cloneQty(left)
                if (left.isDate) {
                    return left
                }
                scaled.value = left.value * (1 + pct / 100)
                if (left.isPercent) scaled.percentValue = left.percentValue * (1 + pct / 100)
                return scaled
            }
        }
        var rhs = this.parse(prec)
        if (!rhs) return left
        if (rhs.kind === "unresolved") return rhs
        if (op === "+") return this.add(left, rhs)
        return this.sub(left, rhs)
    }
    if (op === "*") {
        var r2 = this.parse(prec)
        if (!r2) return null
        if (r2.kind === "unresolved") return r2
        return this.mul(left, r2)
    }
    if (op === "/") {
        var r3 = this.parse(prec)
        if (!r3) return null
        if (r3.kind === "unresolved") return r3
        return this.div(left, r3)
    }
    if (op === "^") {
        var r4 = this.parse(prec)
        if (!r4 || r4.kind === "unresolved") return r4
        var out = cloneQty(left)
        out.value = Math.pow(left.value, r4.value)
        return out
    }
    if (op === "in" || op === "as" || op === "to" || op === "from") {
        return this.parseConvert(left, op)
    }
    if (op === "arrow") {
        return this.parseArrow(left)
    }
    return left
}

Parser.prototype.parseConvert = function (left, op) {
    var t = this.peek()
    if (t.type === "currency") {
        this.next()
        return this.toCurrency(left, t.code)
    }
    if (t.type === "unit") {
        this.next()
        return this.toUnit(left, t.unit, op === "as")
    }
    if (t.type === "zone") {
        this.next()
        var fromZ = t.zone || lookupZone(t.name, this.ctx)
        var toZ = null
        if (this.peek().type === "op" && (this.peek().op === "arrow" || this.peek().op === "to")) {
            this.next()
            if (this.peek().type === "zone") {
                var zt = this.next()
                toZ = zt.zone || lookupZone(zt.name, this.ctx)
            } else if (this.peek().type === "word") {
                var w = this.next()
                toZ = lookupZone(w.raw, this.ctx)
                if (!toZ) this.unresolved.push(w.low)
            }
        }
        return this.convertZone(left, fromZ, toZ)
    }
    if (t.type === "word") {
        var w2 = this.next()
        var u2 = lookupUnit(w2.raw, this.ctx)
        if (u2) return this.toUnit(left, u2, op === "as")
        if (isCurrencyCode(w2.raw, this.ctx)) return this.toCurrency(left, w2.raw.toUpperCase())
        var z2 = lookupZone(w2.raw, this.ctx)
        if (z2) return this.convertZone(left, z2, null)
        this.unresolved.push(w2.low)
        return unresolvedResult([w2.low])
    }
    return left
}

Parser.prototype.parseArrow = function (left) {
    var t = this.peek()
    if (t.type === "zone") {
        this.next()
        var toZ = t.zone || lookupZone(t.name, this.ctx)
        var fromZ = left && left.local && left.local.zoneId
            ? lookupZone(left.local.zoneId, this.ctx)
            : null
        if (left && left.fromZone) fromZ = left.fromZone
        if (left && left.isTime && left.fromZone) fromZ = left.fromZone
        if (!fromZ && left && left.zone) fromZ = left.zone
        return this.convertZone(left, fromZ, toZ)
    }
    if (t.type === "word") {
        var w = this.next()
        var z = lookupZone(w.raw, this.ctx)
        if (z) return this.convertZone(left, left.fromZone || left.zone, z)
        this.unresolved.push(w.low)
        return unresolvedResult([w.low])
    }
    if (t.type === "currency") {
        this.next()
        return this.toCurrency(left, t.code)
    }
    if (t.type === "unit") {
        this.next()
        return this.toUnit(left, t.unit, false)
    }
    return left
}

Parser.prototype.convertZone = function (left, fromZ, toZ) {
    var tz = tzOf(this.ctx)
    if (!tz) return left
    var np = nowParts(this.ctx)
    var hh = 0
    var mm = 0
    var y = np.y
    var m = np.m
    var d = np.d
    if (left && left.isTime) { hh = left.hh; mm = left.mm }
    else if (left && left.isDateTime && left.local) {
        y = left.local.y; m = left.local.m; d = left.local.d
        hh = left.local.hh; mm = left.local.mm
        if (!fromZ && left.local.zoneId) fromZ = tz.lookupZone(left.local.zoneId)
    } else if (left && left.isDate && left.date) {
        y = left.date.y; m = left.date.m; d = left.date.d
    }
    if (!fromZ && !toZ) return left
    if (fromZ && !toZ) {
        var tagged = left && left.isTime ? cloneQty(left) : { kind: "result", isTime: true, hh: hh, mm: mm, value: hh * 3600 + mm * 60, dim: { L: 0, M: 0, T: 1, data: 0, money: 0, temp: 0, A: 0 } }
        tagged.fromZone = fromZ
        tagged.zone = fromZ
        tagged.tzResolved = fromZ.id
        tagged.isTime = true
        tagged.hh = hh
        tagged.mm = mm
        var utc0 = tz.localToUtc(y, m, d, hh, mm, fromZ)
        tagged.local = tz.utcToLocal(utc0, fromZ)
        tagged.isDateTime = true
        return tagged
    }
    if (!fromZ && toZ && left && left.fromZone) fromZ = left.fromZone
    if (!fromZ && toZ) {
        fromZ = tz.lookupZone("UTC")
    }
    if (fromZ && toZ) {
        var local = tz.convertWall(y, m, d, hh, mm, fromZ, toZ)
        var q = qtyDateTime(local)
        q.tzResolved = toZ.id
        q.fromZone = fromZ
        q.toZone = toZ
        return q
    }
    return left
}

Parser.prototype.toCurrency = function (left, code) {
    if (!left) return left
    if (left.kind === "currencyTarget") {
        left.code = code
        return left
    }
    if (left.kind === "unresolved") return left
    if (!left.currency) {
        if (dimZero(left.dim, this.ctx)) {
            var from = this.ctx && this.ctx.defaultCurrency
            if (from && String(from).toUpperCase() !== String(code).toUpperCase()) {
                var asDefault = convertMoney(left.value, from, code, this.ctx)
                if (asDefault !== null)
                    return qtyMoney(asDefault, code)
            }
            return qtyMoney(left.value, code)
        }
        return left
    }
    var conv = convertMoney(left.value, left.currency, code, this.ctx)
    if (conv === null) return left
    var q = qtyMoney(conv, code)
    q.dim = {
        L: left.dim.L || 0, M: left.dim.M || 0, T: left.dim.T || 0,
        data: left.dim.data || 0, money: left.dim.money || 0,
        temp: left.dim.temp || 0, A: left.dim.A || 0
    }
    return q
}

Parser.prototype.toUnit = function (left, u, asFlag) {
    if (!left || left.kind === "unresolved") return left
    if (left.isTemp || (left.dim && (left.dim.temp || 0) === 1)) {
        var fromId = left.unitHint || "K"
        var k = tempToCanonical(left.value, fromId)
        var v = tempFromCanonical(k, u.id)
        var tq = qtyNumber(v)
        tq.dim = dimOfUnit(u)
        tq.unitHint = u.id
        tq.unitObj = u
        tq.isTemp = true
        tq.asUnit = !!asFlag
        return tq
    }
    if (left.isDate && u.calendar) {
        return left
    }
    if (!dimEq(left.dim, dimOfUnit(u), this.ctx)) {
        var ratio = null
        if (dimZero(left.dim, this.ctx)) {
            return this.applyUnit(left, u)
        }
        return left
    }
    var out = cloneQty(left)
    out.unitHint = u.id
    out.unitObj = u
    out.asUnit = !!asFlag
    return out
}

Parser.prototype.add = function (a, b) {
    if (b.isPercent && !a.isPercent && !a.isDate) {
        var s = cloneQty(a)
        s.value = a.value * (1 + b.value)
        return s
    }
    if (a.isPercent && b.isPercent)
        return qtyPercent(a.percentValue + b.percentValue)
    if (a.isDate && dimDuration(b.dim, this.ctx)) {
        var u = b.unitObj
        var cal = u && u.calendar ? u.calendar : "day"
        var n = b.value / (u ? u.factor : 86400)
        if (cal === "day") n = Math.round(b.value / 86400)
        return qtyDate.apply(null, dateTriple(addCalendar(a.date, n, cal)))
    }
    if (b.isDate && dimDuration(a.dim, this.ctx)) return this.add(b, a)
    if (a.isTemp && b.isTemp && a.unitHint === b.unitHint) {
        var t = cloneQty(a)
        t.value = a.value + b.value
        return t
    }
    if (a.currency && b.currency && a.currency !== b.currency) {
        var bv = convertMoney(b.value, b.currency, a.currency, this.ctx)
        if (bv === null) return a
        b = qtyMoney(bv, a.currency)
        b.dim = b.dim
    }
    if (a.currency && !b.currency && dimZero(b.dim, this.ctx)) {
        var m = cloneQty(a)
        m.value = a.value + b.value
        return m
    }
    if (!dimEq(a.dim, b.dim, this.ctx)) return a
    var o = cloneQty(a)
    o.value = a.value + b.value
    return o
}

Parser.prototype.sub = function (a, b) {
    if (b.isPercent && !a.isPercent && !a.isDate) {
        var s = cloneQty(a)
        s.value = a.value * (1 - b.value)
        return s
    }
    if (a.isDate && dimDuration(b.dim, this.ctx)) {
        var u = b.unitObj
        var cal = u && u.calendar ? u.calendar : "day"
        var n = b.value / (u ? u.factor : 86400)
        if (cal === "day") n = Math.round(b.value / 86400)
        return qtyDate.apply(null, dateTriple(addCalendar(a.date, -n, cal)))
    }
    if (a.isDate && b.isDate) {
        var days = Math.round((a.value - b.value) / 86400000)
        var q = qtyNumber(days * 86400)
        q.dim.T = 1
        q.unitHint = "d"
        q.unitObj = lookupUnit("d", this.ctx)
        return q
    }
    if (a.currency && b.currency && a.currency !== b.currency) {
        var bv = convertMoney(b.value, b.currency, a.currency, this.ctx)
        if (bv === null) return a
        b = qtyMoney(bv, a.currency)
    }
    if (!dimEq(a.dim, b.dim, this.ctx)) return a
    var o = cloneQty(a)
    o.value = a.value - b.value
    return o
}

Parser.prototype.mul = function (a, b) {
    if (a.isPercent && !b.isPercent) return this.mul(qtyNumber(a.value), b)
    if (b.isPercent && !a.isPercent) return this.mul(a, qtyNumber(b.value))
    if (a.currency && dimDuration(b.dim, this.ctx)) {
        var per = a.perUnit || a.unitObj
        var factor = per && per.factor ? per.factor : (b.unitObj ? b.unitObj.factor : 1)
        var o = qtyMoney(a.value * (b.value / factor), a.currency)
        o.dim = dimMul(a.dim, b.dim, this.ctx)
        if ((o.dim.T || 0) === 0) {
            o.unitHint = a.currency
            o.unitObj = null
            o.perUnit = null
        }
        return o
    }
    if (b.currency && dimDuration(a.dim, this.ctx)) return this.mul(b, a)
    if (a.currency && dimZero(b.dim, this.ctx)) {
        var scaled = cloneQty(a)
        scaled.value = a.value * b.value
        if ((a.dim.T || 0) === -1) {
            scaled.dim = {
                L: a.dim.L || 0, M: a.dim.M || 0, T: 0,
                data: a.dim.data || 0, money: a.dim.money || 0,
                temp: a.dim.temp || 0, A: a.dim.A || 0
            }
            scaled.perUnit = null
            scaled.unitObj = null
            scaled.unitHint = a.currency
        }
        return scaled
    }
    if (b.currency && dimZero(a.dim, this.ctx)) return this.mul(b, a)
    var out = qtyNumber(a.value * b.value)
    out.dim = dimMul(a.dim, b.dim, this.ctx)
    out.currency = a.currency || b.currency
    if (a.currency && !dimZero(b.dim, this.ctx) && !b.currency) {
        out.currency = a.currency
    }
    if ((out.dim.money || 0) === 0) out.currency = a.currency && dimZero(b.dim, this.ctx) ? a.currency : (b.currency && dimZero(a.dim, this.ctx) ? b.currency : out.currency)
    if ((out.dim.money || 0) === 0) {
        if (!(a.currency && dimZero(b.dim, this.ctx)) && !(b.currency && dimZero(a.dim, this.ctx)))
            out.currency = null
    }
    if (a.unitObj && dimZero(b.dim, this.ctx)) { out.unitObj = a.unitObj; out.unitHint = a.unitHint }
    if (b.unitObj && dimZero(a.dim, this.ctx)) { out.unitObj = b.unitObj; out.unitHint = b.unitHint }
    return out
}

Parser.prototype.div = function (a, b) {
    if (!b || b.value === 0) return a
    if (b.isPercent) return this.div(a, qtyNumber(b.value))
    if (a.currency && dimDuration(b.dim, this.ctx)) {
        var dq = cloneQty(a)
        dq.dim = dimDiv(a.dim, b.dim, this.ctx)
        dq.perUnit = b.unitObj
        dq.unitObj = b.unitObj
        dq.unitHint = b.unitHint || (b.unitObj ? b.unitObj.id : a.unitHint)
        return dq
    }
    var out = qtyNumber(a.value / b.value)
    out.dim = dimDiv(a.dim, b.dim, this.ctx)
    out.currency = a.currency
    if ((out.dim.money || 0) === 0 && !a.currency) out.currency = null
    if (a.currency && !dimDuration(b.dim, this.ctx)) {
        out.currency = a.currency
        if ((out.dim.money || 0) === 0) out.dim.money = 1
    }
    if (dimDuration(out.dim, this.ctx)) {
        out.unitHint = "s"
        out.unitObj = lookupUnit("s", this.ctx)
    }
    return out
}

function isInfixOperandOp(op) {
    return op === "+" || op === "-" || op === "*" || op === "^" ||
        op === "of" || op === "per"
}

function parseTokens(tokens, ctx, env) {
    var p = new Parser(tokens, ctx, env)
    while (p.peek().type === "word") {
        var nxt = p.tokens[p.i + 1]
        if (nxt && nxt.type === "op" && isInfixOperandOp(nxt.op)) break
        p.next()
    }
    var val = p.parse(0)
    if (val && val.kind === "unresolved") return val
    while (p.peek().type === "word" || p.peek().type === "prose") p.next()
    return val
}

function makeAggregate(results, index, op) {
    var start = 0
    for (var k = index - 1; k >= 0; k--) {
        if (results[k] && results[k].kind === "blank") {
            start = k + 1
            break
        }
    }
    var first = -1
    var last = -1
    var acc = null
    var count = 0
    var wantDim = null
    var wantCur = null
    for (var i = start; i < index; i++) {
        var r = results[i]
        if (!r || r.kind !== "result") continue
        if (!wantDim) {
            wantDim = r.dim
            wantCur = r.currency
        }
        if (r.currency && wantCur && r.currency !== wantCur) continue
        if (wantDim && !dimEq(r.dim, wantDim, {})) continue
        if (first < 0) first = i
        last = i
        if (!acc) acc = cloneQty(r)
        else acc.value = acc.value + r.value
        count++
    }
    if (!acc) return null
    if (op === "avg" && count) acc.value = acc.value / count
    acc.sumFrom = first
    acc.sumTo = last
    acc.sumOp = op
    return acc
}

function evalLine(line, ctx, env) {
    var raw = String(line)
    var trimmed = raw.replace(/^\s+|\s+$/g, "")
    if (!trimmed) return blankResult()
    if (/[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) || /www\./i.test(trimmed))
        return proseResult()

    var assign = splitAssign(raw)
    var exprSrc = assign ? assign.expr : raw
    var tokens = tokenize(exprSrc, ctx)
    var classified = classifyAll(tokens, ctx, env)
    var unknown = unknownWords(classified)
    var strong = countStrong(classified)

    if (assign) {
        env.pendingName = assign.name
        var filtered = dropProse(classified)
        if (isAggregateLine(filtered)) {
            var ag = env.aggregate(filtered[0] ? filtered[0].op : "sum")
            if (ag) {
                env.vars[assign.name] = ag
                rememberVar(env, assign.name)
                return ag
            }
        }
        if (unknown.length && strong >= 1) {
            var valTry = parseTokens(filtered, ctx, env)
            if (valTry && valTry.kind === "unresolved") return valTry
            if (valTry && valTry.kind === "result" && !(valTry.unresolvedNames && valTry.unresolvedNames.length)) {
                env.vars[assign.name] = valTry
                rememberVar(env, assign.name)
                return valTry
            }
            if (unknown.length)
                return unresolvedResult(unknown)
        }
        var val = parseTokens(filtered, ctx, env)
        if (val && val.kind === "unresolved") return val
        if (val && val.kind === "result") {
            env.vars[assign.name] = val
            rememberVar(env, assign.name)
            return val
        }
        if (unknown.length) return unresolvedResult(unknown)
        return proseResult()
    }

    var filtered2 = dropProse(classified)
    if (isAggregateLine(filtered2)) {
        var ag2 = env.aggregate(filtered2[0].op)
        return ag2 || proseResult()
    }
    if (isBareConversion(classified)) {
        if (!env.prevResult) return proseResult()
        var convP = new Parser(filtered2, ctx, env)
        var conv = convP.parseConvert(cloneQty(env.prevResult), "in")
        if (convP.peek && convP.i === 0) {
            conv = parseTokens(filtered2, ctx, env)
            if (conv && conv.kind === "currencyTarget" && env.prevResult)
                conv = new Parser([], ctx, env).toCurrency(cloneQty(env.prevResult), conv.code)
            if (conv && conv.kind === "zoneTarget" && env.prevResult)
                conv = new Parser([], ctx, env).convertZone(cloneQty(env.prevResult), conv.zone, null)
        }
        if (!conv || conv === env.prevResult) {
            var p2 = new Parser(filtered2, ctx, env)
            if (p2.peek().type === "op") {
                var opTok = p2.next()
                conv = p2.parseConvert(cloneQty(env.prevResult), opTok.op)
            }
        }
        return conv && conv.kind === "result" ? conv : proseResult()
    }

    if (strong === 0 && unknown.length === 0) return proseResult()
    if (strong === 0) return proseResult()
    if (strong <= 1 && onlyWeakOps(classified) && unknown.length)
        return proseResult()

    var val2 = parseTokens(filtered2, ctx, env)
    if (val2 && val2.kind === "unresolved") return val2
    if (unknown.length && (!val2 || val2.kind !== "result"))
        return unresolvedResult(unknown)
    if (val2 && val2.kind === "result") {
        if (val2.unresolvedNames && val2.unresolvedNames.length && unknown.length)
            return unresolvedResult(unknown)
        return val2
    }
    if (strong >= 2 && unknown.length) return unresolvedResult(unknown)
    return proseResult()
}

function rememberVar(env, name) {
    var found = false
    for (var i = 0; i < env.varNames.length; i++) {
        if (env.varNames[i] === name) { found = true; break }
    }
    if (!found) env.varNames.push(name)
    env.varNames.sort(function (a, b) { return b.length - a.length })
}

function evalSheet(lines, ctx) {
    ctx = ctx || {}
    var list = lines
    if (typeof lines === "string") list = String(lines).split("\n")
    var results = []
    var env = {
        vars: {},
        varNames: [],
        prevResult: null,
        aggregate: function (op) {
            return makeAggregate(results, results.length, op)
        }
    }
    for (var i = 0; i < list.length; i++) {
        var line = list[i]
        var r
        try {
            r = evalLine(line, ctx, env)
        } catch (e) {
            r = proseResult()
        }
        if (!r) r = proseResult()
        r.lineIndex = i
        applyFormat(r, ctx)
        results.push(r)
        if (r.kind === "result") env.prevResult = r
    }
    return results
}

function evalText(text, ctx) {
    return evalSheet(String(text).split("\n"), ctx)
}

function sheetTotal(results) {
    if (!results || !results.length) return null
    var lastSum = null
    var last = null
    for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].kind === "result") {
            last = results[i]
            if (results[i].sumOp) lastSum = results[i]
        }
    }
    return lastSum || last
}

function neverThrows(text, ctx) {
    try {
        evalSheet(String(text).split("\n"), ctx)
        return true
    } catch (e) {
        return false
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        tokenize: tokenize,
        splitAssign: splitAssign,
        evalLine: evalLine,
        evalSheet: evalSheet,
        evalText: evalText,
        sheetTotal: sheetTotal,
        neverThrows: neverThrows,
        applyFormat: applyFormat
    }
}
