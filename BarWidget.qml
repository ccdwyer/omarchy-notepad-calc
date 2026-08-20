import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "js/engine.js" as Engine
import "js/format.js" as Format
import "js/units.js" as Units
import "js/tz.js" as Tz
import "js/rates.js" as Rates
import "js/fileurl.js" as FileUrl
import "js/Binds.js" as Binds

BarWidget {
  id: root
  moduleName: "io.github.chris.notepad-calc"

  property string defaultCurrency: "USD"
  property string omarchyPath: Quickshell.env("OMARCHY_PATH") || ""
  property var shell: bar && bar.shell ? bar.shell : null
  property var manifest: null
  property var pluginRegistry: null

  property string chipText: "Σ"
  property string totalDisplay: ""
  property bool panelOpen: false
  property string rateDate: ""
  property bool offerBinds: false
  property string offerNote: ""
  property var workQueue: []
  property var workCurrent: null
  readonly property var notepad: panelLoader.item
  readonly property string pluginId: "io.github.chris.notepad-calc"

  readonly property string pluginDir: FileUrl.fromResolved(Qt.resolvedUrl("."))

  readonly property bool reduceMotion: {
    try {
      if (Style && Style.reduceMotion)
        return true
    } catch (e) {}
    try {
      if (Quickshell.env("OMARCHY_REDUCED_MOTION") === "1")
        return true
    } catch (e2) {}
    return false
  }

  function open() {
    panelLoader.active = true
    if (panelLoader.item && panelLoader.item.open)
      panelLoader.item.open("{}")
    root.panelOpen = true
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close)
      panelLoader.item.close()
    root.panelOpen = false
  }

  // omarchy-shell io.github.chris.notepad-calc <method> <arg> dispatches here.
  function summon(arg) {
    root.open()
    return "ok"
  }

  function hide(arg) {
    root.close()
    return "ok"
  }

  function toggle(arg) {
    if (root.panelOpen)
      root.close()
    else
      root.open()
    return "ok"
  }

  function applyBindPlan(plan) {
    var p = plan || Binds.offer
    root.offerBinds = !!p.needed
    root.offerNote = String(p.note || "")
    Binds.setOffer(p)
  }

  function enqueueWork(command, done) {
    workQueue.push({ command: command, done: done || null })
    runWork()
  }

  function runWork() {
    if (workProc.running || root.workCurrent)
      return
    if (!workQueue.length)
      return
    root.workCurrent = workQueue.shift()
    workProc.command = root.workCurrent.command
    workProc.running = true
  }

  function scanBinds() {
    enqueueWork(["hyprctl", "-j", "binds"], function(text, code) {
      if (Number(code) !== 0)
        return
      var plan = Binds.applyScan(text)
      root.applyBindPlan(plan)
      if (plan.needed && plan.toAdd && plan.toAdd.length && Binds.claimAuto())
        root.installBinds("auto")
    })
  }

  function notifyNewBinds(plan) {
    var body = Binds.notifyBody(plan.toAdd, plan.skipped)
    if (!body)
      return
    Quickshell.execDetached(Binds.notifyArgv("Notepad Calc", "Notepad Calc keybindings", body))
  }

  function installBinds(arg) {
    enqueueWork(["hyprctl", "-j", "binds"], function(text, code) {
      if (Number(code) !== 0) {
        root.offerNote = "could not read keybinds"
        return
      }
      var plan = Binds.applyScan(text)
      if (!plan.toAdd || !plan.toAdd.length) {
        root.applyBindPlan(plan)
        return
      }
      var lua = Binds.luaBlock(plan.toAdd)
      enqueueWork(["python3", root.pluginDir + "/compat/install-binds.py", root.pluginId, lua], function(out, instCode) {
        if (Number(instCode) !== 0) {
          root.offerNote = "could not write ~/.config/hypr/bindings.lua"
          return
        }
        root.notifyNewBinds(plan)
        Qt.callLater(root.scanBinds)
      })
    })
    return "ok"
  }

  function evalCtx() {
    var rates = null
    if (panelLoader.item && panelLoader.item.ratesObj)
      rates = panelLoader.item.ratesObj
    return {
      units: Units,
      tz: Tz,
      rates: rates,
      ratesMod: Rates,
      now: new Date(),
      format: Format.formatQty,
      defaultCurrency: root.defaultCurrency || "USD"
    }
  }

  function setTotalFromResults(results) {
    var t = Engine.sheetTotal(results)
    if (!t || t.kind !== "result") {
      root.totalDisplay = ""
      root.chipText = "Σ"
      return
    }
    root.totalDisplay = t.display || ""
    root.chipText = root.totalDisplay.length ? ("Σ " + root.totalDisplay) : "Σ"
  }

  implicitWidth: row.implicitWidth
  implicitHeight: row.implicitHeight

  Row {
    id: row
    spacing: Style.space(4)

  WidgetButton {
    id: button
    bar: root.bar
    text: root.chipText
    tooltipText: root.totalDisplay.length
                 ? ("Notepad Calc — " + root.totalDisplay)
                 : "Notepad Calc"
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.LeftButton)
        root.toggle()
    }
  }
  }

  Process {
    id: workProc
    running: false
    stdout: StdioCollector {
      id: workOut
      waitForEnd: true
    }
    onExited: function(exitCode) {
      var text = workOut.text
      var job = root.workCurrent
      root.workCurrent = null
      if (job && job.done) {
        try {
          job.done(text, exitCode)
        } catch (e) {
          console.warn("notepad-calc: work callback failed", e)
        }
      }
      root.runWork()
    }
  }

  Timer {
    id: bindScanTimer
    interval: 3000
    repeat: true
    running: true
    onTriggered: root.scanBinds()
  }

  Loader {
    id: panelLoader
    active: true
    source: "Panel.qml"
    onLoaded: {
      if (!item)
        return
      item.pluginDir = root.pluginDir
      item.defaultCurrency = root.defaultCurrency
      item.reduceMotion = root.reduceMotion
      item.totalChanged.connect(function(display) {
        root.totalDisplay = display || ""
        root.chipText = root.totalDisplay.length ? ("Σ " + root.totalDisplay) : "Σ"
      })
      item.closed.connect(function() { root.panelOpen = false })
      item.opened.connect(function() { root.panelOpen = true })
      if (item.boot)
        item.boot()
      if (item.startDailyRates)
        item.startDailyRates()
    }
  }

  IpcHandler {
    target: "io.github.chris.notepad-calc"
    function toggle(arg: string): string { return root.toggle(arg) }
    function summon(arg: string): string { return root.summon(arg) }
    function hide(arg: string): string { return root.hide(arg) }
    function ping(arg: string): string { return "ok" }
    function installBinds(arg: string): string { return root.installBinds(arg) }
  }

  Component.onCompleted: Qt.callLater(root.scanBinds)
}
