// CI-only acceptance: load the INSTALLED BarWidget.qml from PLUGIN_DIR ($DEST).
import QtQuick
import QtQuick.Window

Window {
  id: runner
  visible: true
  width: 8
  height: 8
  title: "notepad-calc-demo"

  property string pluginDir: ""
  property int tries: 0

  function argPluginDir() {
    var args = Qt.application.arguments
    var i
    for (i = args.length - 1; i >= 0; i--) {
      var a = String(args[i])
      if (a.indexOf("/") === 0 && a.indexOf(".qml") < 0)
        return a
    }
    return ""
  }

  Loader {
    id: barLoader
  }

  Timer {
    id: start
    interval: 100
    running: true
    onTriggered: {
      runner.pluginDir = runner.argPluginDir()
      if (!runner.pluginDir.length) {
        console.log("FAIL PLUGIN_DIR argument missing")
        Qt.exit(1)
        return
      }
      barLoader.source = "file://" + runner.pluginDir + "/BarWidget.qml"
    }
  }

  Timer {
    id: poll
    interval: 250
    running: true
    repeat: true
    onTriggered: {
      var bar = barLoader.item
      if (!bar) {
        runner.tries += 1
        if (runner.tries > 20) {
          console.log("FAIL installed BarWidget.qml did not load from " + runner.pluginDir)
          Qt.exit(1)
        }
        return
      }
      bar.defaultCurrency = "USD"
      if (bar.notepad) {
        bar.notepad.testHarness = true
        bar.notepad.testWidth = 980
        bar.notepad.testHeight = 640
      }
      if (typeof bar.open === "function")
        bar.open()
      var p = bar.notepad
      if (!p) {
        runner.tries += 1
        if (runner.tries > 24) {
          console.log("FAIL nested Panel did not instantiate")
          Qt.exit(1)
        }
        return
      }
      var text = p.sheetText || ""
      if (text.indexOf("monitors = 2") < 0) {
        runner.tries += 1
        if (runner.tries > 24) {
          console.log("FAIL installed plugin did not seed battlestation sheet (got " + text.length + " chars)")
          Qt.exit(1)
        }
        return
      }
      poll.stop()
      var hasEur = false
      var hasSsd = false
      var i
      for (i = 0; i < p.lineResults.length; i++) {
        var d = p.lineResults[i] && p.lineResults[i].display ? p.lineResults[i].display : ""
        if (d.indexOf("€") >= 0) hasEur = true
        if (d.indexOf("41 min") >= 0) hasSsd = true
      }
      if (!hasEur || !hasSsd) {
        console.log("FAIL demo results missing eur=" + hasEur + " ssd=" + hasSsd)
        Qt.exit(1)
        return
      }
      console.log("ok  fresh-machine offline demo (installed BarWidget + battlestation)")
      Qt.quit()
    }
  }
}
