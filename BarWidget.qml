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
  readonly property var notepad: panelLoader.item

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

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
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
  }
}
