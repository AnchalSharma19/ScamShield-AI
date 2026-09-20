"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, MessageCircle, Trash2, Smartphone, Send, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { platformMeta } from "@/lib/scam/platforms";

interface ConnectedChannel {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  phone_number: string | null;
  connected_at: string;
}

const OAUTH_CONNECTABLE = [
  { platform: "whatsapp", label: "WhatsApp", href: "/api/zernio/connect?platform=whatsapp" },
  { platform: "instagram", label: "Instagram", href: "/api/zernio/connect?platform=instagram" },
  { platform: "facebook", label: "Facebook Messenger", href: "/api/zernio/connect?platform=facebook" },
  { platform: "slack", label: "Slack", href: "/api/slack/connect" },
];

interface TelegramCode {
  code: string;
  botUsername: string;
  instructions: string[];
  expiresIn: number;
}

interface DiscordCode {
  code: string;
  botInviteUrl: string;
  instructions: string[];
  expiresAt: string;
}

export default function ChannelsPage() {
  return (
    <Suspense fallback={null}>
      <ChannelsPageContent />
    </Suspense>
  );
}

function ChannelsPageContent() {
  const [channels, setChannels] = useState<ConnectedChannel[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<TelegramCode | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<"pending" | "connected" | "expired" | null>(null);
  const [startingTelegram, setStartingTelegram] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [discordCode, setDiscordCode] = useState<DiscordCode | null>(null);
  const [discordStatus, setDiscordStatus] = useState<"pending" | "connected" | "expired" | null>(null);
  const [startingDiscord, setStartingDiscord] = useState(false);
  const discordPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchParams = useSearchParams();

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  function loadChannels() {
    return fetch("/api/zernio/channels")
      .then((res) => res.json())
      .then((data) => setChannels(data.channels ?? []));
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/zernio/channels")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setChannels(data.channels ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (discordPollRef.current) clearInterval(discordPollRef.current);
    };
  }, []);

  async function handleDisconnect(id: string) {
    setRemovingId(id);
    await fetch(`/api/zernio/channels?id=${id}`, { method: "DELETE" });
    setChannels((prev) => prev?.filter((c) => c.id !== id) ?? null);
    setRemovingId(null);
  }

  async function syncSms() {
    setSyncing(true);
    try {
      const res = await fetch("/api/zernio/sms/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await loadChannels();
        if (data.synced === 0) {
          alert("No active phone numbers found on your Zernio account. Buy and register one in the Zernio dashboard first.");
        }
      } else {
        alert(data.error ?? "Failed to sync phone numbers");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function startTelegramConnect() {
    setStartingTelegram(true);
    try {
      const res = await fetch("/api/zernio/telegram/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to start Telegram connection");
        return;
      }
      setTelegramCode(data);
      setTelegramStatus("pending");

      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/zernio/telegram/status?code=${data.code}`);
        const status = await statusRes.json();

        if (status.status === "connected") {
          setTelegramStatus("connected");
          if (pollRef.current) clearInterval(pollRef.current);
          await loadChannels();
        } else if (status.status === "expired") {
          setTelegramStatus("expired");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 3000);
    } finally {
      setStartingTelegram(false);
    }
  }

  function closeTelegramDialog() {
    if (pollRef.current) clearInterval(pollRef.current);
    setTelegramCode(null);
    setTelegramStatus(null);
  }

  async function startDiscordConnect() {
    setStartingDiscord(true);
    try {
      const res = await fetch("/api/discord/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to start Discord connection");
        return;
      }
      setDiscordCode(data);
      setDiscordStatus("pending");

      discordPollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/discord/status?code=${data.code}`);
        const status = await statusRes.json();

        if (status.status === "connected") {
          setDiscordStatus("connected");
          if (discordPollRef.current) clearInterval(discordPollRef.current);
          await loadChannels();
        } else if (status.status === "expired") {
          setDiscordStatus("expired");
          if (discordPollRef.current) clearInterval(discordPollRef.current);
        }
      }, 3000);
    } finally {
      setStartingDiscord(false);
    }
  }

  function closeDiscordDialog() {
    if (discordPollRef.current) clearInterval(discordPollRef.current);
    setDiscordCode(null);
    setDiscordStatus(null);
  }

  const connectedPlatforms = new Set((channels ?? []).map((c) => c.platform));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-10">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Your connected apps</h1>
          <p className="text-sm text-muted-foreground">
            Link a messaging account and every incoming message gets scanned automatically, with a risk alert sent right back in the thread.
          </p>
        </div>
      </div>

      {connected && (
        <Alert>
          <AlertDescription>{connected} connected successfully.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Connection failed: {error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {channels === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels connected yet.</p>
          ) : (
            channels.map((channel) => {
              const meta = platformMeta(channel.platform);
              const Icon = meta.icon;
              return (
                <div key={channel.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${meta.badgeClass}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {channel.phone_number ?? channel.username ?? channel.display_name ?? "Connected"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDisconnect(channel.id)} disabled={removingId === channel.id}>
                    {removingId === channel.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a new channel</CardTitle>
          <CardDescription>You&apos;ll log in through the platform itself — your password never touches our servers.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OAUTH_CONNECTABLE.map(({ platform, label, href }) => {
            const meta = platformMeta(platform);
            const Icon = meta.icon;
            const isConnected = connectedPlatforms.has(platform);
            return (
              <Button
                key={platform}
                variant="outline"
                disabled={isConnected}
                nativeButton={false}
                render={<a href={href} />}
                className="justify-start"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${meta.badgeClass}`}>
                  <Icon className="h-3 w-3" />
                </span>
                {isConnected ? `${label} — Connected` : `Connect ${label}`}
              </Button>
            );
          })}
          <Button
            variant="outline"
            disabled={connectedPlatforms.has("telegram") || startingTelegram}
            onClick={startTelegramConnect}
            className="justify-start"
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${platformMeta("telegram").badgeClass}`}>
              {startingTelegram ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </span>
            {connectedPlatforms.has("telegram") ? "Telegram — Connected" : "Connect Telegram"}
          </Button>
          <Button
            variant="outline"
            disabled={connectedPlatforms.has("discord") || startingDiscord}
            onClick={startDiscordConnect}
            className="justify-start"
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${platformMeta("discord").badgeClass}`}>
              {startingDiscord ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
            </span>
            {connectedPlatforms.has("discord") ? "Discord — Connected" : "Connect Discord"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS / MMS</CardTitle>
          <CardDescription>
            Numbers are bought and registered from your Zernio dashboard (US numbers need carrier registration first).
            Once one is live, pull it in here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={syncSms} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Sync phone numbers
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-1">
          Note
        </Badge>
        Snapchat has no messaging API on any platform, including Zernio — DM monitoring isn&apos;t possible for it.
      </p>

      <Dialog open={telegramCode != null} onOpenChange={(open) => !open && closeTelegramDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
            <DialogDescription>
              Telegram doesn&apos;t use a login popup — you connect by messaging a bot directly.
            </DialogDescription>
          </DialogHeader>

          {telegramCode && (
            <div className="space-y-3">
              <ol className="list-inside list-decimal space-y-1 text-sm">
                {telegramCode.instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>

              <div className="rounded-md border bg-muted/30 p-3 text-center font-mono text-lg font-semibold">{telegramCode.code}</div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {telegramStatus === "pending" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Waiting for you to message @{telegramCode.botUsername}...
                  </>
                )}
                {telegramStatus === "connected" && <span className="font-medium text-emerald-600">Connected! You can close this.</span>}
                {telegramStatus === "expired" && <span className="text-destructive">Code expired — close and try again.</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={discordCode != null} onOpenChange={(open) => !open && closeDiscordDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Discord</DialogTitle>
            <DialogDescription>Discord doesn&apos;t use a login popup either — you connect by DMing a bot directly.</DialogDescription>
          </DialogHeader>

          {discordCode && (
            <div className="space-y-3">
              <ol className="list-inside list-decimal space-y-1 text-sm">
                <li>
                  <a href={discordCode.botInviteUrl} target="_blank" rel="noreferrer" className="underline">
                    Invite the bot to a server you&apos;re in
                  </a>{" "}
                  (required — Discord doesn&apos;t allow DMing a bot you don&apos;t share a server with).
                </li>
                {discordCode.instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>

              <div className="rounded-md border bg-muted/30 p-3 text-center font-mono text-lg font-semibold">{discordCode.code}</div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {discordStatus === "pending" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Waiting for you to DM the bot...
                  </>
                )}
                {discordStatus === "connected" && <span className="font-medium text-emerald-600">Connected! You can close this.</span>}
                {discordStatus === "expired" && <span className="text-destructive">Code expired — close and try again.</span>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
