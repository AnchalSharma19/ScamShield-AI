"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AnalysisResult, InputType } from "@/types/analysis";

const PLACEHOLDER: Record<string, string> = {
  text: "Paste a suspicious text message, email, or WhatsApp chat here...",
  job_offer: "Paste the full job offer message here...",
};

export function MessageInput({
  inputType,
  onResult,
}: {
  inputType: Extract<InputType, "text" | "job_offer" | "email" | "whatsapp" | "social_media">;
  onResult: (result: AnalysisResult) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, input_type: inputType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      onResult(data);
    } catch {
      setError("Could not reach the analysis service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const nearLimit = text.length > 9000;

  return (
    <div className="space-y-3">
      <Textarea
        placeholder={PLACEHOLDER[inputType] ?? PLACEHOLDER.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={10000}
        disabled={loading}
        className="resize-none"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs tabular-nums ${nearLimit ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          {text.length.toLocaleString()}/10,000
        </span>
        <Button onClick={analyze} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? "Analyzing..." : "Analyze Message"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
