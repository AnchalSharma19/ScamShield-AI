"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageInput } from "@/components/analysis/MessageInput";
import { ScreenshotUpload } from "@/components/analysis/ScreenshotUpload";
import { URLAnalyzer } from "@/components/analysis/URLAnalyzer";
import { AnalysisResultCard } from "@/components/analysis/AnalysisResultCard";
import type { AnalysisResult } from "@/types/analysis";

export default function AnalyzePage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tab, setTab] = useState("text");

  function handleResult(next: AnalysisResult) {
    setResult(next);
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Run a scan</h1>
        <p className="text-muted-foreground">
          Drop in a message, job offer, screenshot, or link and see exactly why it&apos;s risky — in seconds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What do you want checked?</CardTitle>
          <CardDescription>We only keep a record of this if you&apos;re signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(next) => {
              setTab(next);
              setResult(null);
            }}
          >
            <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:grid sm:grid-cols-4">
              <TabsTrigger value="text" className="shrink-0">Message</TabsTrigger>
              <TabsTrigger value="job_offer" className="shrink-0">Job Offer</TabsTrigger>
              <TabsTrigger value="screenshot" className="shrink-0">Screenshot</TabsTrigger>
              <TabsTrigger value="url" className="shrink-0">URL</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="pt-4">
              <MessageInput inputType="text" onResult={handleResult} />
            </TabsContent>
            <TabsContent value="job_offer" className="pt-4">
              <MessageInput inputType="job_offer" onResult={handleResult} />
            </TabsContent>
            <TabsContent value="screenshot" className="pt-4">
              <ScreenshotUpload onResult={handleResult} />
            </TabsContent>
            <TabsContent value="url" className="pt-4">
              <URLAnalyzer />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result && <AnalysisResultCard result={result} />}
    </div>
  );
}
