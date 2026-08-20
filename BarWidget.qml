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
  property bool bindInstalled: false
  property bool bindMenuOpen: false
  property string offerNote: "No hotkey. Suggested: Super+N, Super+Alt+N"
  property string bindLabel: "Set hotkey"
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
    root.bindInstalled = !!(p.installed && p.installed.length)
    if (!root.bindInstalled)
      root.bindMenuOpen = false
    root.offerNote = Binds.statusNote(p)
    root.bindLabel = Binds.chipLabel(p)
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
      root.applyBindPlan(Binds.applyScan(text))
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

  function changeBinds(arg) {
    enqueueWork(["hyprctl", "-j", "binds"], function(text, code) {
      if (Number(code) !== 0) {
        root.offerNote = "could not read keybinds"
        return
      }
      var plan = Binds.rotatePlan(Binds.parseBinds(text))
      Binds.setOffer(plan)
      if (!plan.changed || !plan.toAdd || !plan.toAdd.length) {
        root.offerNote = plan.note || "no free alternate"
        return
      }
      var lua = Binds.luaBlock(plan.toAdd)
      enqueueWork(["python3", root.pluginDir + "/compat/install-binds.py", root.pluginId, lua], function(out, instCode) {
        if (Number(instCode) !== 0) {
          root.offerNote = "could not write ~/.config/hypr/bindings.lua"
          return
        }
        root.bindMenuOpen = false
        root.notifyNewBinds(plan)
        Qt.callLater(root.scanBinds)
      })
    })
    return "ok"
  }

  function removeBinds(arg) {
    enqueueWork(["python3", root.pluginDir + "/compat/install-binds.py", root.pluginId, "--remove"], function(out, instCode) {
      if (Number(instCode) !== 0) {
        root.offerNote = "could not update ~/.config/hypr/bindings.lua"
        return
      }
      root.bindMenuOpen = false
      Quickshell.execDetached(Binds.notifyArgv("Notepad Calc", "Notepad Calc keybindings", "Removed this plugin's bindings.lua block"))
      Qt.callLater(root.scanBinds)
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

    WidgetButton {
      id: bindChip
      bar: root.bar
      text: root.bindLabel
      tooltipText: root.offerNote
      onPressed: function(buttonCode) {
        if (buttonCode !== Qt.LeftButton)
          return
        if (root.bindInstalled)
          root.bindMenuOpen = !root.bindMenuOpen
        else
          root.installBinds("")
      }
    }

    WidgetButton {
      visible: root.bindInstalled && root.bindMenuOpen
      bar: root.bar
      text: "Change"
      tooltipText: "Use the next free suggested combo (skips occupied keys; never unbinds others)"
      onPressed: function(buttonCode) {
        if (buttonCode === Qt.LeftButton)
          root.changeBinds("")
      }
    }

    WidgetButton {
      visible: root.bindInstalled && root.bindMenuOpen
      bar: root.bar
      text: "Remove"
      tooltipText: "Remove this plugin's marked o.bind block from ~/.config/hypr/bindings.lua"
      onPressed: function(buttonCode) {
        if (buttonCode === Qt.LeftButton)
          root.removeBinds("")
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
    function changeBinds(arg: string): string { return root.changeBinds(arg) }
    function removeBinds(arg: string): string { return root.removeBinds(arg) }
  }

  Component.onCompleted: Qt.callLater(root.scanBinds)
}
