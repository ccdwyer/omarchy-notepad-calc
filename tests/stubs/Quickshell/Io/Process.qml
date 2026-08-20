import QtQuick

QtObject {
  id: root
  property var command: []
  property bool running: false
  property var stdout: collector
  signal exited(int exitCode)

  StdioCollector { id: collector }

  onRunningChanged: {
    if (!root.running)
      return
    Qt.callLater(function () {
      var cmd = root.command
      var joined = ""
      if (cmd && cmd.length)
        joined = cmd.join(" ")
      var out = ""
      if (joined.indexOf("battlestation.calc") >= 0 || joined.indexOf("echo HAS") >= 0)
        out = "HAS\n"
      else if (joined.indexOf("ls ") >= 0)
        out = "battlestation.calc\n"
      else if (joined.indexOf("binary") >= 0)
        out = "missing\n"
      collector.text = out
      collector.streamFinished()
      root.exited(0)
      root.running = false
    })
  }
}
