import { PlatformShell } from "@/components/platform/platform-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
