"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, ImageIcon, X, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AnalysisResult } from "@/types/analysis";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ScreenshotUpload({ onResult }: { onResult: (result: AnalysisResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(selected: File | null) {
    setError(null);
    if (selected && !ACCEPTED_TYPES.has(selected.type)) {
      setError("Please upload a PNG, JPEG, or WebP image.");
      return;
    }
    if (selected && selected.size > MAX_BYTES) {
      setError("That image is over 8MB — try a smaller screenshot.");
      return;
    }
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    if (!file || loading) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not analyze this screenshot");
        return;
      }
      onResult(data);
    } catch {
      setError("Could not reach the analysis service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          file ? "border-border" : "cursor-pointer hover:border-primary/50 hover:bg-muted/30"
        } ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
      >
        {preview && file ? (
          <div className="relative w-full max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Screenshot preview" className="max-h-48 w-full rounded-lg object-contain" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-md hover:bg-foreground/80"
              aria-label="Remove screenshot"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <FileImage className="h-3.5 w-3.5" />
              <span className="max-w-[200px] truncate">{file.name}</span>
              <span>· {formatBytes(file.size)}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a screenshot here, or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or WebP — max 8MB</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={analyze} disabled={loading || !file}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "Reading & analyzing..." : "Analyze Screenshot"}
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
