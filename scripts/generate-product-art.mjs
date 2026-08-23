#!/usr/bin/env node
// Generates, for every SKU:
//   public/products/<slug>.svg   -- the storefront product shot
//   public/artwork/<slug>.svg    -- the bare mark, for vinyl cutting
//
// PRODUCTION CONSTRAINT (this drives every design decision below):
// these pieces are made by heat-pressing cut vinyl onto blank garments,
// so each mark is built from SOLID shapes in ONE colour with no
// gradients, no halftones, and no hairline detail. That is what a cutter
// can actually follow and what will survive a wash. The gradients and
// grain in this file are all in the *presentation* (fabric, backdrop) --
// never in the artwork itself, which is why the two are emitted
// separately rather than cropped out of one file later.
//
// Usage: node scripts/generate-product-art.mjs

import { mkdir, writeFile } from "node:fs/promises";

const SIZE = 1000;

// ---------------------------------------------------------------------------
// Marks. Each is drawn centred on (0,0) inside roughly a 300x300 box, as
// solid fills only. `fill="currentColor"` lets the same path serve the
// product shot and the single-colour cutting file.
// ---------------------------------------------------------------------------
const MARKS = {
  // Ornate flared cross -- the gothic end of the range.
  cross: `
    <path d="M-26 -150 L26 -150 L26 -58 L118 -58 L118 -6 L26 -6 L26 150 L-26 150 L-26 -6 L-118 -6 L-118 -58 L-26 -58 Z"/>
    <path d="M0 -178 L22 -150 L-22 -150 Z"/>
    <path d="M0 178 L22 150 L-22 150 Z"/>
    <path d="M-146 -32 L-118 -58 L-118 -6 Z"/>
    <path d="M146 -32 L118 -58 L118 -6 Z"/>
    <path d="M0 -46 L36 -10 L0 26 L-36 -10 Z"/>`,

  // Dagger. Long blade, heavy crossguard, faceted pommel.
  dagger: `
    <path d="M0 -186 L20 -104 L20 40 L0 74 L-20 40 L-20 -104 Z"/>
    <path d="M-124 -104 L124 -104 L124 -74 L34 -74 L34 -56 L-34 -56 L-34 -74 L-124 -74 Z"/>
    <path d="M-124 -104 L-152 -89 L-124 -74 Z"/>
    <path d="M124 -104 L152 -89 L124 -74 Z"/>
    <path d="M0 84 L26 112 L0 174 L-26 112 Z"/>
    <circle cx="0" cy="-30" r="13"/>`,

  // Eight-point star with a punched centre. Two subpaths + evenodd is what
  // actually cuts the hole; a second solid path would just overlay it.
  star: `
    <path fill-rule="evenodd" d="M0 -170 L34 -60 L146 -96 L74 -8 L170 60 L52 58 L36 172 L0 68 L-36 172 L-52 58 L-170 60 L-74 -8 L-146 -96 L-34 -60 Z
                                 M0 -46 A46 46 0 1 0 0 46 A46 46 0 1 0 0 -46 Z"/>`,

  // Heavy shield crest. Monogram sits inside via a text node.
  crest: `
    <path d="M-118 -140 L118 -140 L118 26 C118 104 60 148 0 176 C-60 148 -118 104 -118 26 Z"/>`,

  // Paired wings around a central bar. Heavier than a literal feather
  // drawing so it holds up once it is cut and pressed.
  wings: `
    <path d="M-20 -76 L20 -76 L20 104 L0 138 L-20 104 Z"/>
    <path d="M-34 -60 C-104 -54 -160 -26 -196 16 C-146 6 -112 12 -84 30 C-112 46 -128 68 -136 96 C-96 62 -62 48 -34 48 Z"/>
    <path d="M34 -60 C104 -54 160 -26 196 16 C146 6 112 12 84 30 C112 46 128 68 136 96 C96 62 62 48 34 48 Z"/>
    <path d="M0 -116 L24 -80 L-24 -80 Z"/>`,


  // Open hand. Fingers kept as separate rounded slabs with wide gaps --
  // a literal hand outline has concave notches too tight for a blade.
  hand: `
    <path d="M-96 6 C-96 -26 -74 -46 -46 -46 L46 -46 C74 -46 96 -26 96 6 L96 76 C96 130 56 172 0 172 C-56 172 -96 130 -96 76 Z"/>
    <rect x="-86" y="-152" width="40" height="118" rx="20"/>
    <rect x="-30" y="-186" width="40" height="152" rx="20"/>
    <rect x="26" y="-172" width="40" height="138" rx="20"/>
    <rect x="80" y="-120" width="38" height="90" rx="19" transform="rotate(14 99 -75)"/>
    <rect x="-150" y="-70" width="38" height="86" rx="19" transform="rotate(-22 -131 -27)"/>`,

  // Crown. Solid, symmetrical, generous interior angles -- the cleanest
  // of the set to cut, and it carries the "modern vintage" read without
  // needing fine detail.
  crown: `
    <path d="M-170 -34 L-104 46 L-58 -86 L0 26 L58 -86 L104 46 L170 -34 L140 130 L-140 130 Z"/>
    <rect x="-150" y="150" width="300" height="46" rx="8"/>
    <circle cx="-170" cy="-58" r="24"/>
    <circle cx="170" cy="-58" r="24"/>
    <circle cx="0" cy="-108" r="26"/>`,
};

// A mark plus optional wordmark underneath, as one <g>.
function markGroup({ mark, word, wordSize = 22, wordY = 232, scale = 1, inside }) {
  return `
    <g transform="scale(${scale})">
      ${MARKS[mark]}
      ${inside ?? ""}
    </g>
    ${
      word
        ? `<text x="0" y="${wordY}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${wordSize}" font-weight="700" letter-spacing="${(wordSize * 0.42).toFixed(1)}">${word}</text>`
        : ""
    }`;
}

// ---------------------------------------------------------------------------
// Garment shot. A tee silhouette rather than a folded flat lay: folded
// cloth rendered as vector reads as an envelope at thumbnail size, and the
// grid has to say "shirt" instantly. One geometry across the range so the
// six read as a single shoot.
// ---------------------------------------------------------------------------
const TEE =
  "M338 196 C296 205 254 223 226 245 C202 291 184 348 175 394 C201 414 234 427 265 431 " +
  "C276 405 287 379 296 357 C292 494 292 686 296 846 C370 857 630 857 704 846 " +
  "C708 686 708 494 704 357 C713 379 724 405 735 431 C766 427 799 414 825 394 " +
  "C816 348 798 291 774 245 C746 223 704 205 662 196 " +
  "C649 254 587 286 500 286 C413 286 351 254 338 196 Z";

// The neck opening exactly as the TEE path leaves it: straight across the
// shoulders, then down the neckline curve. Drawing an ellipse here instead
// bulges above the shoulder seam and reads as a hole punched in the render.
const NECK_OPENING =
  "M338 196 L662 196 C649 254 587 286 500 286 C413 286 351 254 338 196 Z";

// Rib band hugging the inside of that neckline.
const COLLAR_RIB =
  "M338 196 C351 254 413 286 500 286 C587 286 649 254 662 196 " +
  "L648 196 C636 244 580 272 500 272 C420 272 364 244 352 196 Z";

function productShot({ id, base, highlight, shadow, ink, ground, art }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${id}">
  <defs>
    <radialGradient id="g-${id}" cx="0.5" cy="0.34" r="0.82">
      <stop offset="0%" stop-color="${ground[0]}"/>
      <stop offset="100%" stop-color="${ground[1]}"/>
    </radialGradient>
    <linearGradient id="f-${id}" x1="0.16" y1="0" x2="0.86" y2="1">
      <stop offset="0%" stop-color="${highlight}"/>
      <stop offset="54%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${shadow}"/>
    </linearGradient>

    <filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
    <filter id="weave-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" seed="3"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
    <filter id="soft-${id}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="17"/>
    </filter>

    <clipPath id="cloth-${id}"><path d="${TEE}"/></clipPath>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" fill="url(#g-${id})"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#grain-${id})" fill="#ffffff"/>

  <ellipse cx="500" cy="862" rx="256" ry="26" fill="#000" opacity="0.34" filter="url(#soft-${id})"/>

  <g>
    <path d="${TEE}" fill="url(#f-${id})"/>

    <g clip-path="url(#cloth-${id})">
      <rect width="${SIZE}" height="${SIZE}" filter="url(#weave-${id})" fill="#ffffff"/>
      <g filter="url(#soft-${id})">
        <path d="M356 590 C372 672 366 756 350 848" stroke="${shadow}" stroke-opacity="0.20" stroke-width="34" fill="none" stroke-linecap="round"/>
        <path d="M644 590 C628 672 634 756 650 848" stroke="${shadow}" stroke-opacity="0.20" stroke-width="34" fill="none" stroke-linecap="round"/>
      </g>
      <path d="M265 431 C282 410 291 383 296 357" stroke="${shadow}" stroke-opacity="0.24" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M735 431 C718 410 709 383 704 357" stroke="${shadow}" stroke-opacity="0.24" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M296 832 C400 843 600 843 704 832" stroke="${shadow}" stroke-opacity="0.26" stroke-width="6" fill="none"/>
    </g>

    <path d="${NECK_OPENING}" fill="${shadow}" opacity="0.6"/>
    <path d="${COLLAR_RIB}" fill="${highlight}" opacity="0.5"/>

    <g transform="translate(500 500)" fill="${ink}">${art}</g>
  </g>
</svg>
`;
}

// The bare mark on transparent ground, one flat colour: what actually
// goes to the cutter.
function artworkFile({ id, art }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-260 -260 520 520" width="520" height="520" role="img" aria-label="${id} artwork">
  <!-- Single flat colour, solid shapes only: cut-ready. Recolour by
       changing this one fill. -->
  <g fill="#000000">${art}</g>
</svg>
`;
}

// ---------------------------------------------------------------------------
const PIECES = [
  {
    file: "atlas-tee",
    base: "#232327", highlight: "#33333a", shadow: "#0c0c0e",
    ground: ["#1a1a1d", "#0a0a0b"], ink: "#f2f2f3",
    art: markGroup({ mark: "cross", word: "CRUDE HARMONY", scale: 0.5, wordY: 168, wordSize: 17 }),
  },
  {
    file: "meridian-tee",
    base: "#efece4", highlight: "#fbfaf7", shadow: "#bdb6a6",
    ground: ["#2b2b2e", "#131315"], ink: "#17171a",
    art: markGroup({ mark: "dagger", word: "SINCE THE FIRST RUN", scale: 0.5, wordY: 172, wordSize: 15 }),
  },
  {
    file: "dune-tee",
    base: "#b8a083", highlight: "#cdb99c", shadow: "#7d6647",
    ground: ["#26221c", "#100e0b"], ink: "#221a10",
    art: markGroup({ mark: "star", word: "DOHA", scale: 0.5, wordY: 170, wordSize: 18 }),
  },
  {
    file: "vale-tee",
    base: "#3a3d42", highlight: "#4c5057", shadow: "#1c1e21",
    ground: ["#202226", "#0b0c0d"], ink: "#e6e2f0",
    art: markGroup({ mark: "hand", word: "CRUDE HARMONY", scale: 0.44, wordY: 172, wordSize: 16 }),
  },
  {
    file: "ember-tee",
    base: "#932f24", highlight: "#ad3e2f", shadow: "#4f1610",
    ground: ["#241210", "#0d0706"], ink: "#f7e6d6",
    art: markGroup({ mark: "wings", word: "ONE OF THIRTY", scale: 0.5, wordY: 168, wordSize: 16 }),
  },
  {
    file: "obsidian-tee",
    base: "#141416", highlight: "#242429", shadow: "#000000",
    ground: ["#1d1d21", "#08080a"], ink: "#c8a02b",
    art: markGroup({ mark: "crown", word: "NO RESTOCK", scale: 0.5, wordY: 178, wordSize: 16 }),
  },
];

async function main() {
  await mkdir("public/products", { recursive: true });
  await mkdir("public/artwork", { recursive: true });

  for (const p of PIECES) {
    await writeFile(`public/products/${p.file}.svg`, productShot({ id: p.file, ...p }), "utf-8");
    await writeFile(`public/artwork/${p.file}.svg`, artworkFile({ id: p.file, art: p.art }), "utf-8");
    console.log(`wrote ${p.file} (product + artwork)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
