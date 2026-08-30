#!/usr/bin/env node
// Generates, for every SKU:
//   public/artwork/<slug>.svg    -- the bare mark, for vinyl cutting
//
// It no longer emits public/products/<slug>.* -- the storefront images are
// photographed garment mockups now. This file remains the source of truth
// for the MARKS themselves: the mockups show what a piece looks like, this
// produces what actually goes to the cutter, and the two must not drift.
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
// DESIGN LANGUAGE:
// The marks all come from one idea, taken from the brand's own name and
// its actual production method: things that are meant to line up, not
// quite lining up. Hand-pressing vinyl one garment at a time is a process
// with slip in it, and the storefront already says the small variations
// are the point. So every mark here is a solid geometric form that has
// been displaced, stepped or knocked out of register.
//
// This deliberately replaces the previous library (cross, dagger, crown,
// wings, crest, star). Those are the default vocabulary of every generic
// streetwear graphic, they carry religious and heraldic readings the
// brand has no claim to, and six pieces drawn from them look like a
// costume rather than a collection.
//
// Usage: node scripts/generate-product-art.mjs

import { mkdir, writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Marks. Each is drawn centred on (0,0) inside roughly a 300x300 box, as
// solid fills only. Corners are square and interior angles are generous:
// a blade cannot follow a tight concave notch, and fine points lift off
// the garment in the wash.
// ---------------------------------------------------------------------------
const MARKS = {
  // OFFSET -- two equal squares pushed apart on the diagonal, the overlap
  // knocked out with evenodd. The whole idea of the collection in its
  // simplest possible statement, and the easiest thing here to cut.
  offset: `
    <path fill-rule="evenodd" d="M-140 -140 L20 -140 L20 20 L-140 20 Z
                                 M-20 -20 L140 -20 L140 140 L-20 140 Z"/>`,

  // RIDGE -- horizontal strata, each band shifted off the one above, like
  // rock layers that have slipped along a fault. An earlier version used
  // stepped vertical bars and read as a bar chart.
  ridge: `
    <rect x="-150" y="-142" width="300" height="54"/>
    <rect x="-96"  y="-66"  width="300" height="54"/>
    <rect x="-150" y="10"   width="252" height="54"/>
    <rect x="-88"  y="86"   width="238" height="54"/>`,

  // MARGIN -- a solid block with its rule set beside it, dropped out of
  // alignment. Reads as a page with the margin slipped.
  margin: `
    <path d="M-34 -140 L140 -140 L140 140 L-34 140 Z"/>
    <path d="M-140 -96 L-92 -96 L-92 184 L-140 184 Z"/>`,

  // SEAM -- two parallel runs that should meet level and do not. The
  // first attempt jogged a single bar sideways and read, unmistakably, as
  // a crucifix; there is deliberately no horizontal element here now.
  seam: `
    <rect x="-104" y="-200" width="80" height="330"/>
    <rect x="24"   y="-124" width="80" height="330"/>`,

  // FIELD -- a regular grid of dots with one row walked out of step. Round
  // shapes at this size are the most forgiving thing a cutter handles.
  field: `
    <g>
      <circle cx="-105" cy="-105" r="22"/><circle cx="-35" cy="-105" r="22"/>
      <circle cx="35"   cy="-105" r="22"/><circle cx="105" cy="-105" r="22"/>
      <circle cx="-105" cy="-35"  r="22"/><circle cx="-35" cy="-35"  r="22"/>
      <circle cx="35"   cy="-35"  r="22"/><circle cx="105" cy="-35"  r="22"/>
      <circle cx="-70"  cy="35"   r="22"/><circle cx="0"   cy="35"   r="22"/>
      <circle cx="70"   cy="35"   r="22"/><circle cx="140" cy="35"   r="22"/>
      <circle cx="-105" cy="105"  r="22"/><circle cx="-35" cy="105"  r="22"/>
      <circle cx="35"   cy="105"  r="22"/><circle cx="105" cy="105"  r="22"/>
    </g>`,

  // BIAS -- a square split on the diagonal, the halves drawn apart. The
  // gap is the mark; the two solids are just what makes it visible.
  bias: `
    <path d="M-150 -150 L130 -150 L-150 130 Z"/>
    <path d="M150 -110 L150 170 L-130 170 Z"/>`,
};

// A mark plus optional wordmark underneath, as one <g>.
function markGroup({ mark, word, wordSize = 22, wordY = 232, scale = 1 }) {
  return `
    <g transform="scale(${scale})">
      ${MARKS[mark]}
    </g>
    ${
      word
        ? `<text x="0" y="${wordY}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${wordSize}" font-weight="700" letter-spacing="${(wordSize * 0.42).toFixed(1)}">${word}</text>`
        : ""
    }`;
}

// The bare mark on transparent ground, one flat colour: what actually
// goes to the cutter.
function artworkFile({ id, art }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-280 -280 560 560" width="560" height="560" role="img" aria-label="${id} artwork">
  <!-- Single flat colour, solid shapes only: cut-ready. Recolour by
       changing this one fill. -->
  <g fill="#000000">${art}</g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// The range. Three tees, three hoodies; the hoodies sit in black, charcoal
// and heather grey. Marks are scaled down on the tees (chest mark) and up
// on the hoodies, which is the difference between a piece you wear under
// something and a piece that is the outfit.
// ---------------------------------------------------------------------------
const PIECES = [
  {
    file: "offset-01", kind: "tee",
    base: "#191919", highlight: "#2a2a2a", shadow: "#050505",
    ground: ["#1c1b1a", "#0b0a09"], ink: "#ece7dd",
    art: markGroup({ mark: "offset", word: "CRUDE HARMONY", scale: 0.42, wordY: 132, wordSize: 15 }),
  },
  {
    file: "ridge-02", kind: "tee",
    base: "#e9e4d9", highlight: "#f6f2ea", shadow: "#b5ae9f",
    ground: ["#2a2825", "#121110"], ink: "#171614",
    art: markGroup({ mark: "ridge", word: "VOL. 01", scale: 0.5, wordY: 116, wordSize: 15 }),
  },
  {
    file: "margin-03", kind: "tee",
    base: "#6f6f6d", highlight: "#848481", shadow: "#3f3f3e",
    ground: ["#242322", "#0e0e0d"], ink: "#14140f",
    art: markGroup({ mark: "margin", scale: 0.44 }),
  },
  {
    file: "seam-04", kind: "hoodie",
    base: "#17171a", highlight: "#27272b", shadow: "#040405",
    ground: ["#1b1b1e", "#0a0a0b"], ink: "#ece7dd",
    art: markGroup({ mark: "seam", scale: 0.5 }),
  },
  {
    file: "field-05", kind: "hoodie",
    base: "#33322f", highlight: "#454340", shadow: "#151513",
    ground: ["#211f1d", "#0c0b0a"], ink: "#ece7dd",
    art: markGroup({ mark: "field", word: "DOHA", scale: 0.52, wordY: 150, wordSize: 16 }),
  },
  {
    file: "bias-06", kind: "hoodie",
    base: "#8a8783", highlight: "#9d9a95", shadow: "#54524f",
    ground: ["#26241f", "#100f0d"], ink: "#141310",
    art: markGroup({ mark: "bias", scale: 0.46 }),
  },
];

async function main() {
  await mkdir("public/artwork", { recursive: true });

  for (const p of PIECES) {
    await writeFile(`public/artwork/${p.file}.svg`, artworkFile({ id: p.file, art: p.art }), "utf-8");
    console.log(`wrote ${p.file} (${p.kind}: cut-ready artwork)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
