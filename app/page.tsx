import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Crude Harmony</h1>
      <p className="text-zinc-500">Limited streetwear drops.</p>
      <Link href="/drops" className="underline">
        Shop the current drop
      </Link>
    </main>
  );
}
