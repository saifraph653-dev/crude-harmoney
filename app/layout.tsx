import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import { BAG_COOKIE, bagUnits, parseBag } from "@/lib/cart";
import { Wordmark } from "@/components/Wordmark";
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
  openGraph: {
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
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-colors hover:text-accent"
        >
          <Wordmark className="h-4 w-auto sm:h-[1.15rem]" />
          {/* nowrap + slightly tighter tracking on small screens: at 390px
              the wordmark was breaking onto two lines and inflating the
              header. */}
          <span className="text-xs font-semibold tracking-[0.16em] whitespace-nowrap uppercase sm:text-sm sm:tracking-[0.2em]">
            Crude Harmony
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/drops"
            className="px-3 py-2 text-xs font-medium tracking-[0.14em] text-muted uppercase transition-colors hover:text-foreground"
          >
            Collection
          </Link>
          <Link
            href="/orders/lookup"
            className="px-3 py-2 text-xs font-medium tracking-[0.14em] text-muted uppercase transition-colors hover:text-foreground"
          >
            Track
          </Link>
          <Link
            href="/cart"
            className="px-3 py-2 text-xs font-medium tracking-[0.14em] text-muted uppercase transition-colors hover:text-foreground"
          >
            Bag{units > 0 ? ` (${units})` : ""}
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="eyebrow">Crude Harmony · Doha, Qatar · Not yet released</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-subtle">
          <Link href="/drops" className="transition-colors hover:text-foreground">
            Drops
          </Link>
          <Link href="/orders/lookup" className="transition-colors hover:text-foreground">
            Track an order
          </Link>
        </div>
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
