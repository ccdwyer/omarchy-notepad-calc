#!/bin/sh
# Source from tests/ui/{run,demo,soak}.sh (and CI). Discovers a QML runtime that
# can import Quickshell — prefer the Nix closure that provides `quickshell`,
# not Ubuntu's system qml6 with a stubs-only import path.
#
# Exports: QML_BIN, QS_QML_ROOT, QML2_IMPORT_PATH, QML_IMPORT_PATH, PATH
# Never puts tests/unit-stubs on the import path (unit-only Quickshell fakes).

if [ -z "${ROOT:-}" ]; then
  echo "setup-qml-env: ROOT must be set by the caller" >&2
  return 1 2>/dev/null || exit 1
fi

if [ -f "$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nix-profile/etc/profile.d/nix.sh"
fi
if [ -d "$HOME/.nix-profile/bin" ]; then
  PATH="$HOME/.nix-profile/bin:$PATH"
  export PATH
fi

_nc_resolve() {
  p=$1
  [ -n "$p" ] || return 1
  if command -v realpath >/dev/null 2>&1; then
    realpath "$p"
    return
  fi
  if command -v readlink >/dev/null 2>&1 && readlink -f "$p" >/dev/null 2>&1; then
    readlink -f "$p"
    return
  fi
  echo "$p"
}

_nc_store_prefix() {
  bin=$1
  [ -n "$bin" ] && [ -e "$bin" ] || return 1
  real=$(_nc_resolve "$bin") || real=$bin
  dir=$(dirname "$real")
  echo "$(CDPATH= cd -- "$dir/.." && pwd)"
}

QS_QML_ROOT="${QS_QML_ROOT:-}"
QS_BIN=""
if command -v quickshell >/dev/null 2>&1; then
  QS_BIN=$(command -v quickshell)
fi

_nc_looks_qmldir() {
  [ -f "$1/Quickshell/qmldir" ]
}

if [ -z "$QS_QML_ROOT" ] && [ -n "$QS_BIN" ]; then
  qs_prefix=$(_nc_store_prefix "$QS_BIN") || qs_prefix=""
  if [ -n "$qs_prefix" ]; then
    for d in \
      "$qs_prefix/lib/qt-6/qml" \
      "$qs_prefix/lib/qt6/qml" \
      "$qs_prefix/lib/qml"
    do
      if _nc_looks_qmldir "$d"; then
        QS_QML_ROOT=$d
        break
      fi
    done
    if [ -z "$QS_QML_ROOT" ]; then
      for d in "$qs_prefix/lib"/qt-*/qml; do
        if _nc_looks_qmldir "$d"; then
          QS_QML_ROOT=$d
          break
        fi
      done
    fi
  fi
fi

if [ -z "$QS_QML_ROOT" ]; then
  for d in \
    "$HOME/.nix-profile/lib/qt-6/qml" \
    "$HOME/.nix-profile/lib/qt6/qml" \
    /nix/var/nix/profiles/default/lib/qt-6/qml \
    /nix/var/nix/profiles/default/lib/qt6/qml
  do
    if _nc_looks_qmldir "$d"; then
      QS_QML_ROOT=$d
      break
    fi
  done
fi

if [ -z "$QS_QML_ROOT" ]; then
  for d in "$HOME/.nix-profile/lib"/qt-*/qml /nix/var/nix/profiles/default/lib/qt-*/qml; do
    if _nc_looks_qmldir "$d"; then
      QS_QML_ROOT=$d
      break
    fi
  done
fi

# Prefer a qml binary from the same Nix closure as Quickshell (ABI match).
NIX_QML=""
if [ -x "$HOME/.nix-profile/bin/qml" ]; then
  NIX_QML="$HOME/.nix-profile/bin/qml"
elif [ -x "$HOME/.nix-profile/bin/qml6" ]; then
  NIX_QML="$HOME/.nix-profile/bin/qml6"
fi

if [ -z "$NIX_QML" ] && [ -n "$QS_BIN" ] && command -v nix-store >/dev/null 2>&1; then
  qs_prefix=$(_nc_store_prefix "$QS_BIN") || qs_prefix=""
  if [ -n "$qs_prefix" ]; then
    for p in $(nix-store -q --requisites "$qs_prefix" 2>/dev/null || true); do
      if [ -x "$p/bin/qml" ]; then
        NIX_QML="$p/bin/qml"
        break
      fi
      if [ -x "$p/bin/qml6" ]; then
        NIX_QML="$p/bin/qml6"
        break
      fi
    done
    if [ -z "$NIX_QML" ] && [ -x "$qs_prefix/bin/qml" ]; then
      NIX_QML="$qs_prefix/bin/qml"
    fi
  fi
fi

# Do not keep Ubuntu qml6 when a Nix-compatible binary exists: system qml +
# Nix Quickshell is the combination that cannot import Quickshell.
if [ -n "$NIX_QML" ]; then
  QML_BIN=$NIX_QML
elif [ -n "${QML_BIN:-}" ] && [ -x "$QML_BIN" ]; then
  :
elif [ -n "${QML_BIN:-}" ] && command -v "$QML_BIN" >/dev/null 2>&1; then
  QML_BIN=$(command -v "$QML_BIN")
else
  QML_BIN=""
  for c in qml6 qml qmlscene; do
    if command -v "$c" >/dev/null 2>&1; then
      QML_BIN=$(command -v "$c")
      break
    fi
  done
fi
export QML_BIN

if [ -n "$QML_BIN" ] && [ -x "$QML_BIN" ]; then
  PATH="$(CDPATH= cd -- "$(dirname "$QML_BIN")" && pwd):$PATH"
  export PATH
fi

# QtQuick / plugin dirs from the qml binary's prefix (Nix wrap or store path).
QT_QML_ROOT=""
if [ -n "$QML_BIN" ]; then
  qml_prefix=$(_nc_store_prefix "$QML_BIN") || qml_prefix=""
  if [ -n "$qml_prefix" ]; then
    for d in "$qml_prefix/lib/qt-6/qml" "$qml_prefix/lib/qt6/qml" "$qml_prefix/lib/qml"; do
      if [ -d "$d/QtQuick" ] || [ -d "$d/QtQml" ]; then
        QT_QML_ROOT=$d
        break
      fi
    done
    for d in "$qml_prefix/lib/qt-6/plugins" "$qml_prefix/lib/qt6/plugins" "$qml_prefix/plugins"; do
      if [ -d "$d/platforms" ]; then
        QT_PLUGIN_PATH="$d${QT_PLUGIN_PATH:+:$QT_PLUGIN_PATH}"
        export QT_PLUGIN_PATH
        break
      fi
    done
  fi
fi

# Build import path: Quickshell first, then matching Qt QML, then Omarchy theme
# stubs, then anything the caller already set. Never unit-stubs.
_nc_path=""
_nc_add() {
  d=$1
  [ -n "$d" ] && [ -d "$d" ] || return 0
  case ":$_nc_path:" in
    *":$d:"*) return 0 ;;
  esac
  if [ -z "$_nc_path" ]; then
    _nc_path=$d
  else
    _nc_path="$_nc_path:$d"
  fi
}

_nc_add "$QS_QML_ROOT"
_nc_add "$QT_QML_ROOT"
_nc_add "$ROOT/tests/stubs"

# Preserve extra caller paths except unit-stubs.
_nc_merge_old() {
  _old=$1
  [ -n "$_old" ] || return 0
  OLDIFS=$IFS
  IFS=:
  # shellcheck disable=SC2086
  set -- $_old
  IFS=$OLDIFS
  for d in "$@"; do
    [ -n "$d" ] || continue
    case "$d" in
      *unit-stubs*) continue ;;
    esac
    _nc_add "$d"
  done
}
_nc_merge_old "${QML2_IMPORT_PATH:-}"
_nc_merge_old "${QML_IMPORT_PATH:-}"

export QS_QML_ROOT
export QML2_IMPORT_PATH="$_nc_path"
export QML_IMPORT_PATH="$_nc_path"

echo "qml-env: QML_BIN=${QML_BIN:-}"
echo "qml-env: QS_QML_ROOT=${QS_QML_ROOT:-}"
echo "qml-env: QML2_IMPORT_PATH=$QML2_IMPORT_PATH"

if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  if [ -z "${QS_QML_ROOT:-}" ] || [ ! -f "$QS_QML_ROOT/Quickshell/qmldir" ]; then
    echo "FAIL Quickshell QML module not on the import path (Nix Quickshell is required)" >&2
    return 1 2>/dev/null || exit 1
  fi
  if [ -z "${QML_BIN:-}" ]; then
    echo "FAIL no qml runtime compatible with Quickshell" >&2
    return 1 2>/dev/null || exit 1
  fi
fi
