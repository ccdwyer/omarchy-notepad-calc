pragma Singleton
import QtQuick

QtObject {
  function surfaceSpec(a, b, color, width) {
    return { color: color, width: width || 1 }
  }
  function controlSpec(state, fg, accent) {
    return { color: accent, width: 1 }
  }
}
