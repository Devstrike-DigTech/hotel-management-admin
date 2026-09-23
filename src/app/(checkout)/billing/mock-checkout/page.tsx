import type { Metadata } from "next";
import { Suspense } from "react";
import { MockCheckout } from "@/components/billing/mock-checkout";

export const metadata: Metadata = { title: "Checkout" };

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <MockCheckout />
    </Suspense>
  );
}
