.pragma library

// Detect live Hyprland binds and plan a bindings.lua snippet.
// Lua binds show up as dispatcher "__lua" with a description, not the
// omarchy-shell command in `arg`, so "ours" is plugin-id in arg OR our
// descriptions.

var PLUGIN_ID = "io.github.chris.notepad-calc"
var SUPER = 64
var SHIFT = 1
var CTRL = 4
var ALT = 8

var CANDIDATES = [
    {
        keys: "SUPER + N",
        modmask: SUPER,
        key: "N",
        desc: "Notepad Calc",
        cmd: "omarchy-shell io.github.chris.notepad-calc toggle '{}'",
        alternates: [
            { keys: "SUPER + ALT + SHIFT + N", modmask: SUPER + ALT + SHIFT, key: "N" }
        ]
    },
    {
        keys: "SUPER + ALT + N",
        modmask: SUPER + ALT,
        key: "N",
        desc: "Notepad Calc summon",
        cmd: "omarchy-shell io.github.chris.notepad-calc summon '{}'",
        alternates: []
    }
]

var offer = {
    needed: true,
    note: "",
    installed: [],
    toAdd: [],
    skipped: []
}

function setOffer(next) {
    offer = next || offer
}

function parseBinds(raw) {
    if (!raw)
        return []
    var data = raw
    if (typeof raw === "string") {
        try {
            data = JSON.parse(raw)
        } catch (e) {
            return []
        }
    }
    return data && data.length ? data : []
}

function keyOf(bind) {
    return String((bind && bind.key) || "").toUpperCase()
}

function keysMatch(a, b) {
    var x = String(a || "").toUpperCase()
    var y = String(b || "").toUpperCase()
    if (x === y)
        return true
    function isPeriod(k) { return k === "PERIOD" || k === "." }
    return isPeriod(x) && isPeriod(y)
}

function isOurs(bind) {
    if (!bind)
        return false
    var arg = String(bind.arg || "")
    var desc = String(bind.description || "")
    if (arg.indexOf(PLUGIN_ID) >= 0)
        return true
    for (var i = 0; i < CANDIDATES.length; i++) {
        if (desc === CANDIDATES[i].desc)
            return true
    }
    return false
}

function oursCount(binds) {
    var n = 0
    var list = binds || []
    for (var i = 0; i < list.length; i++) {
        if (isOurs(list[i]))
            n++
    }
    return n
}

function comboOwner(binds, modmask, key) {
    var want = String(key || "").toUpperCase()
    var list = binds || []
    for (var i = 0; i < list.length; i++) {
        var b = list[i]
        if (Number(b.modmask) !== Number(modmask))
            continue
        if (!keysMatch(keyOf(b), want))
            continue
        if (isOurs(b))
            return { ours: true, desc: String(b.description || "") }
        return { ours: false, desc: String(b.description || b.dispatcher || "already bound") }
    }
    return null
}

function pickCombo(binds, candidate) {
    var owner = comboOwner(binds, candidate.modmask, candidate.key)
    if (!owner)
        return { keys: candidate.keys, modmask: candidate.modmask, key: candidate.key, desc: candidate.desc, cmd: candidate.cmd, chosen: candidate.keys }
    if (owner.ours)
        return { already: true, keys: candidate.keys, desc: candidate.desc }
    var alts = candidate.alternates || []
    for (var i = 0; i < alts.length; i++) {
        var a = alts[i]
        if (!comboOwner(binds, a.modmask, a.key))
            return {
                keys: a.keys,
                modmask: a.modmask,
                key: a.key,
                desc: candidate.desc,
                cmd: candidate.cmd,
                chosen: a.keys,
                preferred: candidate.keys,
                conflict: owner.desc
            }
    }
    return { skipped: true, keys: candidate.keys, desc: candidate.desc, conflict: owner.desc }
}

function keysFromBind(bind) {
    var m = Number(bind && bind.modmask)
    var parts = []
    if (m & SUPER)
        parts.push("SUPER")
    if (m & CTRL)
        parts.push("CTRL")
    if (m & ALT)
        parts.push("ALT")
    if (m & SHIFT)
        parts.push("SHIFT")
    var k = keyOf(bind)
    if (k)
        parts.push(k)
    return parts.join(" + ")
}

function displayKeys(keys) {
    return String(keys || "")
        .replace(/SUPER/gi, "Super")
        .replace(/CTRL/gi, "Ctrl")
        .replace(/ALT/gi, "Alt")
        .replace(/SHIFT/gi, "Shift")
        .replace(/ \+ /g, "+")
}

function oursList(binds) {
    var list = []
    var seen = binds || []
    for (var i = 0; i < seen.length; i++) {
        if (!isOurs(seen[i]))
            continue
        list.push({
            keys: keysFromBind(seen[i]),
            desc: String(seen[i].description || ""),
            modmask: Number(seen[i].modmask),
            key: keyOf(seen[i])
        })
    }
    return list
}

function chipLabel(plan) {
    var installed = (plan && plan.installed) || []
    if (!installed.length)
        return "Set hotkey"
    for (var i = 0; i < installed.length; i++) {
        if (installed[i].desc === "Notepad Calc")
            return displayKeys(installed[i].keys)
    }
    return displayKeys(installed[0].keys)
}

function skippedSuffix(skipped) {
    var miss = skipped || []
    var extra = ""
    for (var s = 0; s < miss.length; s++)
        extra += " — skipped " + displayKeys(miss[s].keys) + " (" + (miss[s].conflict || "taken") + ")"
    return extra
}

function statusNote(plan) {
    var p = plan || {}
    var installed = p.installed || []
    if (installed.length) {
        var bits = []
        for (var i = 0; i < installed.length; i++) {
            var it = installed[i]
            bits.push(displayKeys(it.keys) + (it.desc ? " — " + it.desc : ""))
        }
        return bits.join(" · ") + " — click for Change / Remove"
    }
    if (p.toAdd && p.toAdd.length) {
        var suggest = p.toAdd.map(function(item) { return displayKeys(item.chosen || item.keys) })
        return "No hotkey. Suggested: " + suggest.join(", ") + skippedSuffix(p.skipped)
    }
    if (p.skipped && p.skipped.length)
        return "No free suggested hotkey" + skippedSuffix(p.skipped)
    return "No hotkey. Suggested: Super+N, Super+Alt+N"
}

function optionList(candidate) {
    var opts = [{ keys: candidate.keys, modmask: candidate.modmask, key: candidate.key }]
    var alts = candidate.alternates || []
    for (var i = 0; i < alts.length; i++)
        opts.push({ keys: alts[i].keys, modmask: alts[i].modmask, key: alts[i].key })
    return opts
}

function plan(binds) {
    var toAdd = []
    var skipped = []
    var already = 0
    for (var i = 0; i < CANDIDATES.length; i++) {
        var pick = pickCombo(binds, CANDIDATES[i])
        if (pick.already)
            already++
        else if (pick.skipped)
            skipped.push(pick)
        else
            toAdd.push(pick)
    }
    var liveOurs = oursCount(binds)
    if (liveOurs > 0)
        already = Math.max(already, liveOurs)
    var needed = already === 0
    if (!needed)
        toAdd = []
    var installed = oursList(binds)
    var result = { needed: needed, already: already, toAdd: toAdd, skipped: skipped, installed: installed, note: "" }
    result.note = statusNote(result)
    return result
}

function rotatePlan(binds) {
    var toAdd = []
    var skipped = []
    var changed = false
    for (var i = 0; i < CANDIDATES.length; i++) {
        var candidate = CANDIDATES[i]
        var opts = optionList(candidate)
        var currentIdx = -1
        for (var o = 0; o < opts.length; o++) {
            var owner = comboOwner(binds, opts[o].modmask, opts[o].key)
            if (owner && owner.ours)
                currentIdx = o
        }
        if (currentIdx < 0) {
            var pick = pickCombo(binds, candidate)
            if (pick.skipped)
                skipped.push(pick)
            else if (!pick.already)
                toAdd.push(pick)
            continue
        }
        var chosen = null
        for (var step = 1; step <= opts.length; step++) {
            var idx = (currentIdx + step) % opts.length
            var opt = opts[idx]
            var own = comboOwner(binds, opt.modmask, opt.key)
            if (own && !own.ours) {
                skipped.push({ skipped: true, keys: opt.keys, desc: candidate.desc, conflict: own.desc })
                continue
            }
            chosen = {
                keys: opt.keys,
                modmask: opt.modmask,
                key: opt.key,
                desc: candidate.desc,
                cmd: candidate.cmd,
                chosen: opt.keys
            }
            if (idx !== currentIdx)
                changed = true
            break
        }
        if (chosen)
            toAdd.push(chosen)
    }
    var note = changed
        ? ("Change to " + toAdd.map(function(p) { return displayKeys(p.chosen || p.keys) }).join(", ") + skippedSuffix(skipped))
        : (skipped.length ? "no free alternate" + skippedSuffix(skipped) : "no free alternate")
    return {
        needed: false,
        changed: changed,
        toAdd: toAdd,
        skipped: skipped,
        installed: oursList(binds),
        note: note
    }
}

function luaLine(item) {
    var keys = String(item.chosen || item.keys || "").replace(/"/g, "")
    var desc = String(item.desc || "").replace(/"/g, "")
    var cmd = String(item.cmd || "").replace(/"/g, '\\"')
    return "o.bind(\"" + keys + "\", \"" + desc + "\", \"" + cmd + "\")"
}

function luaBlock(items) {
    var lines = []
    var list = items || []
    for (var i = 0; i < list.length; i++)
        lines.push(luaLine(list[i]))
    return lines.join("\n")
}

function applyScan(raw) {
    var p = plan(parseBinds(raw))
    setOffer(p)
    return p
}

function notifyBody(items, skipped) {
    var lines = []
    var list = items || []
    for (var i = 0; i < list.length; i++) {
        var it = list[i]
        lines.push((it.chosen || it.keys) + " — " + it.desc)
    }
    var miss = skipped || []
    for (var s = 0; s < miss.length; s++)
        lines.push("skipped " + miss[s].keys + " (" + (miss[s].conflict || "taken") + ")")
    return lines.join("\n")
}

function notifyArgv(appName, headline, body) {
    return ["omarchy", "notification", "send", "--app-name", String(appName || PLUGIN_ID), "-g", "󰌌", String(headline || "Keybindings"), String(body || "")]
}
