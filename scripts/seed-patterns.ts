/**
 * Seeds the scam_patterns table with example patterns and their embeddings,
 * so the RAG pipeline (lib/rag) has something to compare new messages
 * against. Requires GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Run with: npx tsx scripts/seed-patterns.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { embedText } from "../src/lib/ai/embeddings";

const SEED_PATTERNS: { category: string; pattern: string; description: string }[] = [
  {
    category: "Job Scam",
    pattern: "Congratulations! You are selected for a work-from-home job. Pay a refundable registration fee of ₹1500 to activate your account.",
    description: "Fake job offer requiring an upfront 'registration' or 'activation' fee before any real work begins.",
  },
  {
    category: "Banking Scam",
    pattern: "Your bank account will be suspended in 24 hours. Verify your account immediately by sharing the OTP sent to your phone.",
    description: "Impersonates a bank, uses urgency and threat of suspension to extract an OTP.",
  },
  {
    category: "Lottery Scam",
    pattern: "You have won $500,000 in the international lottery. To claim your prize, send a processing fee via wire transfer.",
    description: "Classic advance-fee lottery scam — a prize the recipient never entered to win, gated behind a fee.",
  },
  {
    category: "Investment Scam",
    pattern: "Join our exclusive trading group. Guaranteed 30% returns per week, no risk. Limited slots, invest now via crypto wallet.",
    description: "Guaranteed unrealistic returns combined with urgency and a crypto payment channel.",
  },
  {
    category: "Tech Support Scam",
    pattern: "Your computer has a virus. Call this number immediately and allow us remote access via AnyDesk to fix it.",
    description: "Fake virus alert leading to a request for remote-desktop access.",
  },
  {
    category: "Delivery Scam",
    pattern: "Your package is held at customs. Pay a small clearance fee via the link below to release your delivery.",
    description: "Fake courier/customs notice with a small 'clearance fee' link, often a phishing page.",
  },
  {
    category: "Romance Scam",
    pattern: "I really care about you but I'm stuck abroad and need emergency funds to come see you. Please don't tell anyone.",
    description: "Emotional manipulation plus a request for secrecy and money from an online-only relationship.",
  },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || !process.env.GEMINI_API_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  for (const seed of SEED_PATTERNS) {
    const embedding = await embedText(seed.pattern);
    const { error } = await supabase.from("scam_patterns").insert({
      category: seed.category,
      pattern: seed.pattern,
      description: seed.description,
      embedding,
    });

    if (error) {
      console.error(`Failed to insert pattern (${seed.category}):`, error.message);
    } else {
      console.log(`Seeded: ${seed.category}`);
    }
  }

  console.log("Done.");
}

main();
