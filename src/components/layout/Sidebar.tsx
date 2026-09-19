"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Search, History, Inbox, Settings, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { cn } from "cn";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, requiresAuth: true },
  { href: "/analyze", label: "Analyze", icon: Search },
  { href: "/history", label: "History", icon: History, requiresAuth: true },
  { href: "/inbox", label: "Inbox", icon: Inbox, requiresAuth: true },
  { href: "/settings/channels", label: "Channels", icon: Settings, requiresAuth: true },
];

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const items = NAV_ITEMS.filter((item) => !item.requiresAuth || (supabaseConfigured && user));

  const content = (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 px-5 py-5 font-heading font-semibold tracking-tight"
      >
        <ShieldCheck className="h-5 w-5 text-primary" />
        ScamShield AI
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/65 hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                  active && "text-primary"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-4">
        <ThemeToggle />
        {supabaseConfigured && user ? (
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" size="icon" onClick={signOut} aria-label="Sign out" />}>
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>{user.email}</TooltipContent>
          </Tooltip>
        ) : (
          <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:p-3">
        <div className="glass flex h-full flex-col rounded-2xl border border-sidebar-border bg-sidebar shadow-lg">
          {content}
        </div>
      </div>

      <div className="glass flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          ScamShield AI
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="glass absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar shadow-xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
