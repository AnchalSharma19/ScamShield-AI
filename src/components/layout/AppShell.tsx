"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

const CHROMELESS_ROUTES = new Set(["/", "/login"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !CHROMELESS_ROUTES.has(pathname);

  if (!showSidebar) {
    return <main className="flex flex-1 flex-col">{children}</main>;
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-x-hidden md:py-3 md:pr-3">{children}</main>
    </div>
  );
}
