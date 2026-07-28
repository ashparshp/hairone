#!/bin/sh
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
hook_src="$root/scripts/git-hooks/prepare-commit-msg"
hook_dst="$root/.git/hooks/prepare-commit-msg"

if [ ! -d "$root/.git" ]; then
  echo "Not a git repository: $root" >&2
  exit 1
fi

cp "$hook_src" "$hook_dst"
chmod +x "$hook_dst"
echo "Installed prepare-commit-msg hook -> $hook_dst"
