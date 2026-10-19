---
name: Find Missing Diagrams
description: Use when checking the pele-azure-diagrams repo for missing, stale, or orphaned diagrams - for example before committing, after editing a diagram source, or when asked which diagrams need rendering. Checks your diagrams under diagrams/ and reports any .mmd whose .svg, .flat.svg, or .png is missing or out of date.
---

# Find Missing Diagrams

Your diagrams live in `diagrams/`, one folder per diagram (see `README.md`):

```text
diagrams/<id>/<id>.mmd        source (Mermaid + Azure icons)
diagrams/<id>/<id>.svg        rendered, themable (Pele CSS variables)
diagrams/<id>/<id>.flat.svg   rendered, colors inlined
diagrams/<id>/<id>.png        raster preview
```

A diagram is **complete** only when all four files exist and the three rendered
outputs are newer than the `.mmd` source.

`examples/diagrams/` is documentation (the README image and its source), not a
check target.

## Run the check

From the repo root:

```sh
.opencode/skills/find-missing-diagrams/scripts/find-missing-diagrams.sh
```

It scans `diagrams/`, prints nothing extra, and exits `0` when every diagram is
complete and fresh. Otherwise it lists the problems and exits `1`:

- **missing outputs** — a `.mmd` (or a required output) has no counterpart.
- **stale outputs** — the `.mmd` is newer than the render; re-render it.
- **orphan outputs** — an `.svg`/`.flat.svg`/`.png` has no matching `.mmd`.
- **stray `.mmd` outside the known roots** — the source is not in a per-diagram folder.

Pass one or more roots to check something else, for example
`... scripts/find-missing-diagrams.sh examples/diagrams`.

## Fix

Re-render the affected diagram by id:

```sh
node render-azure.js azure-vnet
```

Or re-render everything under `diagrams/`:

```sh
node render-azure.js
```

Then run the check again. For a new diagram, create `diagrams/<id>/<id>.mmd`
first, then render; the renderer writes the other three files beside the source.

To base a diagram on the shipped example, copy it into `diagrams/` and edit the
copy. Do not hand-edit rendered files; to change a diagram, edit its `.mmd` and
re-render. The only reason to touch `examples/` is to refresh the README image:

```sh
node render-azure.js --png examples/diagrams/azure-vnet/azure-vnet.mmd
```
