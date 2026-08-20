import QtQuick
import QtQuick.Layouts
import QtQuick.Window
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "js/engine.js" as Engine
import "js/format.js" as Format
import "js/units.js" as Units
import "js/tz.js" as Tz
import "js/rates.js" as Rates

Item {
  id: root

  signal totalChanged(string display)
  signal opened()
  signal closed()

  property string pluginDir: ""
  property string defaultCurrency: "USD"
  property bool reduceMotion: false
  property bool isOpen: false
  property bool testHarness: false
  property int testWidth: 980
  property int testHeight: 640
  property bool ratesArmed: false
  property var ratesObj: null
  property string ratesDate: ""

  property string sheetText: ""
  property string sheetName: "battlestation.calc"
  property string sheetTitle: "Omarchy battlestation"
  property var lineResults: []
  property var pulseUntil: []
  property int hoverSumFrom: -1
  property int hoverSumTo: -1
  property int cursorLine: 0
  property string statusMsg: ""
  property bool showHelp: false
  property bool showSwitcher: false
  property string switcherQuery: ""
  property var sheetList: []
  property int switcherIndex: 0
  property string copiedFlash: ""

  readonly property string home: Quickshell.env("HOME") || "/tmp"
  readonly property string dataDir: {
    var xdg = Quickshell.env("XDG_DATA_HOME")
    if (xdg && xdg.length)
      return xdg + "/notepad-calc"
    return home + "/.local/share/notepad-calc"
  }
  readonly property string sheetsDir: dataDir + "/sheets"
  readonly property string activePath: sheetsDir + "/" + sheetName

  property color background: Color.menu.background
  property color foreground: Color.menu.text
  property color border: Color.menu.border
  property color scrim: Color.menu.scrim
  property color accent: Color.accent
  property color muted: {
    try { return Color.menu.dim || Color.menu.muted || foreground } catch (e) {}
    return foreground
  }
  property color secondary: {
    try { return Color.secondary || Color.menu.selectedText || accent } catch (e) {}
    return accent
  }
  property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  readonly property int cornerRadius: Style.cornerRadius
  property string fontFamily: {
    try {
      if (Style.font.monoFamily) return Style.font.monoFamily
    } catch (e) {}
    try {
      if (Style.font.monospace) return Style.font.monospace
    } catch (e2) {}
    return "JetBrains Mono"
  }
  property string uiFont: Style.font.menuFamily
  property int fontPx: Style.font.body
  property int lineHeight: Math.round(fontPx * 1.45)
  property int resultsWidth: Style.space(56)
  readonly property int motionMs: reduceMotion ? 0 : 150
  readonly property int pulseMs: 300

  function boot() {
    rates.pluginDir = root.pluginDir
    rates.dataDir = root.dataDir
    ensureDirs()
    seedFirstRun()
  }

  function startDailyRates() {
    if (root.ratesArmed)
      return
    root.ratesArmed = true
    rates.pluginDir = root.pluginDir
    rates.dataDir = root.dataDir
    rates.maybeRefresh()
  }

  function open(payloadJson) {
    root.isOpen = true
    root.showHelp = false
    root.showSwitcher = false
    boot()
    root.opened()
    Qt.callLater(function() { editor.forceActiveFocus() })
  }

  function close() {
    saveNow()
    root.isOpen = false
    root.closed()
  }

  function toggle() {
    if (root.isOpen) close()
    else open("{}")
  }

  function makeCtx() {
    var ratesVal = root.ratesObj
    if (!ratesVal)
      ratesVal = bundledRates.obj
    return {
      units: Units,
      tz: Tz,
      rates: ratesVal,
      ratesMod: Rates,
      now: new Date(),
      format: Format.formatQty,
      defaultCurrency: root.defaultCurrency || "USD"
    }
  }

  function reeval() {
    var text = editor.text
    root.sheetText = text
    var lines = text.split("\n")
    var results
    try {
      results = Engine.evalSheet(lines, makeCtx())
    } catch (e) {
      results = []
      var ei
      for (ei = 0; ei < lines.length; ei++)
        results.push({ kind: "unresolved", names: ["error"], display: "?error", lineIndex: ei })
    }
    var prev = root.lineResults
    var nextPulse = []
    var now = Date.now()
    for (var i = 0; i < results.length; i++) {
      var nd = results[i] && results[i].display ? results[i].display : ""
      var od = prev[i] && prev[i].display ? prev[i].display : ""
      if (prev.length && nd !== od && nd.length)
        nextPulse[i] = now + root.pulseMs
      else if (root.pulseUntil[i] && root.pulseUntil[i] > now)
        nextPulse[i] = root.pulseUntil[i]
    }
    root.lineResults = results
    root.pulseUntil = nextPulse
    var anyPulse = false
    for (var p = 0; p < nextPulse.length; p++) {
      if (nextPulse[p]) anyPulse = true
    }
    if (anyPulse)
      pulseTick.running = true
    if (lines.length)
      root.sheetTitle = String(lines[0]).replace(/^\s+|\s+$/g, "") || root.sheetName
    var tot = Engine.sheetTotal(results)
    root.totalChanged(tot && tot.display ? tot.display : "")
    saveTimer.restart()
  }

  function ensureDirs() {
    mkdirProc.command = ["mkdir", "-p", root.sheetsDir]
    mkdirProc.running = true
  }

  function seedFirstRun() {
    seedProc.command = [
      "sh", "-c",
      "mkdir -p \"$1\"; DST=\"$1/battlestation.calc\"; SRC=\"$2/data/first-run.calc\"; if [ -f \"$DST\" ]; then echo HAS; elif [ -f \"$SRC\" ]; then cp \"$SRC\" \"$DST\" && echo SEEDED; else echo MISSING; fi",
      "sh", root.sheetsDir, root.pluginDir
    ]
    seedProc.running = true
  }

  function setTestText(t) {
    editor.text = t
    reeval()
  }

  function insertTestText(t) {
    editor.insert(editor.cursorPosition, t)
  }

  function grabTarget() {
    return chrome
  }

  function loadActiveSheet() {
    sheetFile.path = root.activePath
    sheetFile.reload()
  }

  function saveNow() {
    if (!root.sheetName || !root.sheetName.length) return
    sheetFile.path = root.activePath
    sheetFile.setText(editor.text)
  }

  function listSheets() {
    lsProc.command = ["sh", "-c", "ls -1 \"$1\" 2>/dev/null | grep -E '\\.calc$' || true", "sh", root.sheetsDir]
    lsProc.running = true
  }

  function filteredSheets() {
    var q = lowerStr(root.switcherQuery)
    var out = []
    for (var i = 0; i < root.sheetList.length; i++) {
      var n = root.sheetList[i]
      if (!q.length || lowerStr(n).indexOf(q) >= 0)
        out.push(n)
    }
    return out
  }

  function lowerStr(s) { return String(s || "").toLowerCase() }

  function newSheet() {
    saveNow()
    var stamp = Date.now().toString(16)
    root.sheetName = "sheet-" + stamp + ".calc"
    editor.text = "untitled\n\n"
    reeval()
    saveNow()
    listSheets()
    root.showSwitcher = false
    editor.forceActiveFocus()
  }

  function openSheet(name) {
    saveNow()
    root.sheetName = name
    loadActiveSheet()
    root.showSwitcher = false
    editor.forceActiveFocus()
  }

  function copyResultAt(line) {
    var r = root.lineResults[line]
    if (!r || !r.display || r.kind !== "result" && r.kind !== "unresolved")
      return
    copyText(r.display)
    root.copiedFlash = r.display
    copyFlashTimer.restart()
  }

  function copyText(s) {
    copyProc.command = [
      "sh", "-c",
      "if command -v wl-copy >/dev/null 2>&1; then wl-copy -- \"$1\"; echo OK; else echo MISSING; exit 1; fi",
      "sh", s
    ]
    copyProc.running = true
  }

  function currentLine() {
    var t = editor.text
    var pos = editor.cursorPosition
    var line = 0
    for (var i = 0; i < pos && i < t.length; i++) {
      if (t.charAt(i) === "\n") line++
    }
    return line
  }

  function pulseOpacity(index) {
    var until = root.pulseUntil[index]
    if (!until) return 0
    var left = until - Date.now()
    if (left <= 0) return 0
    if (root.reduceMotion) return 0.4
    return 0.4 * (left / root.pulseMs)
  }

  function resultColor(r) {
    if (!r || r.kind === "blank" || r.kind === "prose") return "transparent"
    if (r.kind === "unresolved") return root.muted
    return root.accent
  }

  RatesRefresh {
    id: rates
    pluginDir: root.pluginDir
    dataDir: root.dataDir
    onRatesChanged: {
      root.ratesObj = rates.rates
      root.ratesDate = rates.ratesDate
      if (root.isOpen) reeval()
    }
    onRatesDateChanged: root.ratesDate = rates.ratesDate
  }

  QtObject {
    id: bundledRates
    property var obj: null
  }

  FileView {
    id: firstRunFile
    path: root.pluginDir + "/data/first-run.calc"
    printErrors: false
  }

  FileView {
    id: bundledRatesFile
    path: root.pluginDir + "/data/rates.json"
    printErrors: false
    onLoaded: {
      try {
        bundledRates.obj = JSON.parse(text())
        if (!root.ratesObj) {
          root.ratesObj = bundledRates.obj
          root.ratesDate = bundledRates.obj.date || ""
        }
      } catch (e) {}
    }
  }

  FileView {
    id: sheetFile
    path: root.activePath
    printErrors: false
    atomicWrites: true
    watchChanges: false
    onLoaded: {
      var t = text()
      if (editor.text !== t) {
        editor.text = t
        reeval()
      }
    }
    onLoadFailed: {
      if (!editor.text.length) {
        var seed = firstRunFile.text()
        editor.text = seed && seed.length ? seed : "untitled\n\n"
        reeval()
      }
    }
  }

  Process { id: mkdirProc; running: false }
  Process {
    id: copyProc
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var t = String(text || "").trim()
        if (t === "MISSING")
          root.statusMsg = "wl-copy not found — install wl-clipboard to copy"
      }
    }
    onExited: {
      if (exitCode !== 0) {
        if (!root.statusMsg || root.statusMsg.indexOf("wl-copy") < 0)
          root.statusMsg = "copy failed (wl-copy)"
      }
    }
  }

  Process {
    id: seedProc
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var kind = String(text || "").trim()
        root.sheetName = "battlestation.calc"
        if (kind === "MISSING") {
          var fallback = firstRunFile.text()
          if (fallback && fallback.length) {
            sheetFile.path = root.activePath
            sheetFile.setText(fallback)
            editor.text = fallback
            root.reeval()
          }
        }
        root.listSheets()
        root.loadActiveSheet()
      }
    }
  }

  Process {
    id: lsProc
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var lines = String(text || "").split("\n")
        var out = []
        for (var i = 0; i < lines.length; i++) {
          var s = lines[i].replace(/^\s+|\s+$/g, "")
          if (s.length) out.push(s)
        }
        root.sheetList = out
      }
    }
  }

  Timer {
    id: debounce
    interval: 60
    repeat: false
    onTriggered: root.reeval()
  }

  Timer {
    id: saveTimer
    interval: 800
    repeat: false
    onTriggered: root.saveNow()
  }

  Timer {
    id: pulseTick
    interval: 40
    repeat: true
    running: false
    onTriggered: {
      var now = Date.now()
      var next = []
      var any = false
      for (var i = 0; i < root.pulseUntil.length; i++) {
        if (root.pulseUntil[i] && root.pulseUntil[i] > now) {
          next[i] = root.pulseUntil[i]
          any = true
        }
      }
      root.pulseUntil = next
      if (!any)
        pulseTick.running = false
    }
  }

  Timer {
    id: copyFlashTimer
    interval: 900
    onTriggered: root.copiedFlash = ""
  }

  Window {
    id: testWin
    visible: root.testHarness
    width: root.testWidth
    height: root.testHeight
    title: "notepad-calc-test"
    color: "transparent"
  }

  PanelWindow {
    id: panel
    visible: root.testHarness ? false : root.isOpen
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "notepad-calc"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Item {
      id: chrome
      parent: root.testHarness ? testWin.contentItem : panel
      anchors.fill: parent

    Rectangle {
      anchors.fill: parent
      color: root.scrim
      opacity: (root.isOpen || root.testHarness) ? 1 : 0
      Behavior on opacity { NumberAnimation { duration: root.motionMs } }
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.close()
    }

    BorderSurface {
      id: frame
      width: Math.min(Style.space(980), (root.testHarness ? testWin.width : panel.width) - Style.gapsOut * 2)
      height: Math.min(Style.space(640), (root.testHarness ? testWin.height : panel.height) - Style.gapsOut * 2)
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      opacity: (root.isOpen || root.testHarness) ? 1 : 0
      scale: (root.isOpen || root.testHarness) ? 1 : 0.98
      Behavior on opacity { NumberAnimation { duration: root.motionMs } }
      Behavior on scale { NumberAnimation { duration: root.motionMs } }

      MouseArea { anchors.fill: parent; onClicked: {} }

      Column {
        anchors.fill: parent
        anchors.margins: Style.spacing.panelPadding
        spacing: Style.spacing.sm

        Row {
          width: parent.width
          spacing: Style.space(10)

          Text {
            text: "Σ  " + (root.sheetTitle || "Notepad Calc")
            color: root.foreground
            font.family: root.uiFont
            font.pixelSize: Style.font.heading
            font.bold: true
            anchors.verticalCenter: parent.verticalCenter
          }

          Text {
            text: root.ratesDate.length ? ("rates: " + root.ratesDate) : "rates: bundled"
            color: root.muted
            opacity: 0.7
            font.family: root.uiFont
            font.pixelSize: Style.font.body
            anchors.verticalCenter: parent.verticalCenter
          }

          Item { width: 8; height: 1 }

          Text {
            text: root.copiedFlash.length
                  ? ("copied " + root.copiedFlash)
                  : (root.statusMsg.length ? root.statusMsg : "inspired by Soulver")
            color: root.copiedFlash.length ? root.accent : root.muted
            opacity: root.copiedFlash.length ? 1 : 0.55
            font.family: root.uiFont
            font.pixelSize: Style.font.body
            anchors.verticalCenter: parent.verticalCenter
          }
        }

        Item {
          width: parent.width
          height: parent.height - Style.space(36)

          Flickable {
            id: vFlick
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.right: resultsPane.left
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            flickableDirection: Flickable.HorizontalAndVerticalFlick
            contentWidth: Math.max(width, editor.contentWidth + Style.space(4))
            contentHeight: Math.max(height, editor.lineCount * root.lineHeight + Style.space(4))

            Repeater {
              model: editor.lineCount
              delegate: Rectangle {
                required property int index
                width: Style.space(2)
                height: root.lineHeight
                x: 0
                y: index * root.lineHeight
                color: root.accent
                opacity: (root.hoverSumFrom >= 0 && index >= root.hoverSumFrom && index <= root.hoverSumTo) ? 0.85 : 0
              }
            }

            TextEdit {
              id: editor
              width: Math.max(vFlick.width, contentWidth)
              height: Math.max(vFlick.height, lineCount * root.lineHeight)
              wrapMode: TextEdit.NoWrap
              color: root.foreground
              selectedTextColor: root.background
              selectionColor: root.accent
              font.family: root.fontFamily
              font.pixelSize: root.fontPx
              font.hintingPreference: Font.PreferFullHinting
              tabStopDistance: root.fontPx * 2
              persistentSelection: true
              text: ""
              onTextChanged: debounce.restart()
              onCursorPositionChanged: root.cursorLine = root.currentLine()
              Keys.priority: Keys.BeforeItem
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) {
                  if (root.showHelp) { root.showHelp = false; event.accepted = true }
                  else if (root.showSwitcher) { root.showSwitcher = false; event.accepted = true }
                  else { root.close(); event.accepted = true }
                } else if (event.key === Qt.Key_K && (event.modifiers & Qt.ControlModifier)) {
                  root.showSwitcher = !root.showSwitcher
                  root.switcherQuery = ""
                  root.switcherIndex = 0
                  root.listSheets()
                  if (root.showSwitcher)
                    Qt.callLater(function () { switcherInput.forceActiveFocus() })
                  event.accepted = true
                } else if (event.key === Qt.Key_N && (event.modifiers & Qt.ControlModifier) && !(event.modifiers & Qt.ShiftModifier)) {
                  root.newSheet()
                  event.accepted = true
                } else if (event.key === Qt.Key_C && (event.modifiers & Qt.ControlModifier) && (event.modifiers & Qt.ShiftModifier)) {
                  root.copyResultAt(root.currentLine())
                  event.accepted = true
                } else if (event.key === Qt.Key_Question || (event.key === Qt.Key_Slash && (event.modifiers & Qt.ShiftModifier))) {
                  root.showHelp = !root.showHelp
                  event.accepted = true
                } else if (event.key === Qt.Key_S && (event.modifiers & Qt.ControlModifier)) {
                  root.saveNow()
                  event.accepted = true
                }
              }
            }
          }

          Item {
            id: resultsPane
            width: root.resultsWidth
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            clip: true

            Repeater {
              model: Math.max(editor.lineCount, root.lineResults.length)
              delegate: Item {
                id: row
                required property int index
                width: resultsPane.width
                height: root.lineHeight
                y: index * root.lineHeight - vFlick.contentY

                Rectangle {
                  anchors.fill: parent
                  color: root.accent
                  opacity: {
                    var p = root.pulseOpacity(index)
                    var r = root.lineResults[index]
                    var inSum = root.hoverSumFrom >= 0 && index >= root.hoverSumFrom && index <= root.hoverSumTo
                    if (inSum) return Math.max(p, 0.12)
                    return p
                  }
                }

                Text {
                  anchors.right: parent.right
                  anchors.rightMargin: Style.space(2)
                  anchors.verticalCenter: parent.verticalCenter
                  width: parent.width - Style.space(4)
                  horizontalAlignment: Text.AlignRight
                  elide: Text.ElideLeft
                  font.family: root.fontFamily
                  font.pixelSize: root.fontPx
                  color: root.resultColor(root.lineResults[index])
                  opacity: {
                    var r = root.lineResults[index]
                    if (!r) return 0
                    if (r.kind === "unresolved") return 0.55
                    return 1
                  }
                  text: {
                    var r = root.lineResults[index]
                    return r && r.display ? r.display : ""
                  }

                  MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.copyResultAt(index)
                    onEntered: {
                      var r = root.lineResults[index]
                      if (r && r.sumOp && r.sumFrom >= 0) {
                        root.hoverSumFrom = r.sumFrom
                        root.hoverSumTo = r.sumTo
                      }
                      if (r && r.tzResolved)
                        root.statusMsg = r.tzResolved
                    }
                    onExited: {
                      root.hoverSumFrom = -1
                      root.hoverSumTo = -1
                      if (root.statusMsg && root.statusMsg.indexOf("/") >= 0)
                        root.statusMsg = ""
                    }
                  }
                }
              }
            }
          }

          Rectangle {
            visible: root.showHelp || root.showSwitcher
            anchors.fill: parent
            color: root.background
            opacity: 0.96

            Column {
              anchors.fill: parent
              anchors.margins: Style.space(8)
              spacing: Style.space(4)
              visible: root.showHelp

              Text {
                text: "Notepad Calc"
                color: root.foreground
                font.family: root.uiFont
                font.pixelSize: Style.font.heading
                font.bold: true
              }
              Text {
                width: parent.width
                wrapMode: Text.WordWrap
                color: root.foreground
                opacity: 0.8
                font.family: root.uiFont
                font.pixelSize: Style.font.body
                text: "Inspired by Soulver. A living notepad: prose with numbers, units, currency, dates and variables — every line evaluates as you type.\n\n" +
                      "Ctrl+K    sheet switcher\n" +
                      "Ctrl+N    new sheet\n" +
                      "Ctrl+Shift+C   copy this line's result\n" +
                      "click a result to copy\n" +
                      "Ctrl+S    save now (also autosaves)\n" +
                      "?         this help\n" +
                      "Esc       close\n\n" +
                      "X + N% means X × (1+N/100). N% of X multiplies. in EUR converts prev. sum totals the block above the last blank. Hover sum to underline what it captured.\n\n" +
                      "Works fully offline. Currency rates are the ECB set (~30), dated in the header."
              }
            }

            Column {
              anchors.fill: parent
              anchors.margins: Style.space(8)
              spacing: Style.space(4)
              visible: root.showSwitcher

              Text {
                text: "Sheets"
                color: root.foreground
                font.family: root.uiFont
                font.pixelSize: Style.font.heading
                font.bold: true
              }
              TextInput {
                id: switcherInput
                width: parent.width
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: root.fontPx
                text: root.switcherQuery
                onTextChanged: root.switcherQuery = text
                Keys.onPressed: function(event) {
                  var list = root.filteredSheets()
                  if (event.key === Qt.Key_Down) {
                    root.switcherIndex = Math.min(root.switcherIndex + 1, Math.max(0, list.length - 1))
                    event.accepted = true
                  } else if (event.key === Qt.Key_Up) {
                    root.switcherIndex = Math.max(0, root.switcherIndex - 1)
                    event.accepted = true
                  } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                    if (list[root.switcherIndex])
                      root.openSheet(list[root.switcherIndex])
                    event.accepted = true
                  } else if (event.key === Qt.Key_Escape) {
                    root.showSwitcher = false
                    editor.forceActiveFocus()
                    event.accepted = true
                  }
                }
              }
              Repeater {
                model: root.filteredSheets()
                delegate: Text {
                  required property int index
                  required property var modelData
                  text: modelData
                  color: index === root.switcherIndex ? root.accent : root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: root.fontPx
                  MouseArea {
                    anchors.fill: parent
                    onClicked: root.openSheet(modelData)
                  }
                }
              }
            }
          }
        }
      }
    }
    }
  }
}
