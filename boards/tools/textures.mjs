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
 * `scale` is how much of the tile's own resolution the bitmap is baked at,
 * either one number or a [x, y] pair. The pair matters for the frame bands:
 * wood grain runs 775px along a length of moulding and 9px across it, so the
 * across dimension needs every pixel it has and the along dimension needs
 * almost none. Baking both down together washes the grain out; baking them
 * separately keeps it and still costs a quarter of the bytes.
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
    // Only an input to a board surface; never shipped on its own.
    internal: true,
    scale: 1,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1587' height='1587'><filter id='k' x='0' y='0' width='1587' height='1587' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0182' numOctaves='3' stitchTiles='stitch' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 0.38 0 0 0 0 0.23 0 0 0 0 0.09 0.95 0.75 0.45 0 -0.42'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0.16 0.06 0.30 0.10 0.38 0.02 0.22'/></feComponentTransfer></filter><rect width='1587' height='1587' filter='url(#k)'/></svg>",
  },
  {
    name: "tex-mottle",
    width: 2800,
    height: 2800,
    // Only an input to a board surface; never shipped on its own.
    internal: true,
    scale: 0.12,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2800' height='2800'><filter id='g' x='0' y='0' width='2800' height='2800' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00257' numOctaves='3' stitchTiles='stitch' seed='5'/><feColorMatrix type='matrix' values='0 0 0 0 0.28 0 0 0 0 0.16 0 0 0 0 0.06 0.5 0.4 0.3 0 -0.42'/></filter><rect width='2800' height='2800' filter='url(#g)'/></svg>",
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
    // Only an input to a board surface; never shipped on its own.
    internal: true,
    scale: 0.55,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2987' height='2987'><filter id='r' x='0' y='0' width='2987' height='2987' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0161' numOctaves='5' stitchTiles='stitch' seed='13'/><feColorMatrix type='matrix' values='0 0 0 0 0.44 0 0 0 0 0.21 0 0 0 0 0.07 0.8 0.55 0.3 0 -0.62'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0 0.09 0 0.05 0.13 0 0.06'/></feComponentTransfer></filter><rect width='2987' height='2987' filter='url(#r)'/></svg>",
  },
  {
    name: "tex-plank",
    width: 1493,
    height: 2987,
    // Only an input to a board surface; never shipped on its own.
    internal: true,
    scale: 0.3,
    drawn: [1120, 2240],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1493' height='2987'><filter id='q' x='0' y='0' width='1493' height='2987' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.03 0.00107' numOctaves='4' stitchTiles='stitch' seed='4'/><feColorMatrix type='matrix' values='0 0 0 0 0.13 0 0 0 0 0.07 0 0 0 0 0.02 0.85 0.6 0.35 0 -0.30'/></filter><rect width='1493' height='2987' filter='url(#q)'/></svg>",
  },
  {
    name: "tex-hide",
    width: 1960,
    height: 1960,
    // Only an input to a board surface; never shipped on its own.
    internal: true,
    scale: 0.25,
    drawn: [980, 980],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1960' height='1960'><filter id='d' x='0' y='0' width='1960' height='1960' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.0236' numOctaves='4' stitchTiles='stitch' seed='23'/><feColorMatrix type='matrix' values='0 0 0 0 0.34 0 0 0 0 0.24 0 0 0 0 0.13 0.5 0.4 0.28 0 -0.30'/></filter><rect width='1960' height='1960' filter='url(#d)'/></svg>",
  },
  {
    name: "tex-grime",
    width: 2800,
    height: 2800,
    // Only an input to a board surface; never shipped on its own.
    internal: true,
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
  },


  /* Brushed steel, drawn the length of each side the same way. */
  {
    name: "frame-steel-rail",
    width: 1200,
    height: 100,
    scale: [0.25, 1],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='100'><filter id='sa' x='0' y='0' width='1200' height='100' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.002 0.09' numOctaves='3' stitchTiles='stitch' seed='19'/><feColorMatrix type='matrix' values='0 0 0 0 0.1 0 0 0 0 0.11 0 0 0 0 0.11 0.6 0.5 0.35 0 -0.34'/></filter><rect width='1200' height='100' filter='url(#sa)'/></svg>",
  },
  {
    name: "frame-steel-stile",
    width: 100,
    height: 1200,
    scale: [1, 0.25],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='1200'><filter id='sb' x='0' y='0' width='100' height='1200' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.09 0.002' numOctaves='3' stitchTiles='stitch' seed='19'/><feColorMatrix type='matrix' values='0 0 0 0 0.1 0 0 0 0 0.11 0 0 0 0 0.11 0.6 0.5 0.35 0 -0.34'/></filter><rect width='100' height='1200' filter='url(#sb)'/></svg>",
  },
  /*
   * The frame, as four lengths of moulding rather than one sheet.
   *
   * A board is cut from a length with the grain running down it, so the grain
   * on each side of a frame runs along that side. One texture over the whole
   * frame gives all four sides the same direction, which is right on two of
   * them and reads as veneer on the other two. These are the same filters as
   * the wood and plank they belong to, with the two baseFrequency terms
   * swapped for the uprights, and cropped to the depth of the frame.
   */
  {
    name: "frame-wood-rail",
    width: 1867,
    height: 100,
    scale: [0.25, 1],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='1867' height='100'><filter id='fa' x='0' y='0' width='1867' height='100' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00129 0.1071' numOctaves='4' stitchTiles='stitch' seed='3'/><feColorMatrix type='matrix' values='0 0 0 0 0.16 0 0 0 0 0.09 0 0 0 0 0.03 0.6 0.5 0.4 0 -0.32'/></filter><rect width='1867' height='100' filter='url(#fa)'/></svg>",
  },
  {
    name: "frame-wood-stile",
    width: 100,
    height: 1867,
    scale: [1, 0.25],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='1867'><filter id='fb' x='0' y='0' width='100' height='1867' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.1071 0.00129' numOctaves='4' stitchTiles='stitch' seed='3'/><feColorMatrix type='matrix' values='0 0 0 0 0.16 0 0 0 0 0.09 0 0 0 0 0.03 0.6 0.5 0.4 0 -0.32'/></filter><rect width='100' height='1867' filter='url(#fb)'/></svg>",
  },
  {
    name: "frame-plank-rail",
    width: 2240,
    height: 100,
    scale: [0.25, 1],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='2240' height='100'><filter id='fc' x='0' y='0' width='2240' height='100' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.00107 0.03' numOctaves='4' stitchTiles='stitch' seed='3'/><feColorMatrix type='matrix' values='0 0 0 0 0.13 0 0 0 0 0.07 0 0 0 0 0.02 0.85 0.6 0.35 0 -0.30'/></filter><rect width='2240' height='100' filter='url(#fc)'/></svg>",
  },
  {
    name: "frame-plank-stile",
    width: 100,
    height: 2240,
    scale: [1, 0.25],
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='2240'><filter id='fd' x='0' y='0' width='100' height='2240' filterUnits='userSpaceOnUse'><feTurbulence type='fractalNoise' baseFrequency='0.03 0.00107' numOctaves='4' stitchTiles='stitch' seed='3'/><feColorMatrix type='matrix' values='0 0 0 0 0.13 0 0 0 0 0.07 0 0 0 0 0.02 0.85 0.6 0.35 0 -0.30'/></filter><rect width='100' height='2240' filter='url(#fd)'/></svg>",
  },
];

/* Drawn from CSS rather than a filter, but baked for the same reason. */
export const COMPOSED = [
  { name: 'hazard-h', width: 1500, height: 100, scale: 1, get html() { return hazard(1500, 100, 45); } },
  { name: 'hazard-v', width: 100, height: 1000, scale: 1, get html() { return hazard(100, 1000, -45); } },
];

/**
 * A board's whole surface, as one picture.
 *
 * These used to be a stack of CSS layers over a tiled texture, and a tiled
 * background inside a scaled transform seams: the browser samples each tile
 * independently, so every join shows as a hard edge. Measured at the zooms a
 * phone uses, a tile seams whether it is upscaled or drawn at 1:1 - so a
 * better tile was never going to fix it. One picture that never repeats has
 * no joins to show.
 *
 * Each is square, at the board's larger dimension, and drawn with `cover`, so
 * one file serves a landscape board, a portrait one, and any size in between
 * without stretching. They are opaque and baked over the base colour, which
 * lets them be jpeg: the noise these are made of is what makes a png large,
 * and a jpeg of it is a quarter of the size at a quality nobody can see past.
 *
 * The stack that produces each one lives here now and nowhere else, so there
 * is no second copy in the stylesheet to drift from it.
 */
const BOARD = 4200;

export const SURFACES = [
  {
    name: 'surface-cork',
    base: '#c69a63',
    layers: `{tex-cork}`,
  },
  {
    name: 'surface-medieval',
    base: '#3a2814',
    layers: `
      repeating-linear-gradient(90deg, transparent 0 616px,
        rgba(8, 4, 1, 0.55) 616px 639px, rgba(120, 92, 56, 0.07) 639px 667px),
      repeating-linear-gradient(90deg, transparent 0 919px, rgba(8, 4, 1, 0.3) 919px 933px),
      repeating-linear-gradient(2deg, transparent 0 159px,
        rgba(255, 232, 190, 0.045) 159px 173px, rgba(10, 5, 1, 0.1) 173px 201px),
      {tex-plank}`,
  },
  {
    name: 'surface-western',
    base: '#c9a978',
    layers: `
      {tex-hide},
      radial-gradient(125% 100% at 50% 45%, rgba(255, 232, 186, 0.22), rgba(92, 62, 24, 0.14) 78%)`,
  },
  {
    name: 'surface-industrial',
    base: '#515553',
    layers: `
      {tex-rust},
      {tex-grime},
      linear-gradient(168deg, rgba(12, 14, 14, 0.4), transparent 40%, rgba(12, 14, 14, 0.45))`,
  },
  {
    name: 'surface-scifi',
    base: '#1e2c36',
    /*
     * A grid, and it has to be an even one, which means surviving two things
     * that eat thin lines: the bake halves everything, and jpeg is a lossy
     * codec that rings around a hard edge and drops it between blocks.
     *
     * A one pixel rule survived neither - half a pixel lands on one row and
     * misses the next, so some rules came through at half strength and the
     * horizontals vanished altogether. So the rule is six pixels here, three
     * in the bake, which is a feature a codec keeps; it is spaced twice as
     * far apart, so there is less of it to keep; and it carries a glow either
     * side, which puts most of its weight at low frequencies where jpeg is
     * at its best and hides the ringing that is left.
     */
    layers: `
      repeating-linear-gradient(0deg,
        transparent 0 30px,
        rgba(120, 200, 225, 0.04) 36px,
        rgba(120, 200, 225, 0.2) 39px,
        rgba(120, 200, 225, 0.2) 45px,
        rgba(120, 200, 225, 0.04) 48px,
        transparent 54px 84px),
      repeating-linear-gradient(90deg,
        transparent 0 30px,
        rgba(120, 200, 225, 0.04) 36px,
        rgba(120, 200, 225, 0.2) 39px,
        rgba(120, 200, 225, 0.2) 45px,
        rgba(120, 200, 225, 0.04) 48px,
        transparent 54px 84px)`,
  },
];

/* Everything below only runs when this file is run directly. */
/* ------------------------------------------------------------------ walls */

/**
 * What the board hangs on.
 *
 * Different from a board surface in one way that decides everything else:
 * a wall repeats. The stage is whatever size the screen is, so three of these
 * are tiles that have to wrap seamlessly at their own edges, and every motif
 * that touches an edge is drawn again on the opposite one.
 *
 * The door is the exception and is one picture, wide enough to include the
 * casing and some wall either side so that covering a landscape screen does
 * not crop it down to a band of panel edges.
 *
 * Drawn here rather than photographed, like everything else on this site:
 * nothing is owed to anyone for them, and they answer to the same bake.
 */
export const WALLS = [
  {
    name: 'wall-brick',
    tile: [480, 320],
    /*
     * Running bond: each course steps half a brick, so the tile is two
     * courses tall and one brick wide. The half bricks at the ends of the
     * offset course are the same brick split, which is what makes it wrap.
     */
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'>
      <defs>
        <filter id='grit' x='0' y='0' width='480' height='320' filterUnits='userSpaceOnUse'>
          <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch' seed='11'/>
          <feColorMatrix type='matrix' values='0 0 0 0 0.1 0 0 0 0 0.07 0 0 0 0 0.05 0.22 0.18 0.12 0 -0.05'/>
        </filter>
        <filter id='mottle' x='0' y='0' width='480' height='320' filterUnits='userSpaceOnUse'>
          <feTurbulence type='fractalNoise' baseFrequency='0.014' numOctaves='3' stitchTiles='stitch' seed='5'/>
          <feColorMatrix type='matrix' values='0 0 0 0 0.35 0 0 0 0 0.16 0 0 0 0 0.1 0.5 0.35 0.2 0 -0.22'/>
        </filter>
      </defs>
      <rect width='480' height='320' fill='#6e625a'/>
      <g fill='#9c5540'>
        <rect x='6' y='6' width='228' height='148' rx='3'/>
        <rect x='246' y='6' width='228' height='148' rx='3'/>
        <rect x='-114' y='166' width='228' height='148' rx='3'/>
        <rect x='126' y='166' width='228' height='148' rx='3'/>
        <rect x='366' y='166' width='228' height='148' rx='3'/>
      </g>
      <g fill='rgba(255,255,255,0.10)'>
        <rect x='6' y='6' width='228' height='5'/>
        <rect x='246' y='6' width='228' height='5'/>
        <rect x='-114' y='166' width='228' height='5'/>
        <rect x='126' y='166' width='228' height='5'/>
        <rect x='366' y='166' width='228' height='5'/>
      </g>
      <g fill='rgba(0,0,0,0.26)'>
        <rect x='6' y='148' width='228' height='6'/>
        <rect x='246' y='148' width='228' height='6'/>
        <rect x='-114' y='308' width='228' height='6'/>
        <rect x='126' y='308' width='228' height='6'/>
        <rect x='366' y='308' width='228' height='6'/>
      </g>
      <rect width='480' height='320' filter='url(#mottle)'/>
      <rect width='480' height='320' filter='url(#grit)'/>
    </svg>`,
  },
  {
    name: 'wall-plate',
    tile: [240, 240],
    /*
     * Diamond plate: pairs of raised treads, each pair turned the other way
     * from its neighbours, which is how the real stuff is rolled. Every tread
     * is drawn twice where it crosses an edge.
     */
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>
      <defs>
        <linearGradient id='tread' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stop-color='#b9bfc4'/>
          <stop offset='0.45' stop-color='#8d949a'/>
          <stop offset='1' stop-color='#5b6166'/>
        </linearGradient>
        <filter id='brush' x='0' y='0' width='240' height='240' filterUnits='userSpaceOnUse'>
          <feTurbulence type='fractalNoise' baseFrequency='0.006 0.75' numOctaves='3' stitchTiles='stitch' seed='17'/>
          <feColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.14 0.12 0.08 0 -0.02'/>
        </filter>
        <g id='bar'>
          <rect x='-36' y='-7' width='72' height='14' rx='6' fill='url(#tread)'/>
          <rect x='-36' y='-7' width='72' height='4' rx='2' fill='rgba(255,255,255,0.42)'/>
          <rect x='-36' y='3' width='72' height='4' rx='2' fill='rgba(0,0,0,0.36)'/>
        </g>
        <!-- Two treads side by side, not crossed: a pair of parallel bars is
             what is actually rolled into the plate. Crossing them makes an X,
             which is a different floor entirely. -->
        <g id='pair'>
          <use href='#bar' transform='translate(0 -13)'/>
          <use href='#bar' transform='translate(0 13)'/>
        </g>
      </defs>
      <rect width='240' height='240' fill='#7b8288'/>
      <rect width='240' height='240' filter='url(#brush)'/>
      <!-- A checkerboard of pairs, each turned the opposite way from its
           neighbours. That alternation is the whole pattern. -->
      <g>
        <use href='#pair' transform='translate(60 60) rotate(45)'/>
        <use href='#pair' transform='translate(180 60) rotate(-45)'/>
        <use href='#pair' transform='translate(60 180) rotate(-45)'/>
        <use href='#pair' transform='translate(180 180) rotate(45)'/>
      </g>
      <rect width='240' height='240' fill='url(#tread)' opacity='0.07'/>
    </svg>`,
  },
  {
    name: 'wall-floral',
    tile: [300, 300],
    /*
     * A five-petal rose on a stem, with two leaves, printed in a half-drop.
     *
     * Five petals and a stem on purpose. The first attempt was four petals at
     * ninety degrees with a curved tail off each one, and four arms bent the
     * same way around a centre is a swastika at a glance whatever it was
     * drawn as. Nothing with fourfold rotational symmetry and trailing arms
     * goes on a wall. An odd number of petals cannot make that shape, and a
     * stem gives the motif an up, which settles it further.
     */
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
      <defs>
        <filter id='paper' x='0' y='0' width='300' height='300' filterUnits='userSpaceOnUse'>
          <feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch' seed='3'/>
          <feColorMatrix type='matrix' values='0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 0 0.24 0.1 0.08 0.06 0 -0.02'/>
        </filter>
        <g id='petal5'>
          <g fill='#a9789b'>
            <ellipse cx='0' cy='-13' rx='7' ry='11'/>
            <ellipse cx='0' cy='-13' rx='7' ry='11' transform='rotate(72)'/>
            <ellipse cx='0' cy='-13' rx='7' ry='11' transform='rotate(144)'/>
            <ellipse cx='0' cy='-13' rx='7' ry='11' transform='rotate(216)'/>
            <ellipse cx='0' cy='-13' rx='7' ry='11' transform='rotate(288)'/>
          </g>
          <circle r='5' fill='#d8b25c'/>
        </g>
        <!-- One sprig: a flower, the stem it sits on, and a leaf either side. -->
        <g id='sprig'>
          <path d='M 0 0 Q 3 20 0 40' stroke='#6f8566' stroke-width='3' fill='none'/>
          <path d='M 0 16 Q -14 16 -18 28 Q -6 30 0 20 Z' fill='#7d9473'/>
          <path d='M 0 26 Q 13 26 17 37 Q 5 39 0 30 Z' fill='#6f8566'/>
          <use href='#petal5'/>
        </g>
      </defs>
      <rect width='300' height='300' fill='#e7ded0'/>
      <g fill='rgba(146,122,96,0.16)'>
        <rect x='-5' width='11' height='300'/>
        <rect x='70' width='11' height='300'/>
        <rect x='145' width='11' height='300'/>
        <rect x='220' width='11' height='300'/>
        <rect x='295' width='11' height='300'/>
      </g>
      <!-- A half-drop: the second column sits half a step down from the
           first, which is how a paper like this is actually printed and what
           stops the motifs reading as a grid. Anything crossing an edge is
           drawn again on the opposite one. -->
      <g>
        <use href='#sprig' transform='translate(40 28)'/>
        <use href='#sprig' transform='translate(190 28)'/>
        <use href='#sprig' transform='translate(115 103)'/>
        <use href='#sprig' transform='translate(265 103)'/>
        <use href='#sprig' transform='translate(40 178)'/>
        <use href='#sprig' transform='translate(190 178)'/>
        <use href='#sprig' transform='translate(115 253)'/>
        <use href='#sprig' transform='translate(265 253)'/>
        <use href='#sprig' transform='translate(-35 103)'/>
        <use href='#sprig' transform='translate(-35 253)'/>
      </g>
      <g fill='#b08fa6' opacity='0.42'>
        <circle cx='115' cy='40' r='4.5'/>
        <circle cx='265' cy='40' r='4.5'/>
        <circle cx='40' cy='115' r='4.5'/>
        <circle cx='190' cy='115' r='4.5'/>
        <circle cx='115' cy='190' r='4.5'/>
        <circle cx='265' cy='190' r='4.5'/>
        <circle cx='40' cy='265' r='4.5'/>
        <circle cx='190' cy='265' r='4.5'/>
      </g>
      <rect width='300' height='300' filter='url(#paper)'/>
    </svg>`,
  },
  {
    name: 'wall-door',
    tile: [1100, 3850],
    /*
     * Flat grey and a lot of it, so jpeg holds it in a fraction of png's
     * bytes - and low quality holds it in a fraction of those. 72 rather than
     * the usual 86 costs 143KB of the 225 and cannot be told from it at the
     * size a phone draws this, where a board and a half is about 530px.
     */
    photo: true,
    quality: 72,
    /*
     * A tall panelled door in grey primer, in its casing, with wall around it.
     *
     * Three and a half times as tall as it is wide, which is longer than a
     * door really is. That is the point: board.css draws it half again the
     * board's width, and from there it runs a long way past the bottom of any
     * screen, so what you see is one door going down rather than a stack of
     * them. It is panelled the whole way down instead of stretched - a six
     * panel door pulled to this length would have panels five times longer
     * than they are wide and an oval doorknob.
     *
     * The wall above the casing is deep on purpose, deeper than the strip
     * below the threshold. It is the headroom that keeps the door above this
     * one off the top of the screen: 700 units is 4200 board pixels, and with
     * the casing set a little over the board there is nothing to find above
     * it until a screen a good deal taller than a phone's at the furthest
     * zoom out.
     *
     * It still wraps, in both directions. Nothing here covers, because a
     * covering picture in board space has no size its edge could be: pinch
     * out far enough and you find it, with bare colour past it. Wrapping is
     * also why there is no shading over the whole tile - an earlier one had a
     * top-to-bottom gradient across everything, invisible in one copy and a
     * bright line across the wall in a grid of them. The only gradients left
     * are inside the panels, where they cannot reach an edge, and both the
     * top and bottom edges are plain wall, so the join is wall meeting wall.
     */
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='1100' height='3850'>
      <defs>
        <filter id='roll' x='0' y='0' width='1100' height='3850' filterUnits='userSpaceOnUse'>
          <feTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='4' stitchTiles='stitch' seed='23'/>
          <feColorMatrix type='matrix' values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.52 0.18 0.15 0.1 0 -0.04'/>
        </filter>
        <!-- Sunk panel: dark under the top edge, catching light at the foot. -->
        <linearGradient id='sunk' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stop-color='rgba(0,0,0,0.26)'/>
          <stop offset='0.16' stop-color='rgba(0,0,0,0.05)'/>
          <stop offset='0.86' stop-color='rgba(255,255,255,0.05)'/>
          <stop offset='1' stop-color='rgba(255,255,255,0.14)'/>
        </linearGradient>
      </defs>

      <!-- The wall the door is in. -->
      <rect width='1100' height='3850' fill='#8d8b86'/>

      <!-- Casing, the reveal behind it, then the leaf. -->
      <rect x='160' y='700' width='780' height='3000' fill='#a3a19b'/>
      <rect x='160' y='700' width='780' height='3000' fill='none'
            stroke='rgba(0,0,0,0.20)' stroke-width='3'/>
      <rect x='160' y='700' width='780' height='7' fill='rgba(255,255,255,0.20)'/>
      <rect x='204' y='744' width='692' height='2956' fill='#5f5e5b'/>
      <rect x='216' y='756' width='668' height='2930' fill='#9a9893'/>

      <!-- Seven rows of panels between two stiles and a muntin. -->
      <g fill='#8f8d88' stroke='rgba(0,0,0,0.30)' stroke-width='3'>
        <rect x='304' y='856' width='222' height='306' rx='4'/>
        <rect x='574' y='856' width='222' height='306' rx='4'/>
        <rect x='304' y='1258' width='222' height='306' rx='4'/>
        <rect x='574' y='1258' width='222' height='306' rx='4'/>
        <rect x='304' y='1660' width='222' height='306' rx='4'/>
        <rect x='574' y='1660' width='222' height='306' rx='4'/>
        <rect x='304' y='2062' width='222' height='306' rx='4'/>
        <rect x='574' y='2062' width='222' height='306' rx='4'/>
        <rect x='304' y='2464' width='222' height='306' rx='4'/>
        <rect x='574' y='2464' width='222' height='306' rx='4'/>
        <rect x='304' y='2866' width='222' height='306' rx='4'/>
        <rect x='574' y='2866' width='222' height='306' rx='4'/>
        <rect x='304' y='3268' width='222' height='310' rx='4'/>
        <rect x='574' y='3268' width='222' height='310' rx='4'/>
      </g>
      <g fill='url(#sunk)'>
        <rect x='304' y='856' width='222' height='306' rx='4'/>
        <rect x='574' y='856' width='222' height='306' rx='4'/>
        <rect x='304' y='1258' width='222' height='306' rx='4'/>
        <rect x='574' y='1258' width='222' height='306' rx='4'/>
        <rect x='304' y='1660' width='222' height='306' rx='4'/>
        <rect x='574' y='1660' width='222' height='306' rx='4'/>
        <rect x='304' y='2062' width='222' height='306' rx='4'/>
        <rect x='574' y='2062' width='222' height='306' rx='4'/>
        <rect x='304' y='2464' width='222' height='306' rx='4'/>
        <rect x='574' y='2464' width='222' height='306' rx='4'/>
        <rect x='304' y='2866' width='222' height='306' rx='4'/>
        <rect x='574' y='2866' width='222' height='306' rx='4'/>
        <rect x='304' y='3268' width='222' height='310' rx='4'/>
        <rect x='574' y='3268' width='222' height='310' rx='4'/>
      </g>

      <!-- Knob on a backplate, on the lock stile, high up where a hand is. -->
      <rect x='822' y='1552' width='36' height='120' rx='6' fill='#a8a291'/>
      <circle cx='840' cy='1612' r='25' fill='#a29c8a'/>
      <circle cx='840' cy='1607' r='20' fill='#cfc9b4'/>
      <circle cx='834' cy='1602' r='7' fill='rgba(255,255,255,0.45)'/>

      <!-- Roller stipple, stitched so it crosses the join. -->
      <rect width='1100' height='3850' filter='url(#roll)'/>
    </svg>`,
  },
];

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

  const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'styles', 'tex');
  mkdirSync(out, { recursive: true });
  // PLAYWRIGHT_CHROMIUM lets a sandbox point at a browser it already has.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  );
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

  /* Every filter, kept in memory: some are only ever inputs to a surface. */
  const baked = new Map();
  for (const tex of [...TEXTURES, ...COMPOSED]) {
    const [sx, sy] = Array.isArray(tex.scale) ? tex.scale : [tex.scale, tex.scale];
    const w = Math.round(tex.width * sx);
    const h = Math.round(tex.height * sy);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg,div{display:block;width:${w}px;height:${h}px}</style>${tex.svg ?? tex.html}`,
    );
    await page.waitForTimeout(120);
    baked.set(tex.name, await page.screenshot({ omitBackground: true }));
    await page.close();
    if (tex.internal) continue;
    writeFileSync(join(out, `${tex.name}.png`), baked.get(tex.name));
    const [dw, dh] = tex.drawn ?? [tex.width, tex.height];
    console.log(`${tex.name.padEnd(18)} drawn ${dw}x${dh}  baked ${w}x${h}  ${kb(statSync(join(out, `${tex.name}.png`)).size)}`);
  }

  /* Then each board surface, as one picture over its own base colour. */
  /*
   * Composed from the filters, not from the baked pngs. A png of a stitched
   * filter no longer stitches: downscaling it samples the edge pixels against
   * nothing, so tiling one into a surface bakes a seam in permanently. The
   * filter itself wraps at any size.
   */
  const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  for (const s of SURFACES) {
    const size = s.size ?? 2100;
    const layers = s.layers.replace(/\{(tex-[a-z-]+)\}/g, (_, n) => {
      const tex = TEXTURES.find((t) => t.name === n);
      const [w, h] = tex.drawn ?? [tex.width, tex.height];
      return `${uri(tex.svg)} 0 0 / ${w}px ${h}px repeat`;
    });
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}
      #s{width:${BOARD}px;height:${BOARD}px;transform:scale(${size / BOARD});transform-origin:0 0;
         background:${layers.trim()},${s.base}}</style><div id="s"></div>`);
    await page.waitForTimeout(200);
    const buf = await page.screenshot({ type: 'jpeg', quality: s.quality ?? 84 });
    await page.close();
    writeFileSync(join(out, `${s.name}.jpg`), buf);
    console.log(`${s.name.padEnd(18)} drawn ${BOARD}x${BOARD}  baked ${size}x${size}  ${kb(buf.length)}`);
  }
  /*
   * And the walls. These are tiles rather than one picture, so each is baked
   * at its own size and the seam is the thing that matters: a wall that does
   * not wrap shows a grid of joins across the whole screen.
   */
  for (const w of WALLS) {
    const [tw, th] = w.tile;
    const page = await browser.newPage({ viewport: { width: tw, height: th } });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${tw}px;height:${th}px}</style>${w.svg}`,
    );
    await page.waitForTimeout(160);
    // Flat expanses of grey compress; hard-edged geometry does not, and png
    // keeps that sharp for fewer bytes than a jpeg that does it badly.
    const buf = w.photo
      ? await page.screenshot({ type: 'jpeg', quality: w.quality ?? 86 })
      : await page.screenshot({ type: 'png' });
    await page.close();
    const file = `${w.name}.${w.photo ? 'jpg' : 'png'}`;
    writeFileSync(join(out, file), buf);
    console.log(`${w.name.padEnd(18)} tile ${tw}x${th}  ${kb(buf.length)}`);
  }

  await browser.close();
}
