#!/usr/bin/env node
// Generates product artwork SVGs for each shirt into public/products/.
//
// These are vector product shots, not photographs -- a real drop would
// replace them with studio photos. They exist so the storefront has
// honest, distinct, on-brand art for every SKU instead of one shared
// placeholder. Kept as a generator (rather than six hand-written files)
// so the tee silhouette, shading and framing stay identical across the
// range and only the colourway and chest graphic vary.
//
// Usage: node scripts/generate-product-art.mjs

import { mkdir, writeFile } from "node:fs/promises";

const SIZE = 1000;

// ---------------------------------------------------------------------------
// Shared tee silhouette. One path, reused at every colourway, so the whole
// range reads as one product line photographed the same way.
// ---------------------------------------------------------------------------
const TEE_BODY =
  "M338 206 C300 214 262 230 236 250 C214 292 198 344 190 386 C214 404 244 416 272 420 " +
  "C282 396 292 372 300 352 C296 480 296 660 300 806 C368 816 632 816 700 806 " +
  "C704 660 704 480 700 352 C708 372 718 396 728 420 C756 416 786 404 810 386 " +
  "C802 344 786 292 764 250 C738 230 700 214 662 206 " +
  "C650 260 592 290 500 290 C408 290 350 260 338 206 Z";

const COLLAR =
  "M338 206 C352 248 414 270 500 270 C586 270 648 248 662 206 " +
  "C632 192 570 184 500 184 C430 184 368 192 338 206 Z";

function shirt({ id, base, shadow, highlight, collar, graphic, backdrop, ink, edge }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${id}">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${backdrop[0]}"/>
      <stop offset="100%" stop-color="${backdrop[1]}"/>
    </linearGradient>
    <!-- Fully opaque stops: an alpha stop here would let the backdrop
         show through the garment and dissolve the hem. -->
    <linearGradient id="fabric-${id}" x1="0.15" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${highlight}"/>
      <stop offset="55%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${shadow}"/>
    </linearGradient>
    <filter id="soft-${id}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <radialGradient id="sheen-${id}" cx="0.42" cy="0.3" r="0.62">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="tee-${id}"><path d="${TEE_BODY}"/></clipPath>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg-${id})"/>

  <!-- soft floor shadow so the garment sits in the frame -->
  <ellipse cx="500" cy="812" rx="235" ry="26" fill="#000" opacity="0.20"/>

  <g>
    <path d="${TEE_BODY}" fill="url(#fabric-${id})" stroke="${edge}" stroke-opacity="0.35" stroke-width="2"/>
    <path d="${COLLAR}" fill="${collar}"/>
    <path d="${COLLAR}" fill="none" stroke="${shadow}" stroke-opacity="0.5" stroke-width="4"/>

    <g clip-path="url(#tee-${id})">
      <rect width="${SIZE}" height="${SIZE}" fill="url(#sheen-${id})"/>
      <!-- Fabric folds: wide, very soft, and low on the body. Kept faint
           and blurred on purpose, because crisp dark strokes here read as
           scratches on the artwork rather than as cloth. -->
      <g filter="url(#soft-${id})">
        <path d="M352 566 C368 646 362 726 346 800" stroke="${shadow}" stroke-opacity="0.20" stroke-width="30" fill="none" stroke-linecap="round"/>
        <path d="M648 566 C632 646 638 726 654 800" stroke="${shadow}" stroke-opacity="0.20" stroke-width="30" fill="none" stroke-linecap="round"/>
        <path d="M500 640 C494 700 496 752 500 800" stroke="${shadow}" stroke-opacity="0.12" stroke-width="22" fill="none" stroke-linecap="round"/>
      </g>
      <!-- sleeve hems -->
      <path d="M272 420 C288 402 296 378 300 352" stroke="${shadow}" stroke-opacity="0.22" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M728 420 C712 402 704 378 700 352" stroke="${shadow}" stroke-opacity="0.22" stroke-width="6" fill="none" stroke-linecap="round"/>
      <!-- hem -->
      <path d="M300 788 C400 798 600 798 700 788" stroke="${shadow}" stroke-opacity="0.28" stroke-width="6" fill="none"/>
    </g>

    <!-- chest graphic -->
    <g transform="translate(500 470)" fill="${ink}" stroke="${ink}">${graphic}</g>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Chest graphics. Each is drawn centred on (0,0); keep within ~±150 so it
// sits on the chest panel and never rides over a seam.
// ---------------------------------------------------------------------------
const GRAPHICS = {
  // Two offset arcs that don't quite meet -- the "crude harmony" idea.
  harmonyArcs: `
    <g fill="none" stroke-width="9" stroke-linecap="round">
      <path d="M-96 26 A 96 96 0 0 1 62 -46"/>
      <path d="M96 -26 A 96 96 0 0 1 -62 46"/>
    </g>
    <circle cx="62" cy="-46" r="11" stroke="none"/>
    <circle cx="-62" cy="46" r="11" stroke="none"/>
    <text x="0" y="118" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="21" letter-spacing="9" stroke="none">HARMONY</text>`,

  // Hand-drawn-feeling wordmark box.
  stackedWordmark: `
    <g stroke="none" font-family="Helvetica,Arial,sans-serif" text-anchor="middle">
      <text x="0" y="-16" font-size="54" font-weight="700" letter-spacing="2">CRUDE</text>
      <text x="0" y="42" font-size="54" font-weight="700" letter-spacing="2">HARMONY</text>
    </g>
    <rect x="-150" y="-72" width="300" height="128" fill="none" stroke-width="5"/>`,

  // Horizon / dune line -- Qatar reference without being literal.
  duneLine: `
    <circle cx="86" cy="-74" r="24" stroke="none"/>
    <g fill="none" stroke-width="12" stroke-linecap="round">
      <path d="M-140 26 C -84 -36, -28 20, 22 -18 C 68 -52, 108 -10, 142 -32"/>
      <path d="M-140 66 C -84 4, -28 60, 22 22 C 68 -12, 108 30, 142 8" stroke-opacity="0.6"/>
      <path d="M-140 104 C -84 44, -28 100, 22 62 C 68 28, 108 70, 142 48" stroke-opacity="0.3"/>
    </g>
    <text x="0" y="164" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="20" letter-spacing="11" stroke="none">DOHA</text>`,

  // Small chest crest, deliberately minimal.
  monogram: `
    <circle cx="0" cy="0" r="76" fill="none" stroke-width="6"/>
    <g stroke="none" font-family="Helvetica,Arial,sans-serif" text-anchor="middle">
      <text x="0" y="20" font-size="62" font-weight="700" letter-spacing="-2">CH</text>
    </g>
    <path d="M-40 46 L40 46" stroke-width="5"/>`,

  // Limited: sunburst rays, feels like a special edition seal.
  burst: `
    <g stroke-width="7" stroke-linecap="round">
      ${Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r1 = 52;
        const r2 = i % 2 === 0 ? 108 : 84;
        return `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * r2).toFixed(1)}" y2="${(Math.sin(a) * r2).toFixed(1)}"/>`;
      }).join("\n      ")}
    </g>
    <circle cx="0" cy="0" r="38" fill="none" stroke-width="7"/>
    <text x="0" y="14" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" stroke="none">01</text>
    <text x="0" y="150" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="18" letter-spacing="8" stroke="none">LIMITED</text>`,

  // Limited: fractured grid, the "crude" half of the name.
  fracture: `
    <g fill="none" stroke-width="6">
      <rect x="-110" y="-88" width="96" height="96"/>
      <rect x="14" y="-88" width="96" height="96" transform="rotate(9 62 -40)"/>
      <rect x="-110" y="26" width="96" height="96" transform="rotate(-7 -62 74)"/>
      <rect x="14" y="26" width="96" height="96"/>
    </g>
    <path d="M-6 -110 L 6 130" stroke-width="9" stroke-linecap="round"/>
    <text x="0" y="168" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="18" letter-spacing="8" stroke="none">EDITION</text>`,
};

// ---------------------------------------------------------------------------
// Each backdrop is deliberately pushed away in value from its garment --
// a dark tee on a dark ground loses its edge entirely at grid-thumbnail
// size, which is where most of these are actually seen.
const SHIRTS = [
  {
    file: "atlas-tee",
    base: "#232326", highlight: "#34343a", shadow: "#0d0d0f", collar: "#1a1a1d",
    backdrop: ["#dcd8d1", "#b5b0a7"], edge: "#000000", ink: "#f4f4f5",
    graphic: GRAPHICS.harmonyArcs,
  },
  {
    file: "meridian-tee",
    base: "#f6f4ef", highlight: "#ffffff", shadow: "#c9c3b6", collar: "#eae7de",
    backdrop: ["#3d3d42", "#202024"], edge: "#8b8578", ink: "#1b1b1d",
    graphic: GRAPHICS.stackedWordmark,
  },
  {
    file: "dune-tee",
    base: "#c0a887", highlight: "#d6c2a5", shadow: "#8a7154", collar: "#b39a78",
    backdrop: ["#35322c", "#1c1a17"], edge: "#5f4e39", ink: "#2a2118",
    graphic: GRAPHICS.duneLine,
  },
  {
    file: "slate-tee",
    base: "#525e6a", highlight: "#68747f", shadow: "#2b323a", collar: "#47525c",
    backdrop: ["#d3d7db", "#a9b1b8"], edge: "#1c2127", ink: "#eef1f4",
    graphic: GRAPHICS.monogram,
  },
  {
    file: "ember-tee",
    base: "#9c3327", highlight: "#b8412f", shadow: "#5a1912", collar: "#8a2b20",
    backdrop: ["#e6ddd2", "#bfb3a5"], edge: "#3d100b", ink: "#f8e7d8",
    graphic: GRAPHICS.burst,
  },
  {
    file: "obsidian-tee",
    base: "#141417", highlight: "#232329", shadow: "#000000", collar: "#0b0b0d",
    backdrop: ["#7a7a84", "#42424a"], edge: "#000000", ink: "#c9a227",
    graphic: GRAPHICS.fracture,
  },
];

async function main() {
  const dir = "public/products";
  await mkdir(dir, { recursive: true });
  for (const s of SHIRTS) {
    const svg = shirt({ id: s.file, ...s });
    await writeFile(`${dir}/${s.file}.svg`, svg, "utf-8");
    console.log(`wrote ${dir}/${s.file}.svg`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
