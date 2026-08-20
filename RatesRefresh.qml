import QtQuick
import Quickshell
import Quickshell.Io

// Daily single-flight ECB refresh. Network is an enhancement: the bundled
// snapshot in data/rates.json always works. Prefer the helper binary, then
// compat/rates-refresh.sh, then skip. Never blocks UI; 5s curl timeout.

Item {
  id: root
  width: 0
  height: 0

  property string pluginDir: ""
  property string dataDir: ""
  property string ratesPath: dataDir + "/rates.json"
  property string statePath: dataDir + "/state.json"
  property string ratesDate: ""
  property var rates: null
  property string lastError: ""
  property bool inFlight: false

  function helperBin() { return pluginDir + "/bin/notepad-calc-rates" }
  function helperSh() { return pluginDir + "/compat/rates-refresh.sh" }

  function todayStamp() {
    var d = new Date()
    var m = d.getMonth() + 1
    var day = d.getDate()
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day
  }

  function applyJson(text, fallbackDate) {
    try {
      var obj = JSON.parse(String(text || ""))
      if (obj && obj.rates) {
        root.rates = obj
        root.ratesDate = obj.date || fallbackDate || ""
        return true
      }
    } catch (e) {}
    return false
  }

  function maybeRefresh() {
    if (root.inFlight) return
    var st = stateFile.text()
    var last = ""
    try {
      var s = JSON.parse(st || "{}")
      last = s.lastRatesFetch || ""
    } catch (e2) {}
    if (last === root.todayStamp()) return
    root.inFlight = true
    whichProc.running = true
  }

  function recordFetch() {
    var obj = { lastRatesFetch: root.todayStamp() }
    try {
      var prev = JSON.parse(stateFile.text() || "{}")
      for (var k in prev) {
        if (prev.hasOwnProperty(k) && k !== "lastRatesFetch")
          obj[k] = prev[k]
      }
    } catch (e) {}
    stateFile.setText(JSON.stringify(obj, null, 2) + "\n")
  }

  Process {
    id: whichProc
    running: false
    command: ["sh", "-c", "if [ -x \"$1\" ]; then echo binary; elif [ -x \"$2\" ]; then echo shell; else echo missing; fi", "sh", root.helperBin(), root.helperSh()]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var kind = String(text || "").trim()
        var cmd = []
        if (kind === "binary")
          cmd = [root.helperBin(), "fetch", "--out", root.ratesPath, "--timeout", "5"]
        else if (kind === "shell")
          cmd = [root.helperSh(), "fetch", "--out", root.ratesPath, "--timeout", "5"]
        else {
          root.inFlight = false
          return
        }
        fetchProc.command = cmd
        fetchProc.running = true
      }
    }
  }

  Process {
    id: fetchProc
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var line = String(text || "").trim()
        if (line.indexOf("ok ") === 0)
          root.recordFetch()
      }
    }
    onExited: {
      root.inFlight = false
      if (exitCode !== 0)
        root.lastError = "refresh failed"
      userRates.reload()
    }
  }

  FileView {
    id: userRates
    path: root.ratesPath
    printErrors: false
    watchChanges: true
    onLoaded: root.applyJson(text(), root.ratesDate)
  }

  FileView {
    id: stateFile
    path: root.statePath
    printErrors: false
    atomicWrites: true
  }
}
