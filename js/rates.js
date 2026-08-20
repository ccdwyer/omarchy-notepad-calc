// ECB daily reference rates (~30 currencies vs EUR). Pure JS.
// Convert through EUR. Injected snapshot is the source of truth.

var ECB_CODES = [
    "EUR", "USD", "JPY", "BGN", "CZK", "DKK", "GBP", "HUF", "PLN", "RON",
    "SEK", "CHF", "ISK", "NOK", "TRY", "AUD", "BRL", "CAD", "CNY", "HKD",
    "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR"
]

var SYMBOLS = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    KRW: "₩",
    CHF: "CHF ",
    AUD: "A$",
    CAD: "C$",
    NZD: "NZ$",
    HKD: "HK$",
    SGD: "S$",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    BGN: "лв",
    TRY: "₺",
    BRL: "R$",
    ZAR: "R",
    MXN: "MX$",
    ILS: "₪",
    THB: "฿",
    MYR: "RM",
    PHP: "₱",
    IDR: "Rp",
    ISK: "kr"
}

var ZERO_DECIMALS = { JPY: 1, KRW: 1, HUF: 1, ISK: 1, IDR: 1 }

var SYMBOL_TO_CODE = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "₩": "KRW",
    "₽": "RUB",
    "₺": "TRY",
    "₪": "ILS",
    "฿": "THB",
    "R$": "BRL"
}

function isCurrencyCode(s) {
    if (!s) return false
    var u = String(s).toUpperCase()
    for (var i = 0; i < ECB_CODES.length; i++) {
        if (ECB_CODES[i] === u) return true
    }
    return false
}

function codeFromSymbol(sym) {
    return SYMBOL_TO_CODE[sym] || null
}

function symbolFor(code) {
    return SYMBOLS[String(code).toUpperCase()] || (String(code).toUpperCase() + " ")
}

function decimalsFor(code) {
    return ZERO_DECIMALS[String(code).toUpperCase()] ? 0 : 2
}

function normalizeRates(obj) {
    if (!obj || typeof obj !== "object") return null
    var date = obj.date || obj.time || ""
    var base = (obj.base || "EUR").toUpperCase()
    var rates = obj.rates || obj.quotes || {}
    var out = { date: String(date), base: base, rates: {} }
    out.rates.EUR = 1
    for (var k in rates) {
        if (!rates.hasOwnProperty(k)) continue
        var n = Number(rates[k])
        if (isFinite(n) && n > 0) out.rates[k.toUpperCase()] = n
    }
    if (out.rates.EUR === undefined) out.rates.EUR = 1
    return out
}

function parseRatesJson(text) {
    try {
        return normalizeRates(JSON.parse(text))
    } catch (e) {
        return null
    }
}

function toEur(amount, code, rates) {
    var c = String(code).toUpperCase()
    if (c === "EUR") return amount
    var r = rates && rates.rates ? rates.rates[c] : null
    if (!r) return null
    return amount / r
}

function fromEur(amount, code, rates) {
    var c = String(code).toUpperCase()
    if (c === "EUR") return amount
    var r = rates && rates.rates ? rates.rates[c] : null
    if (!r) return null
    return amount * r
}

function convert(amount, fromCode, toCode, rates) {
    var eur = toEur(amount, fromCode, rates)
    if (eur === null) return null
    return fromEur(eur, toCode, rates)
}

function knownCodes() {
    return ECB_CODES.slice()
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        ECB_CODES: ECB_CODES,
        SYMBOLS: SYMBOLS,
        isCurrencyCode: isCurrencyCode,
        codeFromSymbol: codeFromSymbol,
        symbolFor: symbolFor,
        decimalsFor: decimalsFor,
        normalizeRates: normalizeRates,
        parseRatesJson: parseRatesJson,
        convert: convert,
        toEur: toEur,
        fromEur: fromEur,
        knownCodes: knownCodes
    }
}
