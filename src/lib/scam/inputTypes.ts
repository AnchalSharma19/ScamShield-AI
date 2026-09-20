import { MessageSquare, Briefcase, Image as ImageIcon, Link as LinkIcon, Mail, MessageCircle, Users, Smartphone, type LucideIcon } from "lucide-react";

export const INPUT_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  text: { label: "Message", icon: MessageSquare },
  job_offer: { label: "Job Offer", icon: Briefcase },
  screenshot: { label: "Screenshot", icon: ImageIcon },
  url: { label: "URL", icon: LinkIcon },
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  social_media: { label: "Social Media", icon: Users },
  sms: { label: "SMS", icon: Smartphone },
};

export function inputTypeMeta(type: string) {
  return INPUT_TYPE_META[type] ?? { label: type, icon: MessageSquare };
}
