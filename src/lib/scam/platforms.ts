import { MessageCircle, Send, Smartphone, Hash, MessageSquare, Camera, type LucideIcon } from "lucide-react";

export const PLATFORM_META: Record<string, { label: string; icon: LucideIcon; badgeClass: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, badgeClass: "bg-emerald-500" },
  instagram: { label: "Instagram", icon: Camera, badgeClass: "bg-pink-500" },
  facebook: { label: "Facebook", icon: MessageCircle, badgeClass: "bg-blue-600" },
  telegram: { label: "Telegram", icon: Send, badgeClass: "bg-sky-500" },
  sms: { label: "SMS", icon: Smartphone, badgeClass: "bg-slate-500" },
  slack: { label: "Slack", icon: Hash, badgeClass: "bg-violet-600" },
  discord: { label: "Discord", icon: MessageSquare, badgeClass: "bg-indigo-500" },
};

export function platformMeta(platform: string) {
  return PLATFORM_META[platform] ?? { label: platform, icon: MessageCircle, badgeClass: "bg-slate-500" };
}
