"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  emptyCheckoutState,
  type CheckoutFieldName,
  type CheckoutState,
} from "@/lib/checkout-constants";
import { submitCheckout } from "@/app/checkout/actions";

export function CheckoutForm() {
  const [state, formAction] = useActionState<CheckoutState, FormData>(
    submitCheckout,
    emptyCheckoutState,
  );
  const errorBannerRef = useRef<HTMLParagraphElement>(null);

  // Move focus to the first thing that's wrong. Without this a rejected
  // submission can leave the customer looking at an unchanged-looking form
  // with the actual error further up or down the page.
  useEffect(() => {
    const firstBadField = Object.keys(state.fieldErrors)[0];
    if (firstBadField) {
      const el = document.getElementById(firstBadField);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (state.formError) {
      errorBannerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {/* No hidden variant or quantity: the lines come from the server-side
          bag cookie, so the browser cannot name what it is buying. */}

      {state.formError ? (
        <p
          ref={errorBannerRef}
          role="alert"
          className="rounded-[2px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.formError}
        </p>
      ) : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        state={state}
      />
      <Field
        label="Full name"
        name="shippingName"
        autoComplete="name"
        state={state}
      />
      <Field
        label="Address"
        name="shippingAddressLine1"
        autoComplete="address-line1"
        placeholder="Street, building, apartment"
        state={state}
      />
      <Field
        label="Address line 2"
        name="shippingAddressLine2"
        autoComplete="address-line2"
        optional
        state={state}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="City"
          name="shippingCity"
          autoComplete="address-level2"
          state={state}
        />
        <Field
          label="Country"
          name="shippingCountry"
          autoComplete="country-name"
          state={state}
        />
      </div>
      <Field
        label="Postal code"
        name="shippingPostalCode"
        autoComplete="postal-code"
        optional
        state={state}
      />
      <Field
        label="Order note"
        name="note"
        as="textarea"
        optional
        state={state}
      />

      <SubmitButton />

      <p className="text-xs leading-relaxed text-subtle">
        Card details are entered on the payment provider&apos;s own page. This site
        never sees or stores them.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 w-full items-center justify-center rounded-[2px] bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
    >
      {pending ? "Working…" : "Continue to payment"}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  as = "input",
  autoComplete,
  inputMode,
  placeholder,
  optional,
  state,
}: {
  label: string;
  name: CheckoutFieldName;
  type?: string;
  as?: "input" | "textarea";
  autoComplete?: string;
  inputMode?: "email" | "text";
  placeholder?: string;
  optional?: boolean;
  state: CheckoutState;
}) {
  const errorId = useId();
  const error = state.fieldErrors[name];
  const defaultValue = state.values[name] ?? "";

  // 16px (text-base) on the control: anything smaller makes iOS Safari zoom
  // the viewport when the field receives focus.
  const controlClass = `mt-2 w-full rounded-[2px] border bg-surface px-4 text-base transition-colors placeholder:text-subtle focus:border-foreground ${
    error ? "border-danger" : "border-border-strong"
  }`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium" htmlFor={name}>
          {label}
        </label>
        {optional ? <span className="text-xs text-subtle">Optional</span> : null}
      </div>

      {as === "textarea" ? (
        <textarea
          id={name}
          name={name}
          rows={3}
          maxLength={500}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${controlClass} py-3`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${controlClass} h-12`}
        />
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
