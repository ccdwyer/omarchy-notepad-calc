pragma Singleton
import QtQuick

QtObject {
  property bool reduceMotion: false
  property int cornerRadius: 8
  property int gapsOut: 16
  property var font: ({
    monoFamily: "monospace",
    monospace: "monospace",
    menuFamily: "sans-serif",
    heading: 18,
    body: 14
  })
  property var spacing: ({
    panelPadding: 16,
    sm: 8,
    md: 12,
    labelGap: 6
  })
  function space(n) { return n }
  function selectedFillFor(fg, accent) { return accent }
  function normalFillFor(fg, accent) { return "transparent" }
}
