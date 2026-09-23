import type { Metadata } from "next";
import { RegisterView } from "@/components/guests/register-view";

export const metadata: Metadata = { title: "Guest register" };

export default function RegisterPage() {
  return <RegisterView />;
}
