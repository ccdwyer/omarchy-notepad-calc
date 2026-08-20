// Unit table: UCUM-ish subset (~120) with dimension vectors.
// No Qt, no Intl. Loadable from QML (`import "units.js" as Units`) and Node.

var DIM_KEYS = ["L", "M", "T", "data", "money", "temp", "A"]

function emptyDim() {
    return { L: 0, M: 0, T: 0, data: 0, money: 0, temp: 0, A: 0 }
}

function dimClone(d) {
    return { L: d.L || 0, M: d.M || 0, T: d.T || 0, data: d.data || 0, money: d.money || 0, temp: d.temp || 0, A: d.A || 0 }
}

function dimAdd(a, b, sign) {
    var s = sign === undefined ? 1 : sign
    return {
        L: (a.L || 0) + s * (b.L || 0),
        M: (a.M || 0) + s * (b.M || 0),
        T: (a.T || 0) + s * (b.T || 0),
        data: (a.data || 0) + s * (b.data || 0),
        money: (a.money || 0) + s * (b.money || 0),
        temp: (a.temp || 0) + s * (b.temp || 0),
        A: (a.A || 0) + s * (b.A || 0)
    }
}

function dimMul(a, b) { return dimAdd(a, b, 1) }
function dimDiv(a, b) { return dimAdd(a, b, -1) }

function dimEq(a, b) {
    if (!a || !b) return false
    for (var i = 0; i < DIM_KEYS.length; i++) {
        var k = DIM_KEYS[i]
        if ((a[k] || 0) !== (b[k] || 0)) return false
    }
    return true
}

function dimIsZero(d) {
    if (!d) return true
    for (var i = 0; i < DIM_KEYS.length; i++) {
        if ((d[DIM_KEYS[i]] || 0) !== 0) return false
    }
    return true
}

function dimIsDuration(d) {
    return d && (d.T || 0) === 1 && (d.L || 0) === 0 && (d.M || 0) === 0 &&
        (d.data || 0) === 0 && (d.money || 0) === 0 && (d.temp || 0) === 0 && (d.A || 0) === 0
}

function dimIsLength(d) {
    return d && (d.L || 0) === 1 && dimEq(d, { L: 1, M: 0, T: 0, data: 0, money: 0, temp: 0, A: 0 })
}

function dimIsData(d) {
    return d && (d.data || 0) === 1 && (d.L || 0) === 0 && (d.M || 0) === 0 &&
        (d.T || 0) === 0 && (d.money || 0) === 0 && (d.temp || 0) === 0 && (d.A || 0) === 0
}

function dimIsMoney(d) {
    return d && (d.money || 0) === 1 && (d.L || 0) === 0 && (d.M || 0) === 0 &&
        (d.T || 0) === 0 && (d.data || 0) === 0 && (d.temp || 0) === 0 && (d.A || 0) === 0
}

function dimIsTemp(d) {
    return d && (d.temp || 0) === 1 && (d.L || 0) === 0 && (d.M || 0) === 0 &&
        (d.T || 0) === 0 && (d.data || 0) === 0 && (d.money || 0) === 0 && (d.A || 0) === 0
}

function D(spec) {
    var d = emptyDim()
    for (var k in spec) {
        if (spec.hasOwnProperty(k)) d[k] = spec[k]
    }
    return d
}

// Canonical SI-ish factors. Time in seconds, length in metres, mass in grams,
// data in bytes, money dimensionless-tagged (currency on the qty), temp in Kelvin.
function U(id, dim, factor, aliases, display, calendar) {
    return {
        id: id,
        dim: dim,
        factor: factor,
        aliases: aliases,
        display: display || id,
        calendar: calendar || null
    }
}

var UNITS = [
    // length
    U("m", D({ L: 1 }), 1, ["m", "meter", "meters", "metre", "metres"], "m"),
    U("km", D({ L: 1 }), 1000, ["km", "kilometer", "kilometers", "kilometre", "kilometres"], "km"),
    U("cm", D({ L: 1 }), 0.01, ["cm", "centimeter", "centimeters", "centimetre", "centimetres"], "cm"),
    U("mm", D({ L: 1 }), 0.001, ["mm", "millimeter", "millimeters", "millimetre", "millimetres"], "mm"),
    U("um", D({ L: 1 }), 1e-6, ["um", "µm", "micron", "microns", "micrometer", "micrometers"], "µm"),
    U("nm", D({ L: 1 }), 1e-9, ["nm", "nanometer", "nanometers"], "nm"),
    U("in", D({ L: 1 }), 0.0254, ["in", "inch", "inches", "\""], "in"),
    U("ft", D({ L: 1 }), 0.3048, ["ft", "foot", "feet"], "ft"),
    U("yd", D({ L: 1 }), 0.9144, ["yd", "yard", "yards"], "yd"),
    U("mi", D({ L: 1 }), 1609.344, ["mi", "mile", "miles"], "mi"),
    U("nmi", D({ L: 1 }), 1852, ["nmi", "nautical mile", "nautical miles"], "nmi"),
    U("mil", D({ L: 1 }), 2.54e-5, ["mil", "mils", "thou"], "mil"),
    U("au", D({ L: 1 }), 149597870700, ["au", "astronomical unit", "astronomical units"], "au"),
    U("fathom", D({ L: 1 }), 1.8288, ["fathom", "fathoms"], "fathom"),
    U("furlong", D({ L: 1 }), 201.168, ["furlong", "furlongs"], "furlong"),
    U("pm", D({ L: 1 }), 1e-12, ["pm", "picometer", "picometers"], "pm"),
    U("angstrom", D({ L: 1 }), 1e-10, ["angstrom", "angstroms", "Å"], "Å"),
    U("pc", D({ L: 1 }), 3.085677581e16, ["pc", "parsec", "parsecs"], "pc"),
    U("ly", D({ L: 1 }), 9.4607304725808e15, ["ly", "lightyear", "lightyears", "light year", "light years"], "ly"),
    U("chain", D({ L: 1 }), 20.1168, ["chain", "chains"], "chain"),
    U("rod", D({ L: 1 }), 5.0292, ["rod", "rods", "perch", "pole"], "rod"),

    // mass (canonical grams)
    U("g", D({ M: 1 }), 1, ["g", "gram", "grams", "gramme", "grammes"], "g"),
    U("kg", D({ M: 1 }), 1000, ["kg", "kilogram", "kilograms", "kilo", "kilos"], "kg"),
    U("mg", D({ M: 1 }), 0.001, ["mg", "milligram", "milligrams"], "mg"),
    U("ug", D({ M: 1 }), 1e-6, ["ug", "µg", "microgram", "micrograms"], "µg"),
    U("t", D({ M: 1 }), 1e6, ["t", "tonne", "tonnes", "metric ton", "metric tons"], "t"),
    U("lb", D({ M: 1 }), 453.59237, ["lb", "lbs", "pound", "pounds"], "lb"),
    U("oz", D({ M: 1 }), 28.349523125, ["oz", "ounce", "ounces"], "oz"),
    U("st", D({ M: 1 }), 6350.29318, ["st", "stone", "stones"], "st"),
    U("ton", D({ M: 1 }), 907184.74, ["ton", "tons", "short ton", "short tons"], "ton"),
    U("grain", D({ M: 1 }), 0.06479891, ["grain", "grains", "gr"], "grain"),
    U("ct", D({ M: 1 }), 0.2, ["ct", "carat", "carats"], "ct"),
    U("slug", D({ M: 1 }), 14593.903, ["slug", "slugs"], "slug"),
    U("lt", D({ M: 1 }), 1016046.9088, ["long ton", "long tons", "imperial ton"], "lt"),
    U("dwt", D({ M: 1 }), 1.55517384, ["dwt", "pennyweight", "pennyweights"], "dwt"),

    // time (canonical seconds). calendar units also tagged for date arithmetic.
    U("s", D({ T: 1 }), 1, ["s", "sec", "secs", "second", "seconds"], "s"),
    U("ms", D({ T: 1 }), 0.001, ["ms", "millisecond", "milliseconds"], "ms"),
    U("us", D({ T: 1 }), 1e-6, ["us", "µs", "microsecond", "microseconds"], "µs"),
    U("ns", D({ T: 1 }), 1e-9, ["ns", "nanosecond", "nanoseconds"], "ns"),
    U("min", D({ T: 1 }), 60, ["min", "mins", "minute", "minutes"], "min"),
    U("h", D({ T: 1 }), 3600, ["h", "hr", "hrs", "hour", "hours"], "h"),
    U("d", D({ T: 1 }), 86400, ["d", "day", "days"], "d", "day"),
    U("w", D({ T: 1 }), 604800, ["w", "wk", "week", "weeks"], "w", "week"),
    U("mo", D({ T: 1 }), 2629746, ["mo", "month", "months"], "mo", "month"),
    U("yr", D({ T: 1 }), 31556952, ["yr", "y", "year", "years"], "yr", "year"),
    U("fortnight", D({ T: 1 }), 1209600, ["fortnight", "fortnights"], "fortnight"),
    U("decade", D({ T: 1 }), 315569520, ["decade", "decades"], "decade", "year"),
    U("century", D({ T: 1 }), 3155695200, ["century", "centuries"], "century", "year"),
    U("ps", D({ T: 1 }), 1e-12, ["ps", "picosecond", "picoseconds"], "ps"),
    U("millennium", D({ T: 1 }), 31556952000, ["millennium", "millennia"], "millennium", "year"),

    // data (canonical bytes, SI for KB/MB/GB, IEC for KiB/MiB)
    U("B", D({ data: 1 }), 1, ["B", "byte", "bytes"], "B"),
    U("bit", D({ data: 1 }), 0.125, ["bit", "bits"], "bit"),
    U("KB", D({ data: 1 }), 1e3, ["KB", "kB", "kilobyte", "kilobytes"], "KB"),
    U("MB", D({ data: 1 }), 1e6, ["MB", "megabyte", "megabytes"], "MB"),
    U("GB", D({ data: 1 }), 1e9, ["GB", "gigabyte", "gigabytes"], "GB"),
    U("TB", D({ data: 1 }), 1e12, ["TB", "terabyte", "terabytes"], "TB"),
    U("PB", D({ data: 1 }), 1e15, ["PB", "petabyte", "petabytes"], "PB"),
    U("KiB", D({ data: 1 }), 1024, ["KiB", "kibibyte", "kibibytes"], "KiB"),
    U("MiB", D({ data: 1 }), 1048576, ["MiB", "mebibyte", "mebibytes"], "MiB"),
    U("GiB", D({ data: 1 }), 1073741824, ["GiB", "gibibyte", "gibibytes"], "GiB"),
    U("TiB", D({ data: 1 }), 1099511627776, ["TiB", "tebibyte", "tebibytes"], "TiB"),
    U("kbit", D({ data: 1 }), 125, ["kbit", "kb", "kilobit", "kilobits"], "kbit"),
    U("Mbit", D({ data: 1 }), 125000, ["Mbit", "Mb", "megabit", "megabits"], "Mbit"),
    U("Gbit", D({ data: 1 }), 1.25e8, ["Gbit", "Gb", "gigabit", "gigabits"], "Gbit"),
    U("Tbit", D({ data: 1 }), 1.25e11, ["Tbit", "Tb", "terabit", "terabits"], "Tbit"),
    U("EB", D({ data: 1 }), 1e18, ["EB", "exabyte", "exabytes"], "EB"),
    U("PiB", D({ data: 1 }), 1125899906842624, ["PiB", "pebibyte", "pebibytes"], "PiB"),

    // area
    U("m2", D({ L: 2 }), 1, ["m2", "m²", "sqm", "square meter", "square meters", "square metre", "square metres"], "m²"),
    U("cm2", D({ L: 2 }), 1e-4, ["cm2", "cm²", "square centimeter", "square centimeters"], "cm²"),
    U("mm2", D({ L: 2 }), 1e-6, ["mm2", "mm²", "square millimeter", "square millimeters"], "mm²"),
    U("km2", D({ L: 2 }), 1e6, ["km2", "km²", "square kilometer", "square kilometers"], "km²"),
    U("ha", D({ L: 2 }), 10000, ["ha", "hectare", "hectares"], "ha"),
    U("acre", D({ L: 2 }), 4046.8564224, ["acre", "acres", "ac"], "acre"),
    U("in2", D({ L: 2 }), 0.00064516, ["in2", "in²", "sqin", "square inch", "square inches"], "in²"),
    U("ft2", D({ L: 2 }), 0.09290304, ["ft2", "ft²", "sqft", "square foot", "square feet"], "ft²"),
    U("yd2", D({ L: 2 }), 0.83612736, ["yd2", "yd²", "sqyd", "square yard", "square yards"], "yd²"),
    U("mi2", D({ L: 2 }), 2589988.110336, ["mi2", "mi²", "sqmi", "square mile", "square miles"], "mi²"),
    U("are", D({ L: 2 }), 100, ["are", "ares"], "are"),
    U("barn", D({ L: 2 }), 1e-28, ["barn", "barns", "b"], "barn"),

    // volume
    U("m3", D({ L: 3 }), 1, ["m3", "m³", "cubic meter", "cubic meters", "cubic metre", "cubic metres"], "m³"),
    U("L", D({ L: 3 }), 0.001, ["L", "l", "liter", "liters", "litre", "litres"], "L"),
    U("mL", D({ L: 3 }), 1e-6, ["mL", "ml", "milliliter", "milliliters", "millilitre", "millilitres"], "mL"),
    U("cm3", D({ L: 3 }), 1e-6, ["cm3", "cm³", "cc", "cubic centimeter", "cubic centimeters"], "cm³"),
    U("mm3", D({ L: 3 }), 1e-9, ["mm3", "mm³", "cubic millimeter", "cubic millimeters"], "mm³"),
    U("gal", D({ L: 3 }), 0.003785411784, ["gal", "gallon", "gallons"], "gal"),
    U("qt", D({ L: 3 }), 0.000946352946, ["qt", "quart", "quarts"], "qt"),
    U("pt", D({ L: 3 }), 0.000473176473, ["pt", "pint", "pints"], "pt"),
    U("cup", D({ L: 3 }), 0.0002365882365, ["cup", "cups"], "cup"),
    U("floz", D({ L: 3 }), 2.95735295625e-5, ["floz", "fl oz", "fluid ounce", "fluid ounces"], "fl oz"),
    U("tbsp", D({ L: 3 }), 1.478676478125e-5, ["tbsp", "tablespoon", "tablespoons"], "tbsp"),
    U("tsp", D({ L: 3 }), 4.92892159375e-6, ["tsp", "teaspoon", "teaspoons"], "tsp"),
    U("in3", D({ L: 3 }), 1.6387064e-5, ["in3", "in³", "cubic inch", "cubic inches"], "in³"),
    U("ft3", D({ L: 3 }), 0.028316846592, ["ft3", "ft³", "cubic foot", "cubic feet"], "ft³"),
    U("bbl", D({ L: 3 }), 0.158987294928, ["bbl", "barrel", "barrels"], "bbl"),
    U("bushel", D({ L: 3 }), 0.03523907016688, ["bushel", "bushels", "bu"], "bu"),
    U("kL", D({ L: 3 }), 1, ["kL", "kl", "kiloliter", "kiloliters"], "kL"),
    U("yd3", D({ L: 3 }), 0.764554857984, ["yd3", "yd³", "cubic yard", "cubic yards"], "yd³"),
    U("igal", D({ L: 3 }), 0.00454609, ["igal", "imperial gallon", "imperial gallons"], "igal"),

    // speed
    U("m/s", D({ L: 1, T: -1 }), 1, ["m/s", "mps", "meter/s", "meters/s", "metres per second"], "m/s"),
    U("km/h", D({ L: 1, T: -1 }), 1000 / 3600, ["km/h", "kph", "kmh", "kilometer/h", "kilometers per hour"], "km/h"),
    U("mph", D({ L: 1, T: -1 }), 1609.344 / 3600, ["mph", "mi/h", "mile/h", "miles per hour"], "mph"),
    U("kn", D({ L: 1, T: -1 }), 1852 / 3600, ["kn", "kt", "knot", "knots"], "kn"),
    U("ft/s", D({ L: 1, T: -1 }), 0.3048, ["ft/s", "fps", "feet per second", "foot/s"], "ft/s"),
    U("km/s", D({ L: 1, T: -1 }), 1000, ["km/s"], "km/s"),
    U("mm/s", D({ L: 1, T: -1 }), 0.001, ["mm/s"], "mm/s"),
    U("mach", D({ L: 1, T: -1 }), 340.29, ["mach", "Mach"], "mach"),

    // temperature (canonical Kelvin; affine conversions live in engine)
    U("K", D({ temp: 1 }), 1, ["K", "kelvin", "kelvins"], "K"),
    U("C", D({ temp: 1 }), 1, ["C", "°C", "celsius", "centigrade"], "°C"),
    U("F", D({ temp: 1 }), 1, ["F", "°F", "fahrenheit"], "°F"),
    U("R", D({ temp: 1 }), 1, ["R", "°R", "rankine"], "°R"),

    // data rates
    U("B/s", D({ data: 1, T: -1 }), 1, ["B/s", "Bps", "bytes/s", "bytes per second"], "B/s"),
    U("KB/s", D({ data: 1, T: -1 }), 1e3, ["KB/s", "kB/s", "KBps"], "KB/s"),
    U("MB/s", D({ data: 1, T: -1 }), 1e6, ["MB/s", "MBps", "megabyte/s", "megabytes per second"], "MB/s"),
    U("GB/s", D({ data: 1, T: -1 }), 1e9, ["GB/s", "GBps", "gigabyte/s"], "GB/s"),
    U("KiB/s", D({ data: 1, T: -1 }), 1024, ["KiB/s"], "KiB/s"),
    U("MiB/s", D({ data: 1, T: -1 }), 1048576, ["MiB/s"], "MiB/s"),
    U("bit/s", D({ data: 1, T: -1 }), 0.125, ["bit/s", "bps"], "bit/s"),
    U("Mbps", D({ data: 1, T: -1 }), 125000, ["Mbps", "mbps", "Mbit/s"], "Mbps"),
    U("kbps", D({ data: 1, T: -1 }), 125, ["kbps", "kbit/s"], "kbps"),
    U("Gbps", D({ data: 1, T: -1 }), 1.25e8, ["Gbps", "Gbit/s"], "Gbps"),
    U("TB/s", D({ data: 1, T: -1 }), 1e12, ["TB/s", "TBps"], "TB/s"),
    U("GiB/s", D({ data: 1, T: -1 }), 1073741824, ["GiB/s"], "GiB/s"),

    // angle (dimensionless-ish, tagged A so we don't mix with true dimensionless)
    U("deg", D({ A: 1 }), 1, ["deg", "degree", "degrees", "°"], "°"),
    U("rad", D({ A: 1 }), 180 / Math.PI, ["rad", "radian", "radians"], "rad"),
    U("turn", D({ A: 1 }), 360, ["turn", "turns", "rev", "revolution", "revolutions"], "turn"),
    U("grad", D({ A: 1 }), 0.9, ["grad", "grads", "gon", "gons"], "grad"),
    U("arcmin", D({ A: 1 }), 1 / 60, ["arcmin", "arcminute", "arcminutes"], "′"),
    U("arcsec", D({ A: 1 }), 1 / 3600, ["arcsec", "arcsecond", "arcseconds"], "″"),
    U("Hz", D({ T: -1 }), 1, ["Hz", "hertz"], "Hz"),
    U("rpm", D({ T: -1 }), 1 / 60, ["rpm", "RPM"], "rpm")
]

var LOOKUP_EXACT = null
var LOOKUP_LOWER = null
var ALIASES_SORTED = null

function buildLookup() {
    LOOKUP_EXACT = {}
    LOOKUP_LOWER = {}
    ALIASES_SORTED = []
    for (var i = 0; i < UNITS.length; i++) {
        var u = UNITS[i]
        for (var j = 0; j < u.aliases.length; j++) {
            var a = u.aliases[j]
            LOOKUP_EXACT[a] = u
            var low = a.toLowerCase()
            if (!LOOKUP_LOWER[low]) LOOKUP_LOWER[low] = u
            ALIASES_SORTED.push(a)
        }
    }
    ALIASES_SORTED.sort(function (a, b) { return b.length - a.length })
}

function lookup(name) {
    if (!LOOKUP_EXACT) buildLookup()
    if (!name) return null
    var s = String(name)
    if (LOOKUP_EXACT[s]) return LOOKUP_EXACT[s]
    return LOOKUP_LOWER[s.toLowerCase()] || null
}

function aliasesSorted() {
    if (!ALIASES_SORTED) buildLookup()
    return ALIASES_SORTED
}

function allUnits() {
    return UNITS
}

function isUnitWord(name) {
    return !!lookup(name)
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        DIM_KEYS: DIM_KEYS,
        emptyDim: emptyDim,
        dimClone: dimClone,
        dimAdd: dimAdd,
        dimMul: dimMul,
        dimDiv: dimDiv,
        dimEq: dimEq,
        dimIsZero: dimIsZero,
        dimIsDuration: dimIsDuration,
        dimIsLength: dimIsLength,
        dimIsData: dimIsData,
        dimIsMoney: dimIsMoney,
        dimIsTemp: dimIsTemp,
        lookup: lookup,
        aliasesSorted: aliasesSorted,
        allUnits: allUnits,
        isUnitWord: isUnitWord,
        UNITS: UNITS
    }
}
