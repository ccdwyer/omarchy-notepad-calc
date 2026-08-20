pragma Singleton
import QtQuick

QtObject {
  function env(key) {
    if (key === "HOME")
      return Qt.resolvedUrl("file:///tmp/notepad-calc-ci-home").toString().indexOf("file://") === 0
        ? "/tmp/notepad-calc-ci-home"
        : "/tmp/notepad-calc-ci-home"
    if (key === "XDG_DATA_HOME")
      return "/tmp/notepad-calc-ci-home/.local/share"
    if (key === "OMARCHY_PATH")
      return ""
    if (key === "OMARCHY_REDUCED_MOTION")
      return ""
    if (key === "NOTEPAD_CALC_TEST")
      return "1"
    return ""
  }
}
