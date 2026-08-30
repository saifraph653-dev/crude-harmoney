import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import { BAG_COOKIE, bagUnits, parseBag } from "@/lib/cart";
import { Wordmark } from "@/components/Wordmark";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

// Archivo carries the whole UI: a grotesque descended from 19th-century
// American gothics, so it has some industrial character instead of reading
// as another neutral product-UI face. Variable, so weight costs no extra
// request. Geist Mono was dropped rather than replaced -- wide-tracked
// uppercase Archivo does the metadata job (see .eyebrow) and that is one
// entire font family off the critical path.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

// The one editorial accent, used sparingly. Single weight + italic only.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crude Harmony",
    template: "%s · Crude Harmony",
  },
  description:
    "Modern vintage out of Doha. Heavyweight blanks, hand-pressed marks, counted runs.",
  metadataBase: new URL(getSiteUrl()),
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "Crude Harmony",
    locale: "en",
    title: "Crude Harmony",
    description:
      "Modern vintage out of Doha. Heavyweight blanks, hand-pressed marks, counted runs.",
    type: "website",
  },
};

// themeColor belongs in viewport, not metadata, in this Next version.
// It sets the iOS Safari toolbar tint so the browser chrome matches the page.
export const viewport: Viewport = {
  themeColor: "#0c0b0a",
  colorScheme: "dark",
};

async function Header() {
  const store = await cookies();
  const units = bagUnits(parseBag(store.get(BAG_COOKIE)?.value));

  return (
    <header className="relative sticky top-0 z-40 border-b border-border bg-background">
      <nav className="mx-auto flex h-14 max-w-[88rem] items-center gap-4 px-5 sm:h-16 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="Crude Harmony, home">
          <Wordmark className="text-[0.7rem] sm:text-[0.8rem]" />
        </Link>

        {/* Desktop: the sections sit inline, centred between mark and bag. */}
        <div className="ml-auto hidden items-center gap-8 sm:flex">
          <Link href="/drops" className="nav-link">
            Collection
          </Link>
          <Link href="/orders/lookup" className="nav-link">
            Track
          </Link>
        </div>

        {/* Mobile: a disclosure, not a scaled-down desktop row.
            The old header laid the wordmark and three tracked uppercase
            links in one nowrap flex row; its intrinsic width was 429px, so
            it overflowed every viewport at 390px and below. Built on
            <details> so it opens and closes with no JavaScript and no
            hydration, and stays keyboard- and screen-reader-operable. */}
        <details className="nav-disclosure ml-auto sm:hidden">
          <summary className="nav-link list-none">Menu</summary>
          <div className="nav-panel">
            <Link href="/drops" className="nav-panel-link">
              Collection
            </Link>
            <Link href="/orders/lookup" className="nav-panel-link">
              Track an order
            </Link>
            <Link href="/cart" className="nav-panel-link">
              Bag{units > 0 ? ` (${units})` : ""}
            </Link>
          </div>
        </details>

        <Link href="/cart" className="nav-link hidden shrink-0 sm:block">
          Bag{units > 0 ? ` (${units})` : ""}
        </Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto w-full max-w-[88rem] px-5 py-12 sm:px-8 sm:py-16">
        <Wordmark className="text-[0.7rem] text-subtle" />

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/drops" className="nav-link">
            Collection
          </Link>
          <Link href="/orders/lookup" className="nav-link">
            Track an order
          </Link>
          <Link href="/cart" className="nav-link">
            Bag
          </Link>
        </div>

        <p className="mt-10 text-xs text-subtle">
          Doha, Qatar. Vol. 01 has not been released.
        </p>
      </div>
      {/* Breathing room above the iPhone home indicator. */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
