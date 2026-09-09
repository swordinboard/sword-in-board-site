#!/usr/bin/env python3
"""
Renames the product everywhere the name is written down.

    python3 scripts/rename-site.py "Cork Hold"

The current name is read from SITE_DEFAULT_NAME rather than hardcoded, so this
can be run again later to change from whatever the name is at the time.

It does NOT touch the logo artwork, which draws letterforms, or anything held
in Netlify's dashboard. Both are listed at the end of the run.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = Path(
    "/tmp/claude-0/-home-user-sword-in-board-site/"
    "2bb15a85-428c-5edc-9c12-219dc3ed1f58/scratchpad"
)


def flat(name: str) -> str:
    """corkhold — how the title guard and the password index compare names."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def kebab(name: str) -> str:
    """cork-hold — how a password would plausibly be typed."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def current_name() -> str:
    types = (ROOT / "shared" / "types.ts").read_text()
    match = re.search(r"export const SITE_DEFAULT_NAME = '([^']+)'", types)
    if not match:
        sys.exit("Could not find SITE_DEFAULT_NAME in shared/types.ts.")
    return match.group(1)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        sys.exit('Usage: rename-site.py "New Name"')

    new = " ".join(sys.argv[1].split())
    old = current_name()
    if new == old:
        sys.exit(f"Already called {new}.")

    old_flat, new_flat = flat(old), flat(new)
    old_kebab, new_kebab = kebab(old), kebab(new)
    old_first = old.split()[0].lower()
    new_first = new.split()[0].lower()

    changed: list[str] = []

    def edit(path: Path, subs: list[tuple[str, str]], label: str) -> None:
        if not path.exists():
            return
        text = original = path.read_text()
        for find, repl in subs:
            text = text.replace(find, repl)
        if text != original:
            path.write_text(text)
            changed.append(label)

    # The display name, in prose and in markup.
    plain = [(old, new)]
    for rel, label in [
        ("shared/types.ts", "shared/types.ts (SITE_DEFAULT_NAME)"),
        ("index.html", "index.html (<title>)"),
        ("netlify.toml", "netlify.toml (comment)"),
        ("netlify/functions/_lib/naming.ts", "naming.ts (comment)"),
        ("README.md", "README.md"),
        ("public/favicon.svg", "public/favicon.svg (title, aria-label)"),
        ("public/logo.svg", "public/logo.svg (title, aria-label)"),
        ("public/logo-light.svg", "public/logo-light.svg (title, aria-label)"),
    ]:
        edit(ROOT / rel, plain, label)

    # The package name, which is kebab-cased rather than spelled out.
    for rel in ["package.json", "package-lock.json"]:
        edit(ROOT / rel, [(f'"{old_kebab}"', f'"{new_kebab}"')], rel)

    # Reserved passwords. Only the name-derived entries move; the generic ones
    # (board, boards, admin, welcome...) are reserved on their own merits.
    types_path = ROOT / "shared" / "types.ts"
    types = types_path.read_text()
    for find, repl in [
        (f"'{old_first}'", f"'{new_first}'"),
        (f"'{old_flat}'", f"'{new_flat}'"),
        (f"'{old_kebab}'", f"'{new_kebab}'"),
    ]:
        if find in types:
            types = types.replace(find, repl)
    types_path.write_text(types)
    changed.append("shared/types.ts (RESERVED_PASSWORDS)")

    # The test suites assert against the name in a dozen places.
    if SCRATCH.exists():
        for path in sorted(SCRATCH.glob("*.mjs")):
            edit(path, plain, f"scratchpad/{path.name}")

    print(f"{old}  ->  {new}\n")
    for label in dict.fromkeys(changed):
        print(f"  changed  {label}")

    print(f"""
Left to do by hand:

  1. The logo. public/logo.svg draws two letter B's as vector paths and
     favicon.svg draws one. If "{new}" does not start with those letters the
     drawing is wrong, whatever the alt text now says. icon-180.png is a
     bitmap and cannot be edited by script at all.

  2. Netlify, on the site's dashboard:
       SITE_NAME       = {new}
       VITE_SITE_NAME  = {new}
     VITE_SITE_NAME is baked in at build time, so it needs a redeploy.
     Neither is required — both fall back to SITE_DEFAULT_NAME, which this
     script has already changed — but leaving a stale value set would override
     the new name and look like the rename failed.

  3. The site name and subdomain in Netlify, and any DNS record pointing at it.

  4. Anyone holding a password that was the old name still gets in: passwords
     are stored, not derived from the name. Reserving "{new_flat}" only stops
     it being taken from now on.
""")


if __name__ == "__main__":
    main()
