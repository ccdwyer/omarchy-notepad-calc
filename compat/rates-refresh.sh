#!/bin/sh
# POSIX fallback when bin/notepad-calc-rates is missing.
# Fetches the ECB daily XML, writes rates.json atomically. Hard 5s timeout.

set -eu

OUT=""
TIMEOUT=5
XML=""

while [ $# -gt 0 ]; do
  case "$1" in
    fetch) shift ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --timeout) TIMEOUT="${2:-5}"; shift 2 ;;
    --xml) XML="${2:-}"; shift 2 ;;
    ping) echo ok; exit 0 ;;
    parse)
      XML="-"
      shift
      ;;
    *) shift ;;
  esac
done

if [ -z "$OUT" ]; then
  OUT="${XDG_DATA_HOME:-$HOME/.local/share}/notepad-calc/rates.json"
fi

if [ -L "$OUT" ]; then
  echo "rates-refresh: refusing symlink $OUT" >&2
  exit 1
fi
OUTDIR=$(dirname "$OUT")
mkdir -p "$OUTDIR"
if [ -L "$OUTDIR" ]; then
  echo "rates-refresh: refusing symlink directory $OUTDIR" >&2
  exit 1
fi
TMPXML=$(mktemp "$OUTDIR/.ecb.XXXXXX")
TMPJSON=$(mktemp "$OUTDIR/.rates.XXXXXX")
cleanup() { rm -f "$TMPXML" "$TMPJSON"; }
trap cleanup EXIT

if [ -n "$XML" ] && [ "$XML" != "-" ]; then
  cp "$XML" "$TMPXML"
elif [ "$XML" = "-" ]; then
  cat > "$TMPXML"
else
  if ! command -v curl >/dev/null 2>&1; then
    echo "rates-refresh: curl not found" >&2
    exit 1
  fi
  curl -fsSL --max-time "$TIMEOUT" --retry 0 \
    "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml" \
    -o "$TMPXML"
fi

DATE=$(sed -n 's/.*time="\([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\)".*/\1/p' "$TMPXML" | head -n 1)
if [ -z "$DATE" ]; then
  echo "rates-refresh: no date in ECB xml" >&2
  exit 2
fi

CUBES=$(sed -n 's/.*currency="\([A-Z][A-Z][A-Z]\)" rate="\([0-9.][0-9.]*\)".*/\1 \2/p' "$TMPXML")
if [ -z "$CUBES" ]; then
  echo "rates-refresh: no currency cubes" >&2
  exit 2
fi

{
  echo "{"
  echo "  \"date\": \"$DATE\","
  echo "  \"base\": \"EUR\","
  echo "  \"source\": \"ECB daily reference\","
  echo "  \"rates\": {"
  printf '%s\n' "$CUBES" \
    | awk 'NF==2 { printf "    \"%s\": %s,\n", $1, $2 }' \
    | sed '$ s/,$//'
  echo "  }"
  echo "}"
} > "$TMPJSON"

mv "$TMPJSON" "$OUT"
echo "ok $DATE"
