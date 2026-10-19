#!/usr/bin/env node
/**
 * Render Azure architecture diagrams with Pele + local Microsoft Azure icons.
 *
 * Every diagram lives in its own folder under diagrams/:
 *
 *   diagrams/<id>/<id>.mmd        source (Mermaid, Pele syntax)
 *   diagrams/<id>/<id>.svg        rendered, uses Pele CSS variables (themable)
 *   diagrams/<id>/<id>.flat.svg   rendered, colors inlined (standalone)
 *   diagrams/<id>/<id>.png        raster preview
 *
 * Usage:
 *   node render-azure.js              # render every diagram in diagrams/
 *   node render-azure.js azure-vnet   # render only diagrams/azure-vnet/
 *
 * Icons are read from azure-icons/ and mapped by the `azure:*` names used in
 * the diagram source. Add an entry to `files` when you add a new icon.
 */
const fs = require('fs');
const path = require('path');
const { render, PeleError } = require('pele');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = __dirname;
const ICON_DIR = path.join(ROOT, 'azure-icons');
const DIAGRAMS_DIR = path.join(ROOT, 'diagrams');

// Icon name -> file in azure-icons/. Names are arbitrary; `azure:` is a prefix,
// not a namespace Pele knows about, so any missing name is handed to this resolver.
const files = {
  'azure:vnet': 'vnet.svg',
  'azure:cloudpc': 'wvd.svg',
  'azure:private-endpoint': 'private-endpoint.svg',
  'azure:public-ip': 'public-ip.svg',
  'azure:container-apps': 'container-apps.svg',
  'azure:firewall': 'firewall.svg',
  'azure:sql': 'sql.svg',
  'azure:storage': 'storage.svg',
  'azure:acr': 'acr.svg',
  'azure:keyvault': 'keyvault.svg',
  'azure:nsg': 'nsg.svg',
  'azure:route-table': 'route-table.svg',
};

// Line glyphs for things Azure has no product icon for. Drawn on a 24x24 grid.
const custom = {
  users: `<g fill="none" stroke="#1f1f1f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></g>`,
  internet: `<g fill="none" stroke="#1f1f1f" stroke-width="1.5" stroke-linecap="round">
    <circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.6 2.4 4 5.3 4 8.6s-1.4 6.2-4 8.6c-2.6-2.4-4-5.3-4-8.6s1.4-6.2 4-8.6z"/></g>`,
};

const iconCache = new Map();

/** Pele icon resolver: turn `azure:sql` into scaled SVG markup for the 24x24 slot. */
function icons(name) {
  if (custom[name]) return custom[name];
  const file = files[name];
  if (!file) return null; // unknown names fall back to Pele's built-in glyphs
  if (iconCache.has(name)) return iconCache.get(name);

  let svg = fs.readFileSync(path.join(ICON_DIR, file), 'utf8');
  const vb = (svg.match(/viewBox\s*=\s*["']([^"']+)["']/) || [])[1];
  if (!vb) throw new Error(`No viewBox in azure-icons/${file}`);
  const [, , w, h] = vb.split(/\s+/).map(Number);
  const scale = 24 / Math.max(w, h);

  // Strip the outer <svg> and scale the artwork into Pele's 24x24 icon slot.
  // Namespace ids per icon so gradients from different icons cannot collide.
  const ns = 'ic-' + name.replace(/[^a-z0-9]+/gi, '-');
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  inner = inner
    .replace(/id="([^"]+)"/g, `id="${ns}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${ns}-$1)`)
    .replace(/xlink:href="#([^"]+)"/g, `xlink:href="#${ns}-$1"`)
    .replace(/href="#([^"]+)"/g, `href="#${ns}-$1"`);

  const tx = (24 - w * scale) / 2;
  const ty = (24 - h * scale) / 2;
  const markup = `<g transform="translate(${tx} ${ty}) scale(${scale})" stroke="none">${inner}</g>`;
  iconCache.set(name, markup);
  return markup;
}

/**
 * resvg does not resolve CSS custom properties. Inline Pele's defaults so the
 * standalone .flat.svg and .png look the same as the themable SVG in a browser.
 */
function flatten(svg) {
  return svg
    .replace(/var\(--pele-[a-z-]+,([^)]+)\)/g, '$1')
    .replace(/var\(--_bg\)/g, '#ffffff')
    .replace(/var\(--_fg\)/g, '#1f1f1f')
    .replace(/var\(--_m\)/g, '#6e6e6e')
    .replace(/var\(--_l\)/g, '#1f1f1f')
    .replace(/var\(--_s\)/g, '#f3f3f3')
    .replace(/var\(--_a\)/g, '#e6e6e6')
    .replace(/var\(--_b\)/g, '#8a8a8a')
    .replace(/var\(--_c\)/g, '#5b7bd5')
    .replace(/var\(--_r\)/g, '4px');
}

/**
 * Render diagram source and write the outputs into `folder`:
 * `<id>.svg`, `<id>.flat.svg`, and `<id>.png`. Returns Pele's result.
 */
function renderSource(source, folder, id) {
  const result = render(source, { icons });
  fs.writeFileSync(path.join(folder, `${id}.svg`), result.svg);

  const flat = flatten(result.svg);
  fs.writeFileSync(path.join(folder, `${id}.flat.svg`), flat);

  const png = new Resvg(flat, {
    fitTo: { mode: 'width', value: Math.min(result.width * 2, 2000) },
    background: 'white',
  })
    .render()
    .asPng();
  fs.writeFileSync(path.join(folder, `${id}.png`), png);

  console.log(`rendered ${id} (${result.type}, ${result.width}x${result.height})`);
  return result;
}

function renderOne(mmdPath) {
  const source = fs.readFileSync(mmdPath, 'utf8');
  const folder = path.dirname(mmdPath);
  const id = path.basename(mmdPath, '.mmd');

  // Convention: diagrams/<id>/<id>.mmd. Warn (do not fail) when it drifts.
  if (path.basename(folder) !== id) {
    console.warn(`warning: ${path.relative(ROOT, mmdPath)} is not in a folder named "${id}"`);
  }
  return renderSource(source, folder, id);
}

/** Resolve CLI arguments to .mmd files: ids, folders, or explicit paths. */
function targets(args) {
  if (args.length === 0) {
    if (!fs.existsSync(DIAGRAMS_DIR)) return [];
    return fs
      .readdirSync(DIAGRAMS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(DIAGRAMS_DIR, entry.name, `${entry.name}.mmd`))
      .filter((file) => fs.existsSync(file))
      .sort();
  }
  return args.map((arg) => {
    const asPath = path.resolve(ROOT, arg);
    if (fs.existsSync(asPath) && fs.statSync(asPath).isDirectory()) {
      const id = path.basename(asPath);
      return path.join(asPath, `${id}.mmd`);
    }
    if (fs.existsSync(asPath) && asPath.endsWith('.mmd')) return asPath;
    return path.join(DIAGRAMS_DIR, arg, `${arg}.mmd`);
  });
}

function main(args) {
  const list = targets(args);
  if (list.length === 0) {
    console.error('No diagrams found. Add diagrams/<id>/<id>.mmd, or pass a diagram id.');
    return 1;
  }

  let failed = 0;
  for (const mmd of list) {
    if (!fs.existsSync(mmd)) {
      console.error(`missing: ${path.relative(ROOT, mmd)}`);
      failed++;
      continue;
    }
    try {
      renderOne(mmd);
    } catch (error) {
      failed++;
      if (error instanceof PeleError) {
        console.error(`failed ${path.basename(mmd)}: ${error.message}`);
      } else {
        console.error(`failed ${path.basename(mmd)}:`, error);
      }
    }
  }
  return failed === 0 ? 0 : 1;
}

module.exports = { icons, flatten, renderSource, renderOne, targets };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
