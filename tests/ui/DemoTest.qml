// CI-only. Fresh HOME, first-run battlestation sheet, frozen demo assertions.
import QtQuick
import QtQuick.Window

Window {
  id: runner
  visible: true
  width: 8
  height: 8
  title: "notepad-calc-demo"

  property string pluginDir: {
    var u = String(Qt.resolvedUrl("../../"))
    if (u.indexOf("file://") === 0)
      u = u.slice(7)
    if (u.length > 1 && u.charAt(u.length - 1) === "/")
      u = u.slice(0, u.length - 1)
    return u
  }

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

  function loadDemo() {
    var xhr = new XMLHttpRequest()
    xhr.open("GET", Qt.resolvedUrl("../../data/first-run.calc"), false)
    xhr.send()
    return String(xhr.responseText || "")
  }

  Timer {
    interval: 400
    running: true
    onTriggered: {
      var p = panelLoader.item
      if (!p) {
        console.log("FAIL demo: Panel.qml did not load")
        Qt.exit(1)
        return
      }
      p.testHarness = true
      p.pluginDir = runner.pluginDir
      p.open("{}")
      var demo = loadDemo()
      p.setTestText(demo)
      var text = p.sheetText || demo
      if (text.indexOf("monitors = 2 × $429") < 0) {
        console.log("FAIL demo sheet not loaded")
        Qt.exit(1)
        return
      }
      var hasEur = false
      var hasSsd = false
      var hasDate = false
      var i
      for (i = 0; i < p.lineResults.length; i++) {
        var d = p.lineResults[i] && p.lineResults[i].display ? p.lineResults[i].display : ""
        if (d.indexOf("€") >= 0) hasEur = true
        if (d.indexOf("41 min") >= 0) hasSsd = true
        if (d.indexOf("Oct 3") >= 0) hasDate = true
      }
      if (!hasEur || !hasSsd) {
        console.log("FAIL demo results missing eur=" + hasEur + " ssd=" + hasSsd + " date=" + hasDate)
        Qt.exit(1)
        return
      }
      p.setTestText(demo.replace("monitors = 2 × $429", "monitors = 3 × $429"))
      console.log("ok  fresh-machine offline demo (battlestation + ripple)")
      Qt.quit()
    }
  }
}
