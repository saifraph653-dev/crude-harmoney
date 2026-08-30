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

const W = 1000;
const H = 1250; // 4:5 portrait, matching .card-frame in app/globals.css.

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

// ---------------------------------------------------------------------------
// Garment silhouettes. One geometry per garment type across the range, so
// the six read as a single shoot rather than six separate renders. Drawn
// in a 1000x1000 space and lifted into the 4:5 frame by `lift`.
// ---------------------------------------------------------------------------
const TEE =
  "M338 196 C296 205 254 223 226 245 C202 291 184 348 175 394 C201 414 234 427 265 431 " +
  "C276 405 287 379 296 357 C292 494 292 686 296 846 C370 857 630 857 704 846 " +
  "C708 686 708 494 704 357 C713 379 724 405 735 431 C766 427 799 414 825 394 " +
  "C816 348 798 291 774 245 C746 223 704 205 662 196 " +
  "C649 254 587 286 500 286 C413 286 351 254 338 196 Z";

const TEE_NECK =
  "M338 196 L662 196 C649 254 587 286 500 286 C413 286 351 254 338 196 Z";

const TEE_COLLAR =
  "M338 196 C351 254 413 286 500 286 C587 286 649 254 662 196 " +
  "L648 196 C636 244 580 272 500 272 C420 272 364 244 352 196 Z";

// Hoodie: torso, sleeves and hood as separate paths. Drawing it as one
// outline (as the tee is) forces the sleeve and body curves to meet in a
// single continuous edge, which is what collapsed the first attempt into a
// tee silhouette with a handle over it.
const HOODIE_TORSO =
  "M300 358 C342 344 420 336 500 336 C580 336 658 344 700 358 " +
  "C710 520 710 790 700 952 C608 966 392 966 300 952 " +
  "C290 790 290 520 300 358 Z";

const HOODIE_SLEEVE_L =
  "M304 348 C262 360 232 384 216 414 C200 476 190 556 186 638 " +
  "C184 692 186 726 191 750 C221 760 257 760 288 750 " +
  "C293 716 296 656 300 598 Z";

const HOODIE_SLEEVE_R =
  "M696 348 C738 360 768 384 784 414 C800 476 810 556 814 638 " +
  "C816 692 814 726 809 750 C779 760 743 760 712 750 " +
  "C707 716 704 656 700 598 Z";

// Sits behind the torso as one solid volume, so only its crown shows above
// the shoulders. Drawn in the garment fabric, not in shadow: an outlined
// ring here read as a handle rather than a hood.
const HOODIE_HOOD =
  "M318 392 C300 258 368 158 500 158 C632 158 700 258 682 392 Z";

// The opening, cut into the front of the torso below the hood.
const HOODIE_NECK =
  "M398 344 C398 402 442 442 500 442 C558 442 602 402 602 344 Z";

const HOODIE_COLLAR =
  "M398 344 C398 402 442 442 500 442 C558 442 602 402 602 344 " +
  "L586 344 C586 394 548 428 500 428 C452 428 414 394 414 344 Z";

const HOODIE_POCKET = "M348 734 L652 734 L668 882 L332 882 Z";
const HOODIE_HEM = "M300 906 L700 906 L700 954 L300 954 Z";

function garmentPaths(kind) {
  return kind === "hoodie"
    ? { parts: [HOODIE_TORSO, HOODIE_SLEEVE_L, HOODIE_SLEEVE_R], lift: 80 }
    : { parts: [TEE], lift: 150 };
}

function productShot({ id, kind, base, highlight, shadow, ink, ground, art }) {
  const { parts, lift } = garmentPaths(kind);
  const hoodie = kind === "hoodie";
  const cloth = parts.map((d) => `<path d="${d}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${id}">
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ground[0]}"/>
      <stop offset="100%" stop-color="${ground[1]}"/>
    </linearGradient>
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

    <clipPath id="cloth-${id}"><g transform="translate(0 ${lift})">${cloth}</g></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#g-${id})"/>
  <rect width="${W}" height="${H}" filter="url(#grain-${id})" fill="#ffffff"/>

  <ellipse cx="500" cy="${lift + (hoodie ? 968 : 862)}" rx="248" ry="24" fill="#000" opacity="0.32" filter="url(#soft-${id})"/>

  <g transform="translate(0 ${lift})">
    ${
      hoodie
        ? `<path d="${HOODIE_HOOD}" fill="url(#f-${id})"/>
    <path d="${HOODIE_HOOD}" fill="${shadow}" opacity="0.28"/>`
        : ""
    }

    ${parts.map((d) => `<path d="${d}" fill="url(#f-${id})"/>`).join("\n    ")}

    <g clip-path="url(#cloth-${id})">
      <rect width="${W}" height="${H}" filter="url(#weave-${id})" fill="#ffffff"/>
      <g filter="url(#soft-${id})">
        <path d="M356 ${hoodie ? 640 : 590} C372 ${hoodie ? 722 : 672} 366 ${hoodie ? 830 : 756} 350 ${hoodie ? 930 : 848}" stroke="${shadow}" stroke-opacity="0.18" stroke-width="34" fill="none" stroke-linecap="round"/>
        <path d="M644 ${hoodie ? 640 : 590} C628 ${hoodie ? 722 : 672} 634 ${hoodie ? 830 : 756} 650 ${hoodie ? 930 : 848}" stroke="${shadow}" stroke-opacity="0.18" stroke-width="34" fill="none" stroke-linecap="round"/>
      </g>
      ${
        hoodie
          ? `<path d="${HOODIE_POCKET}" fill="none" stroke="${shadow}" stroke-opacity="0.30" stroke-width="6"/>
      <path d="${HOODIE_HEM}" fill="${shadow}" opacity="0.18"/>
      <path d="M188 722 C220 732 256 732 289 722 L291 752 C257 762 220 762 189 752 Z" fill="${shadow}" opacity="0.24"/>
      <path d="M812 722 C780 732 744 732 711 722 L709 752 C743 762 780 762 811 752 Z" fill="${shadow}" opacity="0.24"/>`
          : `<path d="M296 832 C400 843 600 843 704 832" stroke="${shadow}" stroke-opacity="0.26" stroke-width="6" fill="none"/>`
      }
    </g>

    ${
      hoodie
        ? `<path d="${HOODIE_NECK}" fill="${shadow}" opacity="0.82"/>
    <path d="${HOODIE_COLLAR}" fill="${highlight}" opacity="0.35"/>
    <path d="M452 430 L468 428 L462 548 L448 548 Z" fill="${highlight}" opacity="0.75"/>
    <path d="M532 428 L548 430 L552 548 L538 548 Z" fill="${highlight}" opacity="0.75"/>`
        : `<path d="${TEE_NECK}" fill="${shadow}" opacity="0.6"/>
    <path d="${TEE_COLLAR}" fill="${highlight}" opacity="0.5"/>`
    }

    <g transform="translate(500 ${hoodie ? 640 : 540})" fill="${ink}">${art}</g>
  </g>
</svg>
`;
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
  await mkdir("public/products", { recursive: true });
  await mkdir("public/artwork", { recursive: true });

  for (const p of PIECES) {
    await writeFile(`public/products/${p.file}.svg`, productShot({ id: p.file, ...p }), "utf-8");
    await writeFile(`public/artwork/${p.file}.svg`, artworkFile({ id: p.file, art: p.art }), "utf-8");
    console.log(`wrote ${p.file} (${p.kind}: product + artwork)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
