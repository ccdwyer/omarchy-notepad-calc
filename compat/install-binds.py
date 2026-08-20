#!/usr/bin/env python3
"""Append, replace, or remove a marked o.bind block in ~/.config/hypr/bindings.lua."""

import os
import sys


def bindings_path() -> str:
    config_home = os.environ.get("XDG_CONFIG_HOME") or os.path.join(
        os.environ.get("HOME", os.path.expanduser("~")), ".config"
    )
    return os.path.join(config_home, "hypr", "bindings.lua")


def strip_block(text: str, begin: str, end: str) -> str:
    if begin not in text or end not in text:
        return text
    pre = text[: text.index(begin)]
    post = text[text.index(end) + len(end) :].lstrip("\n")
    text = pre.rstrip()
    if post:
        text = (text + "\n\n" + post.lstrip()) if text else post.lstrip()
    if text and not text.endswith("\n"):
        text += "\n"
    return text


def write_block(text: str, begin: str, end: str, block: str) -> str:
    if not block.endswith("\n"):
        block += "\n"
    chunk = f"{begin}\n{block}{end}\n"
    if begin in text and end in text:
        pre = text[: text.index(begin)]
        post = text[text.index(end) + len(end) :].lstrip("\n")
        text = pre.rstrip() + "\n\n" + chunk
        if post:
            text = text.rstrip() + "\n" + post
            if not text.endswith("\n"):
                text += "\n"
        return text
    if text and not text.endswith("\n"):
        text += "\n"
    text = text.rstrip() + "\n\n" + chunk
    if not text.endswith("\n"):
        text += "\n"
    return text


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: install-binds.py PLUGIN_ID LUA_BLOCK|--remove", file=sys.stderr)
        return 2
    plugin_id = sys.argv[1]
    remove = sys.argv[2] == "--remove"
    path = bindings_path()
    begin = f"-- BEGIN {plugin_id}"
    end = f"-- END {plugin_id}"
    text = ""
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    if remove:
        if text:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(strip_block(text, begin, end))
        print("ok")
        return 0
    block = sys.argv[2]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(write_block(text, begin, end, block))
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
