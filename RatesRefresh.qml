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

  function readState() {
    try {
      return JSON.parse(stateFile.text() || "{}")
    } catch (e) {
      return {}
    }
  }

  function writeState(obj) {
    stateFile.setText(JSON.stringify(obj, null, 2) + "\n")
  }

  function appendJournal(line) {
    journalProc.command = [
      "sh", "-c",
      "mkdir -p \"$1\"; echo \"$2\" >> \"$1/refresh.journal\"",
      "sh", root.dataDir, line
    ]
    journalProc.running = true
  }

  function maybeRefresh() {
    if (root.inFlight) return
    var today = root.todayStamp()
    var st = root.readState()
    var lastAttempt = st.lastRatesAttempt || st.lastRatesFetch || ""
    if (lastAttempt === today) return
    st.lastRatesAttempt = today
    root.writeState(st)
    root.appendJournal("attempt " + today + " " + new Date().toISOString())
    console.log("RATES_ATTEMPT " + today)
    root.inFlight = true
    whichProc.running = true
  }

  function recordSuccess() {
    var st = root.readState()
    st.lastRatesAttempt = root.todayStamp()
    st.lastRatesFetch = root.todayStamp()
    root.writeState(st)
    root.appendJournal("success " + root.todayStamp())
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
          root.recordSuccess()
      }
    }
    onExited: {
      root.inFlight = false
      if (exitCode !== 0)
        root.lastError = "refresh failed"
      userRates.reload()
    }
  }

  Process {
    id: journalProc
    running: false
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
