"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  ScanSearch,
  ImageIcon,
  Link2,
  MessageSquare,
  AlertTriangle,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

const FEATURES = [
  {
    icon: ScanSearch,
    title: "See the score, see the why",
    description: "Every check returns a 0-100 score with the exact reasons behind it — nothing hidden, nothing guessed.",
    iconClass: "bg-primary/15 text-primary",
  },
  {
    icon: ImageIcon,
    title: "Screenshots work just as well",
    description: "Send a screenshot of any chat or email and we read the text off it, then run the same full check.",
    iconClass: "bg-teal-500/15 text-teal-500",
  },
  {
    icon: Link2,
    title: "Every link gets a real inspection",
    description: "We look at HTTPS, redirects, shorteners, and domain patterns, then let AI make sense of what it finds.",
    iconClass: "bg-amber-500/15 text-amber-500",
  },
  {
    icon: MessageSquare,
    title: "Already covers your favorite apps",
    description: "WhatsApp, Instagram, Facebook, Telegram, Slack, Discord, and SMS — connect once, get warned automatically.",
    iconClass: "bg-rose-500/15 text-rose-500",
  },
];

const HERO_REST_TILT = "perspective(1200px) rotateX(8deg) rotateY(-10deg) scale3d(1, 1, 1)";
const FLAT_REST_TILT = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";

function TiltCard({
  children,
  restTilt = FLAT_REST_TILT,
  maxTiltX = 8,
  maxTiltY = 9,
  className,
}: {
  children: React.ReactNode;
  restTilt?: string;
  maxTiltX?: number;
  maxTiltY?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(restTilt);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `perspective(1200px) rotateX(${py * -2 * maxTiltX}deg) rotateY(${px * 2 * maxTiltY}deg) scale3d(1.03, 1.03, 1.03)`
    );
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTransform(restTilt)}
      className={`[transform-style:preserve-3d] transition-transform duration-200 ease-out will-change-transform ${className ?? ""}`}
      style={{ transform }}
    >
      {children}
    </div>
  );
}

function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 30, y: 0 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div ref={ref} onMouseMove={handleMouseMove} className={`group relative ${className ?? ""}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(480px circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.28), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-heading font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            ScamShield AI
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button size="sm" className="rounded-full" nativeButton={false} render={<Link href="/login" />}>
              Join Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="space-y-1 border-t border-border/60 px-4 py-3 md:hidden">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="block py-1.5 text-sm text-muted-foreground">
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" nativeButton={false} render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button size="sm" className="flex-1 rounded-full" nativeButton={false} render={<Link href="/login" />}>
                Join Free
              </Button>
            </div>
          </div>
        )}
      </header>

      <section className="hero-glow px-4 pt-16 pb-10 md:pt-24">
        <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 text-center duration-700">
          <Badge variant="secondary" className="mx-auto mb-6 gap-1.5 rounded-full px-3 py-1">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Scam detection, explained plainly
          </Badge>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Know it&apos;s a scam <br /> before you reply.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground md:text-lg">
            Drop in a message, job offer, screenshot, or link. We break down exactly how risky it is,
            combining AI judgment, rule-based checks, and pattern matching against known scams.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full rounded-full sm:w-auto" nativeButton={false} render={<Link href="/login" />}>
              Create a free account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
              nativeButton={false}
              render={<Link href="/analyze" />}
            >
              Run a scan, no account needed
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-4xl animate-in fade-in slide-in-from-bottom-6 duration-700 [perspective:1200px]">
          <TiltCard restTilt={HERO_REST_TILT} maxTiltX={8} maxTiltY={9}>
            <Card className="glow-border overflow-hidden py-0 shadow-2xl">
              <CardContent className="p-0">
                <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3">
                  <Tooltip>
                    <TooltipTrigger render={<span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />} />
                    <TooltipContent>Live preview</TooltipContent>
                  </Tooltip>
                  <span className="h-2.5 w-2.5 rounded-full bg-chart-4/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                  <span className="ml-3 text-xs text-muted-foreground">ScamShield AI — live scan</span>
                </div>
                <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Incoming message</p>
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                      &ldquo;Your parcel couldn&apos;t be delivered — a small customs fee is due. Pay now to
                      avoid it being returned to sender...&rdquo;
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                      <span className="text-sm text-muted-foreground">Risk score</span>
                      <span className="text-lg font-bold text-destructive">92 / 100</span>
                    </div>
                    <Progress value={92} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">CRITICAL</Badge>
                      <span className="text-sm text-muted-foreground">Delivery / Fee Scam</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        Small upfront payment framed as a routine formality
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        Threat of a bad outcome if you don&apos;t act fast
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        Payment link doesn&apos;t match any real carrier domain
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TiltCard>
        </div>
      </section>

      <section id="features" className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight">Built to catch what scammers count on you missing</h2>
            <p className="mt-3 text-muted-foreground">
              Four separate checks, weighed together into one score you can actually explain to someone else.
            </p>
          </div>
          <div className="mt-12 grid gap-4 [perspective:1000px] sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <TiltCard key={feature.title} maxTiltX={6} maxTiltY={6}>
                <Card className="group relative h-full overflow-hidden border-border/60 bg-card/60 shadow-lg shadow-black/5">
                  <CardContent className="space-y-3 pt-2">
                    <span className="absolute top-4 right-4 font-heading text-2xl font-bold text-foreground/5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${feature.iconClass}`}
                    >
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-heading font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 pb-20">
        <SpotlightCard className="mx-auto max-w-4xl overflow-hidden rounded-2xl">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-cyan-600 text-primary-foreground shadow-2xl shadow-primary/25">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_0%,rgba(255,255,255,0.25),transparent)]"
            />
            <CardContent className="relative flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <ShieldCheck className="h-7 w-7" />
              </span>
              <h2 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
                Not sure what&apos;s lurking in your messages?
              </h2>
              <p className="max-w-md text-primary-foreground/85">
                Sign up once and every scan gets saved, with your messaging apps watched automatically in the background.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full bg-white text-primary hover:bg-white/90"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </SpotlightCard>
      </section>

      <footer className="border-t border-border/60 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 font-heading font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            ScamShield AI
          </div>
          <p>Developed with ❤️ by Anchal Sharma</p>
        </div>
      </footer>
    </div>
  );
}
