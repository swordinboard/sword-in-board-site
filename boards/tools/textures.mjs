/**
 * The procedural sources for the board textures, and the script that bakes
 * them.
 *
 * These used to live in board.css as inline SVG. An feTurbulence filter is
 * re-run every time the element is drawn at a new scale, and at these tile
 * sizes that cost hundreds of milliseconds a frame: a pinch on a filtered
 * board ran at roughly 3fps against 60 on the one preset that had no filters.
 * So the filters produce bitmaps now, once, here - and the stylesheet points
 * at the bitmaps.
 *
 * They are still the source of truth for how each texture looks. Change one
 * and re-run this; do not hand-edit a png.
 *
 *   node tools/textures.mjs            # rewrites public/tex/*.png
 *
 * The bake needs playwright, which is deliberately not a dependency of this
 * package: the bitmaps are committed, so nobody installs a browser driver to
 * build or run the site. Only somebody changing a texture runs this.
 *
 * `scale` is how much of the tile's own resolution the bitmap is baked at.
 * Textures carrying hard edges - cork's granules, rust, the paint wear - are
 * baked close to full, because the edges are the point. Smooth clouding is
 * baked small and stretched back up, because nobody can see the difference
 * and the difference is megabytes: the grime tile is 6.5MB at full size and
 * 131KB at the size it is baked.
 *
 * `width` and `height` are the filter's own tile - the extent the noise is
 * generated and stitched across, which is what decides the pattern. `drawn`
 * overrides the size that tile is painted at in the stylesheet, which is how a
 * texture gets sharper without getting heavier: the leather grain is the same
 * 490px file either way, drawn across 980px rather than 1960px, so it upscales
 * twice rather than four times. board.css states the drawn size in the same
 * declaration as the url, so the two cannot drift apart.
 */

/**
 * The hazard stripes on the industrial frame, with the paint already chipped.
 *
 * The wear used to be a mask over the whole frame pseudo-element, and masking
 * an element the size of a board costs about 10ms a frame even when the paint
 * it eats into covers a few percent of it. Baked in, the marks are two flat
 * bitmaps and the mask goes away.
 */
function hazard(width, height, angle) {
  const worn = TEXTURES.find((t) => t.name === 'tex-worn');
  return `<div style="width:${width}px;height:${height}px;
    background:repeating-linear-gradient(${angle}deg,#d2a91f 0 34px,transparent 34px 72px);
    -webkit-mask-image:url(&quot;data:image/svg+xml,${encodeURIComponent(worn.svg)}&quot;);
    mask-image:url(&quot;data:image/svg+xml,${encodeURIComponent(worn.svg)}&quot;);
    -webkit-mask-size:900px 900px;mask-size:900px 900px"></div>`;
}

export const TEXTURES = [
  {
    name: "tex-cork",
    width: 1587,
    height: 1587,
    scale: 1,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1587' height='1587'><filter id='k' x='0' y='0' width='1587' height='1587' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0182' numOctaves='3' stitchTiles='stitch' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 0.38 0 0 0 0 0.23 0 0 0 0 0.09 0.95 0.75 0.45 0 -0.42'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0.16 0.06 0.30 0.10 0.38 0.02 0.22'/></feComponentTransfer></filter><rect width='1587' height='1587' filter='url(#k)'/></svg>",
  },
  {
    name: "tex-mottle",
    width: 2800,
    height: 2800,
    scale: 0.12,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2800' height='2800'><filter id='g' x='0' y='0' width='2800' height='2800' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00257' numOctaves='3' stitchTiles='stitch' seed='5'/><feColorMatrix type='matrix' values='0 0 0 0 0.28 0 0 0 0 0.16 0 0 0 0 0.06 0.5 0.4 0.3 0 -0.42'/></filter><rect width='2800' height='2800' filter='url(#g)'/></svg>",
  },
  {
    name: "tex-wood",
    width: 1867,
    height: 653,
    scale: 0.4,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1867' height='653'><filter id='w' x='0' y='0' width='1867' height='653' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00129 0.1071' numOctaves='4' stitchTiles='stitch' seed='3'/><feColorMatrix type='matrix' values='0 0 0 0 0.16 0 0 0 0 0.09 0 0 0 0 0.03 0.6 0.5 0.4 0 -0.32'/></filter><rect width='1867' height='653' filter='url(#w)'/></svg>",
  },
  {
    name: "tex-wipe",
    width: 420,
    height: 300,
    scale: 1,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300'><filter id='v' x='0' y='0' width='420' height='300' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.09' numOctaves='2' stitchTiles='stitch' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 0.42 0 0 0 0 0.46 0 0 0 0 0.52 0.5 0.4 0.3 0 -0.58'/></filter><rect width='420' height='300' filter='url(#v)'/></svg>",
  },
  {
    name: "tex-rust",
    width: 2987,
    height: 2987,
    scale: 0.55,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2987' height='2987'><filter id='r' x='0' y='0' width='2987' height='2987' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0161' numOctaves='5' stitchTiles='stitch' seed='13'/><feColorMatrix type='matrix' values='0 0 0 0 0.44 0 0 0 0 0.21 0 0 0 0 0.07 0.8 0.55 0.3 0 -0.62'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0 0.09 0 0.05 0.13 0 0.06'/></feComponentTransfer></filter><rect width='2987' height='2987' filter='url(#r)'/></svg>",
  },
  {
    name: "tex-plank",
    width: 1493,
    height: 2987,
    scale: 0.3,
    drawn: [1120, 2240],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1493' height='2987'><filter id='q' x='0' y='0' width='1493' height='2987' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.03 0.00107' numOctaves='4' stitchTiles='stitch' seed='4'/><feColorMatrix type='matrix' values='0 0 0 0 0.13 0 0 0 0 0.07 0 0 0 0 0.02 0.85 0.6 0.35 0 -0.30'/></filter><rect width='1493' height='2987' filter='url(#q)'/></svg>",
  },
  {
    name: "tex-hide",
    width: 1960,
    height: 1960,
    scale: 0.25,
    drawn: [980, 980],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1960' height='1960'><filter id='d' x='0' y='0' width='1960' height='1960' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0236' numOctaves='4' stitchTiles='stitch' seed='23'/><feColorMatrix type='matrix' values='0 0 0 0 0.34 0 0 0 0 0.24 0 0 0 0 0.13 0.5 0.4 0.28 0 -0.30'/></filter><rect width='1960' height='1960' filter='url(#d)'/></svg>",
  },
  {
    name: "tex-grime",
    width: 2800,
    height: 2800,
    scale: 0.15,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2800' height='2800'><filter id='m' x='0' y='0' width='2800' height='2800' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00257' numOctaves='3' stitchTiles='stitch' seed='11'/><feColorMatrix type='matrix' values='0 0 0 0 0.2 0 0 0 0 0.22 0 0 0 0 0.22 0.5 0.4 0.3 0 -0.42'/></filter><rect width='2800' height='2800' filter='url(#m)'/></svg>",
  },
  {
    name: "tex-worn",
    width: 900,
    height: 900,
    scale: 1,
    // Only a mask for the hazard bake below; never shipped on its own.
    internal: true,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='n' x='0' y='0' width='900' height='900' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.055' numOctaves='4' stitchTiles='stitch' seed='29'/><feColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.9 0.7 0.4 0 0.12'/><feComponentTransfer><feFuncA type='discrete' tableValues='1 1 0 1 1 1 0 1'/></feComponentTransfer></filter><rect width='900' height='900' filter='url(#n)'/></svg>",
  },
  {
    name: "tex-paper",
    width: 180,
    height: 180,
    scale: 1,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='p' x='0' y='0' width='180' height='180' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch' seed='2'/><feColorMatrix type='matrix' values='0 0 0 0 0.4 0 0 0 0 0.36 0 0 0 0 0.28 0.16 0.14 0.1 0 -0.09'/></filter><rect width='180' height='180' filter='url(#p)'/></svg>",
  }
];

/* Drawn from CSS rather than a filter, but baked for the same reason. */
export const COMPOSED = [
  { name: 'hazard-h', width: 1500, height: 100, scale: 1, get html() { return hazard(1500, 100, 45); } },
  { name: 'hazard-v', width: 100, height: 1000, scale: 1, get html() { return hazard(100, 1000, -45); } },
];

/* Everything below only runs when this file is run directly. */
if (import.meta.url === `file://${process.argv[1]}`) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('This needs playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
  const { writeFileSync, mkdirSync, statSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'tex');
  mkdirSync(out, { recursive: true });
  // PLAYWRIGHT_CHROMIUM lets a sandbox point at a browser it already has.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  );
  for (const tex of [...TEXTURES, ...COMPOSED]) {
    if (tex.internal) continue;
    const w = Math.round(tex.width * tex.scale);
    const h = Math.round(tex.height * tex.scale);
    // Drawn at the baked size rather than cropped to it, so a reduced bake is
    // the same picture at fewer pixels.
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg,div{display:block;width:${w}px;height:${h}px}</style>${tex.svg ?? tex.html}`,
    );
    await page.waitForTimeout(120);
    // Transparent: every one of these is a single colour over varying alpha.
    writeFileSync(join(out, `${tex.name}.png`), await page.screenshot({ omitBackground: true }));
    await page.close();
    const kb = (statSync(join(out, `${tex.name}.png`)).size / 1024).toFixed(0);
    const [dw, dh] = tex.drawn ?? [tex.width, tex.height];
    console.log(`${tex.name.padEnd(12)} drawn ${dw}x${dh}  baked ${w}x${h}  ${kb} KB`);
  }
  await browser.close();
}
