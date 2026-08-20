import { OrderLookupForm } from "@/components/OrderLookupForm";

export default function OrderLookupPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-xl font-semibold">Track your order</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your order number and the email you used at checkout.
      </p>
      <div className="mt-6">
        <OrderLookupForm />
      </div>
    </main>
  );
}
