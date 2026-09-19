"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, AlertTriangle, Search, Inbox as InboxIcon, Send, MessageCircle, HelpCircle, Archive, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RISK_LEVEL_COLORS } from "@/lib/scam/categories";

interface Conversation {
  id: string;
  platform: string;
  accountId: string;
  accountUsername: string;
  participantName: string;
  participantPicture: string | null;
  lastMessage: string;
  updatedTime: string;
  status: "active" | "archived";
  unreadCount: number | null;
}

interface ThreadMessage {
  id: string;
  message: string;
  senderName: string | null;
  direction: "incoming" | "outgoing";
  createdAt: string;
  risk: { riskScore: number; riskLevel: string; category: string } | null;
}

interface ConversationRiskPoint {
  analyzedAt: string;
  riskScore: number;
  riskLevel: string;
  category: string;
}

interface ConversationRisk {
  score: number;
  level: string;
  messageCount: number;
  escalating: boolean;
  timeline: ConversationRiskPoint[];
}

const ZERNIO_PLATFORMS = new Set(["whatsapp", "instagram", "facebook", "telegram", "sms"]);

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({ name, size = "h-11 w-11 text-sm" }: { name: string; size?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColor(name)} ${size}`}>
      {initials(name)}
    </div>
  );
}

/** Escalation, from message content sequence rather than any single message's score, is why a conversation-level score exists at all — a scam can look mundane message-by-message and only reveal itself as a trend. */
function ConversationRiskBanner({ risk }: { risk: ConversationRisk }) {
  const colors = RISK_LEVEL_COLORS[risk.level] ?? RISK_LEVEL_COLORS.LOW;
  const recentPoints = risk.timeline.slice(-8);

  return (
    <div className={`flex flex-col gap-2 border-b px-4 py-2.5 ${colors.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${colors.text}`}>
          <AlertTriangle className="h-4 w-4" />
          Conversation risk: {risk.level} · {risk.score}/100
        </div>
        <span className="text-xs text-muted-foreground">{risk.messageCount} messages analyzed</span>
      </div>
      {risk.escalating && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <TrendingUp className="h-3.5 w-3.5" />
          Risk is escalating over the course of this conversation
        </div>
      )}
      <div className="flex items-center gap-1">
        {recentPoints.map((p, i) => (
          <span
            key={i}
            title={`${p.riskLevel} · ${p.riskScore}/100 · ${relativeTime(p.analyzedAt)}`}
            className={`h-1.5 flex-1 rounded-full ${RISK_LEVEL_COLORS[p.riskLevel]?.dot ?? "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}

type FilterTab = "all" | "unread" | "archived";

const FILTERS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All chats" },
  { value: "unread", label: "Unread" },
  { value: "archived", label: "Archived" },
];

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [conversationRisk, setConversationRisk] = useState<ConversationRisk | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/zernio/conversations").then((res) => res.json()),
      fetch("/api/channels/conversations").then((res) => res.json()),
    ]).then(([zernio, direct]) => {
      if (cancelled) return;
      if (zernio.error) setError(zernio.error);
      const merged = [...(zernio.data ?? []), ...(direct.data ?? [])].sort(
        (a, b) => new Date(b.updatedTime).getTime() - new Date(a.updatedTime).getTime()
      );
      setConversations(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return (conversations ?? [])
      .filter((c) => {
        if (tab === "unread") return c.status === "active" && (c.unreadCount ?? 0) > 0;
        if (tab === "archived") return c.status === "archived";
        return c.status === "active";
      })
      .filter((c) => c.participantName?.toLowerCase().includes(search.toLowerCase()));
  }, [conversations, tab, search]);

  const counts = useMemo(() => {
    const active = (conversations ?? []).filter((c) => c.status === "active");
    return {
      all: active.length,
      unread: active.filter((c) => (c.unreadCount ?? 0) > 0).length,
      archived: (conversations ?? []).filter((c) => c.status === "archived").length,
    };
  }, [conversations]);

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  function messagesUrl(conversation: Conversation): string {
    return ZERNIO_PLATFORMS.has(conversation.platform)
      ? `/api/zernio/conversations/${conversation.id}/messages?accountId=${conversation.accountId}`
      : `/api/channels/conversations/${conversation.id}/messages`;
  }

  function openConversation(conversation: Conversation) {
    setSelectedId(conversation.id);
    setShowThreadOnMobile(true);
    setMessages(null);
    setConversationRisk(null);
    fetch(messagesUrl(conversation))
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setConversationRisk(data.conversationRisk ?? null);
      });
  }

  async function sendReply() {
    const text = draft.trim();
    if (!text || !selected || sending) return;

    setSending(true);
    setDraft("");

    // Optimistic bubble so the send feels instant; replaced by the real
    // thread once we refetch below (the platform's own id isn't known yet).
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...(prev ?? []),
      { id: optimisticId, message: text, senderName: null, direction: "outgoing", createdAt: new Date().toISOString(), risk: null },
    ]);

    try {
      const isZernio = ZERNIO_PLATFORMS.has(selected.platform);
      const res = await fetch(messagesUrl(selected), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isZernio ? { accountId: selected.accountId, message: text } : { message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to send message");
        setMessages((prev) => prev?.filter((m) => m.id !== optimisticId) ?? null);
        return;
      }

      const refreshed = await fetch(messagesUrl(selected)).then((r) => r.json());
      setMessages(refreshed.messages ?? []);
      setConversationRisk(refreshed.conversationRisk ?? null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen w-full flex-1 overflow-hidden">
      <div className={`flex w-full flex-col border-r border-border md:w-[26rem] md:shrink-0 ${showThreadOnMobile ? "hidden md:flex" : "flex"}`}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-1.5 text-xl font-bold">
              Chats <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </h1>
            <HelpCircle className="h-4 w-4 text-muted-foreground/60" />
          </div>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search chats..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full bg-muted pr-9 pl-9" />
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
              /
            </kbd>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTab(f.value)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                    tab === f.value ? "bg-white/20" : "bg-foreground/10"
                  }`}
                >
                  {counts[f.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <p className="p-4 text-sm text-destructive">{error}</p>}

          {conversations === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              {tab === "archived" ? (
                <Archive className="h-8 w-8 text-muted-foreground/50" />
              ) : (
                <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
              )}
              <p className="text-sm font-medium">No chats here yet</p>
              <p className="text-xs text-muted-foreground">When new conversations arrive, they&apos;ll appear here.</p>
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === c.id ? "bg-muted" : ""
                }`}
              >
                <Avatar name={c.participantName || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.participantName || "Unknown"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.updatedTime)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted-foreground">{c.lastMessage}</p>
                    {c.unreadCount != null && c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] capitalize text-muted-foreground/70">{c.platform}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={`min-w-0 flex-1 flex-col ${showThreadOnMobile ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">No chat selected</p>
            <p className="text-xs text-muted-foreground">Pick a conversation from the list to start replying.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b p-4">
              <button onClick={() => setShowThreadOnMobile(false)} className="text-muted-foreground hover:text-foreground md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar name={selected.participantName || "?"} size="h-9 w-9 text-xs" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected.participantName}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {selected.platform} · @{selected.accountUsername}
                </p>
              </div>
            </div>

            {conversationRisk && conversationRisk.messageCount > 1 && (
              <ConversationRiskBanner risk={conversationRisk} />
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  const colors = m.risk ? RISK_LEVEL_COLORS[m.risk.riskLevel] : null;
                  return (
                    <div key={m.id} className={`flex ${m.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] space-y-1 ${m.direction === "outgoing" ? "text-right" : "text-left"}`}>
                        <div
                          className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                            m.direction === "outgoing" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {m.message || <span className="italic opacity-60">[attachment]</span>}
                        </div>
                        <div className={`text-[11px] text-muted-foreground/70 ${m.direction === "outgoing" ? "text-right" : "text-left"}`}>
                          {relativeTime(m.createdAt)}
                        </div>
                        {m.risk && colors && (
                          <div className={`flex items-center gap-1 text-xs font-medium ${colors.text} ${m.direction === "outgoing" ? "justify-end" : ""}`}>
                            <AlertTriangle className="h-3 w-3" />
                            {m.risk.riskLevel} · {m.risk.riskScore}/100 · {m.risk.category}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-end gap-2 border-t p-3">
              <Input
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={sendReply} disabled={sending || !draft.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
