import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#0b0b0c",
  colorScheme: "dark",
};

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-colors hover:text-accent"
        >
          <Wordmark className="h-4 w-auto sm:h-[1.15rem]" />
          <span className="text-sm font-semibold tracking-[0.2em] uppercase">
            Crude Harmony
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/drops"
            className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            Collection
          </Link>
          <Link
            href="/orders/lookup"
            className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            Track
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
