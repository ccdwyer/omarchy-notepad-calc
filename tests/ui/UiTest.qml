// CI-only. Loads Panel.qml, synthetic edits, grabToImage on the chrome Item.
import QtQuick
import QtQuick.Window
import "../../js/fileurl.js" as FileUrl

Window {
  id: runner
  visible: true
  width: 8
  height: 8
  title: "notepad-calc-ui"
  color: "#00000000"

  property string pluginDir: FileUrl.fromResolved(Qt.resolvedUrl("../../"))
  property string outDir: ""
  property int failed: 0
  property int doneGrabs: 0
  property var queue: []
  property int qIndex: 0

  function argDir() {
    var args = Qt.application.arguments
    var i
    for (i = 0; i < args.length; i++) {
      var a = String(args[i])
      if (a.indexOf("/") === 0 && a.indexOf(".qml") < 0)
        return a
    }
    return ""
  }

  Loader {
    id: panelLoader
    source: Qt.resolvedUrl("../../Panel.qml")
    onLoaded: {
      item.testHarness = true
      item.testWidth = 980
      item.testHeight = 640
      item.pluginDir = runner.pluginDir
      item.defaultCurrency = "USD"
      item.reduceMotion = true
    }
  }

  function panel() { return panelLoader.item }

  function loadFile(rel) {
    var xhr = new XMLHttpRequest()
    xhr.open("GET", Qt.resolvedUrl(rel), false)
    xhr.send()
    return String(xhr.responseText || "")
  }

  function sheetLong() {
    var s = "monitor-cable-run-"
    var extra = ""
    var i
    for (i = 0; i < 12; i++) extra += s
    return "Omarchy battlestation\n\nthis is a deliberately very long line that must not wrap: " + extra + "end\nsubtotal = 2 × $429\n"
  }
  function sheetEmoji() {
    return "planning 🚀\ndesk = $349  DualSense 🎮\nnote: 日本語 mix ✨\nsum\n"
  }
  function sheetUrl() {
    return "see https://example.com/path?x=1&y=2\nhttps://omarchy.org/plugins/notepad-calc\n2 + 2\nversion 2 of the plan\n"
  }

  function grab(name, cb) {
    var p = panel()
    var target = p && p.grabTarget ? p.grabTarget() : null
    if (!target) {
      console.log("FAIL grabTarget missing for " + name)
      runner.failed += 1
      cb()
      return
    }
    if (typeof target.grabToImage !== "function") {
      console.log("FAIL grabTarget is not an Item (no grabToImage) for " + name)
      runner.failed += 1
      cb()
      return
    }
    target.grabToImage(function (result) {
      var dest = runner.outDir + "/" + name + ".png"
      if (!result || !result.saveToFile(dest)) {
        console.log("FAIL saveToFile " + dest)
        runner.failed += 1
      } else {
        console.log("CAPTURE " + dest + " " + result.image.width + "x" + result.image.height)
      }
      runner.doneGrabs += 1
      cb()
    })
  }

  function step() {
    if (runner.qIndex >= runner.queue.length) {
      console.log("UI_CAPTURES " + runner.doneGrabs)
      if (runner.failed || runner.doneGrabs < 12) {
        console.log("FAIL ui test failures=" + runner.failed + " grabs=" + runner.doneGrabs)
        Qt.exit(1)
      } else {
        console.log("ok  ui panel grabs 1x/1.25x/2x longline/emoji/url/demo")
        Qt.quit()
      }
      return
    }
    var job = runner.queue[runner.qIndex++]
    var p = panel()
    p.testWidth = Math.round(980 * job.scale)
    p.testHeight = Math.round(640 * job.scale)
    p.open("{}")
    p.setTestText(job.text)
    grabTimer.cb = function () {
      grab(job.name + "-" + job.tag + "x", step)
    }
    grabTimer.start()
  }

  Timer {
    id: grabTimer
    interval: 180
    repeat: false
    property var cb
    onTriggered: if (cb) cb()
  }

  Timer {
    id: startTimer
    interval: 300
    running: true
    onTriggered: {
      var p = panel()
      if (!p) {
        console.log("FAIL Panel.qml did not load")
        Qt.exit(1)
        return
      }
      runner.outDir = runner.argDir()
      if (!runner.outDir.length) {
        console.log("FAIL capture dir argument missing")
        Qt.exit(1)
        return
      }
      p.testHarness = true
      p.pluginDir = runner.pluginDir
      p.open("{}")
      var demo = loadFile("../../data/first-run.calc")
      if (demo.indexOf("monitors = 2") < 0) {
        console.log("FAIL demo sheet missing monitors line")
        Qt.exit(1)
        return
      }
      p.setTestText(demo.replace("monitors = 2 × $429", "monitors = 3 × $429"))
      console.log("ok  synthetic ripple edit applied")

      var sheets = [
        { name: "demo", text: demo },
        { name: "longline", text: sheetLong() },
        { name: "emoji", text: sheetEmoji() },
        { name: "url", text: sheetUrl() }
      ]
      var scales = [
        { scale: 1, tag: "1" },
        { scale: 1.25, tag: "1p25" },
        { scale: 2, tag: "2" }
      ]
      var q = []
      var a, b
      for (a = 0; a < sheets.length; a++) {
        for (b = 0; b < scales.length; b++)
          q.push({ name: sheets[a].name, text: sheets[a].text, scale: scales[b].scale, tag: scales[b].tag })
      }
      runner.queue = q
      runner.qIndex = 0
      step()
    }
  }
}
