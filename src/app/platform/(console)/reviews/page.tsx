import type { Metadata } from "next";
import { ModerationView } from "@/components/platform/moderation-view";

export const metadata: Metadata = { title: "Review moderation" };

export default function ModerationPage() {
  return <ModerationView />;
}
