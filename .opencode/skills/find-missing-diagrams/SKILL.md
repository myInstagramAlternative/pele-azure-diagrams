---
name: Find Missing Diagrams
description: Use when checking the pele-azure-diagrams repo for missing, stale, or orphaned diagrams - for example before committing, after editing a diagram source, or when asked which diagrams need rendering. Reports diagrams whose .mmd source has no up-to-date .svg, .flat.svg, or .png.
---

# Find Missing Diagrams

This repo keeps every diagram in its own folder (see `README.md`):

```text
diagrams/<id>/<id>.mmd        source (Mermaid + Azure icons)
diagrams/<id>/<id>.svg        rendered, themable (Pele CSS variables)
diagrams/<id>/<id>.flat.svg   rendered, colors inlined
diagrams/<id>/<id>.png        raster preview
```

A diagram is **complete** only when all four files exist and the three rendered
outputs are newer than the `.mmd` source.

## Run the check

From the repo root:

```sh
.opencode/skills/find-missing-diagrams/scripts/find-missing-diagrams.sh
```

It prints nothing extra and exits `0` when every diagram is complete and fresh.
Otherwise it lists the problems and exits `1`:

- **missing outputs** — a `.mmd` (or a required output) has no counterpart.
- **stale outputs** — the `.mmd` is newer than the render; re-render it.
- **orphan outputs** — an `.svg`/`.flat.svg`/`.png` has no matching `.mmd`.
- **stray `.mmd` outside `diagrams/`** — the source is not in a per-diagram folder.

Pass a different diagrams directory as the first argument if needed.

## Fix

Re-render the affected diagram by id:

```sh
node render-azure.js azure-vnet
```

Or re-render everything:

```sh
node render-azure.js
```

Then run the check again. For a new diagram, create the folder and source first
(`diagrams/<id>/<id>.mmd`), then render; the renderer writes the other three
files beside the source.

Do not hand-edit rendered files. To change a diagram, edit its `.mmd` and
re-render.
