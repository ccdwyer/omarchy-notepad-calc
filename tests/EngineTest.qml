// Dual-harness: the same corpus.json / corpus-data.js Node runs.
// Linux CI: qml6 EngineTest.qml  (package qt6-declarative)
// macOS: tests/run-qml.sh skips if no qml binary.

import QtQuick
import "../js/engine.js" as Engine
import "../js/format.js" as Format
import "../js/units.js" as Units
import "../js/tz.js" as Tz
import "../js/rates.js" as Rates
import "harness.js" as Harness
import "corpus-data.js" as Corpus

QtObject {
  Component.onCompleted: {
    var rates = {
      date: "2026-08-18",
      base: "EUR",
      rates: {
        USD: 1.1600, JPY: 170.25, BGN: 1.9558, CZK: 24.320, DKK: 7.4635,
        GBP: 0.8620, HUF: 395.40, PLN: 4.2680, RON: 5.0720, SEK: 11.045,
        CHF: 0.9340, ISK: 143.80, NOK: 11.620, TRY: 46.850, AUD: 1.7780,
        BRL: 6.3120, CAD: 1.5980, CNY: 8.3120, HKD: 9.0320, IDR: 18840,
        ILS: 3.9120, INR: 101.45, KRW: 1612.0, MXN: 21.680, MYR: 4.8920,
        NZD: 1.9560, PHP: 66.420, SGD: 1.4920, THB: 37.560, ZAR: 20.480,
        EUR: 1
      }
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
    var cases = Corpus.CASES
    if (!cases || cases.length < 200) {
      console.log("FAIL corpus too small: " + (cases ? cases.length : 0))
      Qt.exit(1)
    }
    var result = Harness.runCorpus(cases, Engine.evalSheet, ctx, function (line) {
      console.log(line)
    })
    console.log(result.passed + " passed, " + result.failed + " failed (" + result.total + " corpus cases)")
    if (result.failed)
      Qt.exit(1)
    else
      Qt.quit()
  }
}
