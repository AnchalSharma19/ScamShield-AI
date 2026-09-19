import { z } from "zod";

export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const ScamCategory = z.enum([
  "Job Scam",
  "Phishing",
  "Banking Scam",
  "UPI Scam",
  "Investment Scam",
  "Cryptocurrency Scam",
  "Lottery Scam",
  "Shopping Scam",
  "Romance Scam",
  "Impersonation",
  "Tech Support Scam",
  "Loan Scam",
  "Delivery Scam",
  "Government Impersonation",
  "Social Media Scam",
  "Account Takeover",
  "Advance Fee Scam",
  "Other",
  "Not a Scam",
  "Unknown",
]);
export type ScamCategory = z.infer<typeof ScamCategory>;

export const InputType = z.enum(["text", "email", "whatsapp", "job_offer", "social_media", "screenshot", "url", "sms"]);
export type InputType = z.infer<typeof InputType>;

export const AiAnalysisSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: RiskLevel,
  scam_probability: z.number().min(0).max(100),
  category: z.string(),
  summary: z.string(),
  red_flags: z.array(z.string()).default([]),
  safe_signals: z.array(z.string()).default([]),
  recommended_actions: z.array(z.string()).default([]),
});
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

export const IndicatorSchema = z.object({
  type: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  evidence: z.string(),
  confidence: z.number().min(0).max(100).default(70),
  score: z.number().default(0),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

export const ScoreBreakdownSchema = z.object({
  ai_score: z.number(),
  rule_score: z.number(),
  url_score: z.number().nullable(),
  pattern_score: z.number().nullable(),
  final_score: z.number(),
  weights: z.object({
    ai: z.number(),
    rule: z.number(),
    url: z.number(),
    pattern: z.number(),
  }),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const AnalysisResultSchema = z.object({
  input_type: InputType,
  input_text: z.string(),
  risk_score: z.number().min(0).max(100),
  risk_level: RiskLevel,
  category: z.string(),
  summary: z.string(),
  red_flags: z.array(z.string()),
  safe_signals: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  indicators: z.array(IndicatorSchema),
  score_breakdown: ScoreBreakdownSchema,
  ocr_uncertainty: z.array(z.string()).optional(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const UrlMetadataSchema = z.object({
  url: z.string(),
  domain: z.string(),
  https_enabled: z.boolean(),
  is_ip_based: z.boolean(),
  uses_url_shortener: z.boolean(),
  redirect_count: z.number(),
  final_url: z.string(),
  suspicious_characters: z.array(z.string()),
  domain_age_days: z.number().nullable(),
});
export type UrlMetadata = z.infer<typeof UrlMetadataSchema>;

export const UrlAnalysisResultSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: RiskLevel,
  suspicious_signals: z.array(z.string()),
  safe_signals: z.array(z.string()),
  explanation: z.string(),
  recommended_action: z.string(),
  metadata: UrlMetadataSchema,
});
export type UrlAnalysisResult = z.infer<typeof UrlAnalysisResultSchema>;
