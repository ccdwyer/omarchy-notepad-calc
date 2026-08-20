import QtQuick
import QtQuick.Window

Window {
  id: win
  width: 980
  height: 640
  color: "transparent"
  property int exclusionMode: 0
  property var WlrLayershell: layers
  QtObject {
    id: layers
    property string namespace: ""
    property int layer: 0
    property int keyboardFocus: 0
  }
  QtObject {
    id: edgeAnchors
    property bool top: false
    property bool bottom: false
    property bool left: false
    property bool right: false
  }
}
