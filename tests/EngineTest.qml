// Dual-harness: same engine.js as Node, under Qt's JS engine.
// Run when qmljs/qmlscene is available:
//   qmljs tests/EngineTest.qml
// This machine (macOS, no Qt Quick tooling) cannot execute it.

import QtQuick
import "../js/engine.js" as Engine
import "../js/format.js" as Format
import "../js/units.js" as Units
import "../js/tz.js" as Tz
import "../js/rates.js" as Rates

QtObject {
  Component.onCompleted: {
    var rates = {
      date: "2026-08-18",
      base: "EUR",
      rates: { USD: 1.16, GBP: 0.862, JPY: 170.25, EUR: 1 }
    }
    var ctx = {
      units: Units,
      tz: Tz,
      rates: rates,
      ratesMod: Rates,
      now: new Date(Date.UTC(2026, 7, 19, 12, 0, 0)),
      nowDate: { y: 2026, m: 8, d: 19 },
      format: Format.formatQty
    }
    var failed = 0
    function check(name, ok) {
      if (ok)
        console.log("ok  " + name)
      else {
        console.log("FAIL " + name)
        failed += 1
      }
    }
    var r = Engine.evalSheet(["$120/mo × 14 months in EUR"], ctx)[0]
    check("riskiest line is EUR", r && r.currency === "EUR")
    check("riskiest line ~1448", r && Math.abs(r.value - 1680 / 1.16) < 0.05)
    var d = Engine.evalSheet(["10 GB / 4 MB/s"], ctx)[0]
    check("10 GB / 4 MB/s is 2500s", d && Math.abs(d.value - 2500) < 1e-6)
    var z = Engine.evalSheet(["3pm in Los Angeles → Tokyo time"], ctx)[0]
    check("LA → Tokyo 7am", z && z.local && z.local.hh === 7)
    var p = Engine.evalSheet(["version 2 of the plan"], ctx)[0]
    check("prose stays prose", p && p.kind === "prose")
    var t = Engine.evalSheet(["budget = flights + hotl"], ctx)[0]
    check("typo warns", t && t.kind === "unresolved")
    if (failed)
      console.log(failed + " failed")
    else
      console.log("qml harness ok")
    Qt.quit()
  }
}
