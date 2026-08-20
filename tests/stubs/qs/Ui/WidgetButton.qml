import QtQuick

Rectangle {
  property var bar: null
  property string text: ""
  property string tooltipText: ""
  signal pressed(int buttonCode)
  implicitWidth: 80
  implicitHeight: 24
  color: "#1a1b26"
  Text { anchors.centerIn: parent; text: parent.text; color: "#c0caf5" }
  MouseArea {
    anchors.fill: parent
    onClicked: parent.pressed(Qt.LeftButton)
  }
}
