// CI-only. 500-line keystroke-replay soak against Panel.qml.
import QtQuick
import QtQuick.Window
import "../../js/fileurl.js" as FileUrl

Window {
  id: runner
  visible: true
  width: 8
  height: 8
  title: "notepad-calc-soak"

  property string pluginDir: FileUrl.fromResolved(Qt.resolvedUrl("../../"))
  property int soakMs: {
    var args = Qt.application.arguments
    var i
    for (i = 0; i < args.length; i++) {
      var a = String(args[i])
      if (/^[0-9]+$/.test(a) && Number(a) >= 1000)
        return Number(a)
    }
    return 3600000
  }
  property int lineCount: 500
  property int edits: 0
  property string heartbeat: ""

  Loader {
    id: panelLoader
    source: Qt.resolvedUrl("../../Panel.qml")
    onLoaded: {
      item.testHarness = true
      item.testWidth = 980
      item.testHeight = 640
      item.pluginDir = runner.pluginDir
      item.reduceMotion = true
    }
  }

  function buildSheet(n) {
    var lines = ["soak sheet", "base = 1"]
    var i
    for (i = 0; i < n; i++) {
      if (i % 17 === 0) lines.push("")
      else if (i % 23 === 0) lines.push("note line " + i + " stays prose")
      else lines.push("base + " + i)
    }
    lines.push("sum")
    return lines.join("\n")
  }

  Timer {
    id: start
    interval: 300
    running: true
    onTriggered: {
      var p = panelLoader.item
      if (!p) {
        console.log("FAIL soak: Panel.qml did not load")
        Qt.exit(1)
        return
      }
      p.testHarness = true
      p.pluginDir = runner.pluginDir
      p.open("{}")
      p.startDailyRates()
      p.startDailyRates()
      p.setTestText(buildSheet(runner.lineCount))
      var n = p.lineResults.length
      console.log("SOAK_START lines=" + n)
      console.log("SOAK_LINES " + n)
      if (n < 500) {
        console.log("FAIL soak sheet shorter than 500 lines: " + n)
        Qt.exit(1)
        return
      }
      editTimer.start()
      endTimer.start()
    }
  }

  Timer {
    id: editTimer
    interval: 50
    repeat: true
    running: false
    onTriggered: {
      var p = panelLoader.item
      if (!p) return
      var n = runner.edits % 40
      p.insertTestText(String(n))
      if (runner.edits % 2 === 1) {
        var t = p.sheetText || ""
        if (t.length)
          p.setTestText(t.substring(0, t.length - 1))
      }
      runner.edits += 1
      if (runner.edits % 20 === 0)
        console.log("SOAK_EDITS " + runner.edits)
    }
  }

  Timer {
    id: endTimer
    interval: runner.soakMs
    running: false
    onTriggered: {
      editTimer.stop()
      console.log("SOAK_DONE edits=" + runner.edits)
      console.log("ok  soak keystroke replay finished")
      Qt.quit()
    }
  }
}
