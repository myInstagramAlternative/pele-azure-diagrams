#!/usr/bin/env bash
# Report Azure diagrams that are incomplete or out of date.
#
# Convention (see README.md): every diagram lives in its own folder.
#
#   diagrams/<id>/<id>.mmd        required source
#   diagrams/<id>/<id>.svg        required output
#   diagrams/<id>/<id>.flat.svg   required output
#   diagrams/<id>/<id>.png        required output
#
# Reports:
#   missing  - a .mmd has no rendered output (or a required output is absent)
#   stale    - an output is older than its .mmd (re-render needed)
#   orphan   - an output has no matching .mmd
#   stray    - a .mmd lives outside diagrams/
#
# Exit status: 0 when everything is complete and fresh, 1 otherwise.
#
# Usage:
#   scripts/find-missing-diagrams.sh [diagrams-dir]
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)"; then
  root="$(cd "$script_dir/../../../.." && pwd)"
fi

diagrams="${1:-$root/diagrams}"

rel() { printf '%s' "${1#"$root"/}"; }

missing=()
stale=()
orphan=()
stray=()

shopt -s nullglob

if [[ -d "$diagrams" ]]; then
  for mmd in "$diagrams"/*/*.mmd; do
    dir="$(dirname "$mmd")"
    id="$(basename "$mmd" .mmd)"
    for ext in svg flat.svg png; do
      out="$dir/$id.$ext"
      if [[ ! -f "$out" ]]; then
        missing+=("$(rel "$out")")
      elif [[ "$out" -ot "$mmd" ]]; then
        stale+=("$(rel "$out")")
      fi
    done
  done

  # Outputs without a matching <id>.mmd.
  for out in "$diagrams"/*/*.svg "$diagrams"/*/*.png; do
    dir="$(dirname "$out")"
    base="$(basename "$out")"
    id="${base%.flat.svg}"; id="${id%.svg}"; id="${id%.png}"
    if [[ ! -f "$dir/$id.mmd" ]]; then
      orphan+=("$(rel "$out")")
    fi
  done
fi

# Sources outside diagrams/ (ignore dependencies and VCS metadata).
while IFS= read -r -d '' file; do
  stray+=("$(rel "$file")")
done < <(find "$root" \
  \( -path "$root/.git" -o -name node_modules -o -path "$root/diagrams" \) -prune -o \
  -name '*.mmd' -type f -print0 2>/dev/null)

total=0
if [[ -d "$diagrams" ]]; then
  for mmd in "$diagrams"/*/*.mmd; do
    total=$((total + 1))
  done
fi

report() {
  local title="$1"
  shift
  if (($# > 0)); then
    printf '\n%s\n' "$title"
    printf '  %s\n' "$@"
  fi
}

if ((${#missing[@]} || ${#stale[@]} || ${#orphan[@]} || ${#stray[@]})); then
  report "missing outputs:" "${missing[@]}"
  report "stale outputs (source is newer):" "${stale[@]}"
  report "orphan outputs (no .mmd):" "${orphan[@]}"
  report "stray .mmd outside diagrams/:" "${stray[@]}"
  printf '\nRe-render with: node render-azure.js <diagram-id>\n'
  exit 1
fi

printf 'All %d diagram(s) complete and up to date.\n' "$total"
