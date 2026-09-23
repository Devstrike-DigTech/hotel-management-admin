import type { Metadata } from "next";
import { ReviewsView } from "@/components/reviews/reviews-view";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <RequireCap cap="reviews.read" what="Reviews">
      <ReviewsView />
    </RequireCap>
  );
}
