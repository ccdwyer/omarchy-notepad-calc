#!/usr/bin/env python3
"""Append, replace, or remove a marked o.bind block in ~/.config/hypr/bindings.lua."""

import os
import stat
import tempfile
import sys



def _refuse_symlink(path: str) -> None:
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        return
    if stat.S_ISLNK(st.st_mode):
        raise OSError("refusing symlink: %s" % path)
    if not stat.S_ISREG(st.st_mode):
        raise OSError("not a regular file: %s" % path)


def read_text_nofollow(path: str) -> str:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags)
    try:
        data = os.read(fd, 4_000_000)
    finally:
        os.close(fd)
    return data.decode("utf-8")


def write_text_atomic(path: str, text: str) -> None:
    parent = os.path.dirname(path) or "."
    os.makedirs(parent, exist_ok=True)
    pst = os.lstat(parent)
    if stat.S_ISLNK(pst.st_mode):
        raise OSError("refusing symlink directory: %s" % parent)
    _refuse_symlink(path)
    fd, tmp = tempfile.mkstemp(prefix=".bindings.", suffix=".tmp", dir=parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        st = os.lstat(path)
        if stat.S_ISLNK(st.st_mode):
            raise OSError("refusing to leave a symlink at %s" % path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


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
    if os.path.islink(path):
        print("error: refusing symlink %s" % path, file=sys.stderr)
        return 1
    if os.path.isfile(path):
        text = read_text_nofollow(path)
    if remove:
        if text:
            write_text_atomic(path, strip_block(text, begin, end))
        print("ok")
        return 0
    block = sys.argv[2]
    write_text_atomic(path, write_block(text, begin, end, block))
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
