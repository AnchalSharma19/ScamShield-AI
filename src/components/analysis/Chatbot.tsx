"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AnalysisResult } from "@/types/analysis";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function Chatbot({ originalMessage, analysis }: { originalMessage: string; analysis: AnalysisResult }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_message: originalMessage, analysis, question: q }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: res.ok ? data.answer : `Error: ${data.error}` }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Ask about this analysis</h3>

      {messages.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3">
          {messages.map((m, idx) => (
            <div key={idx} className={`text-sm ${m.role === "user" ? "text-right" : "text-left"}`}>
              <span
                className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="e.g. Should I click the link in this message?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          disabled={loading}
        />
        <Button onClick={ask} disabled={loading || !question.trim()} size="icon">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
