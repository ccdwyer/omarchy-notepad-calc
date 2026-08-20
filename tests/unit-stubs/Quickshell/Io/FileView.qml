import QtQuick

QtObject {
  id: root
  property string path: ""
  property bool atomicWrites: false
  property bool printErrors: false
  property bool watchChanges: false
  property string _buf: ""
  signal loaded()
  signal loadFailed()
  signal saved()

  function text() { return root._buf }

  function setText(t) {
    root._buf = String(t)
    root.saved()
  }

  function reload() {
    if (!root.path || !root.path.length) {
      root.loadFailed()
      return
    }
    var xhr = new XMLHttpRequest()
    try {
      xhr.open("GET", (root.path.indexOf("file:") === 0 ? root.path : ("file://" + root.path)), false)
      xhr.send()
      if (xhr.responseText !== undefined && xhr.responseText !== null) {
        root._buf = String(xhr.responseText)
        root.loaded()
        return
      }
    } catch (e) {}
    if (root._buf.length) {
      root.loaded()
      return
    }
    root.loadFailed()
  }

  onPathChanged: {
    if (root.path && root.path.length)
      Qt.callLater(root.reload)
  }
}
