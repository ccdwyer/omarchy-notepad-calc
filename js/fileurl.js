// Convert Qt.resolvedUrl / file:// URLs to a filesystem path.
// Decodes percent-escapes so installs under paths with spaces work.

function fromResolved(u) {
    u = String(u || "")
    if (u.indexOf("file://") === 0)
        u = u.slice(7)
    if (u.length && u.charAt(0) !== "/") {
        var slash = u.indexOf("/")
        if (slash >= 0)
            u = u.slice(slash)
    }
    try {
        u = decodeURIComponent(u)
    } catch (e) {}
    if (u.length > 1 && u.charAt(u.length - 1) === "/")
        u = u.slice(0, u.length - 1)
    return u
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { fromResolved: fromResolved }
}
