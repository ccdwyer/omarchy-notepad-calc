function approx(a, b, eps) {
  return Math.abs(Number(a) - Number(b)) <= (eps == null ? 1e-6 : eps)
}

function lastOf(rs, line) {
  if (line != null && line !== undefined) return rs[line]
  return rs[rs.length - 1]
}

function checkCase(c, r) {
  if (!r) return "no result"
  var kinds = c.kinds || (c.kind ? [c.kind] : null)
  if (kinds && kinds.indexOf(r.kind) < 0)
    return "kind=" + r.kind + " expected " + kinds.join("|") + " display=" + r.display
  if (c.display != null && r.display !== c.display)
    return "display=" + JSON.stringify(r.display) + " expected " + JSON.stringify(c.display)
  if (c.approx != null && !approx(r.value, c.approx, c.eps || 1e-6))
    return "value=" + r.value + " expected ~" + c.approx
  if (c.currency && r.currency !== c.currency)
    return "currency=" + r.currency + " expected " + c.currency
  if (c.contains && String(r.display || "").indexOf(c.contains) < 0)
    return "display=" + JSON.stringify(r.display) + " missing " + JSON.stringify(c.contains)
  return null
}

function runCorpus(cases, evalSheet, ctx, log) {
  var passed = 0
  var failed = 0
  var failures = []
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i]
    var err = null
    try {
      var lines = String(c.sheet).split("\n")
      var rs = evalSheet(lines, ctx)
      err = checkCase(c, lastOf(rs, c.line))
    } catch (e) {
      err = String(e && e.message ? e.message : e)
    }
    var name = (c.id || i) + ": " + (c.name || "")
    if (err) {
      failed += 1
      failures.push(name + " — " + err)
      if (log) log("FAIL " + name + " — " + err)
    } else {
      passed += 1
      if (log) log("ok  " + name)
    }
  }
  return { passed: passed, failed: failed, failures: failures, total: cases.length }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { approx: approx, lastOf: lastOf, checkCase: checkCase, runCorpus: runCorpus }
}
