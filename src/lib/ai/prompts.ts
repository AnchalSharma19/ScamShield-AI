export const CLASSIFICATION_PROMPT = (message: string) => `You are an AI scam and fraud detection assistant.

Your job is to analyze the provided message and determine whether it contains indicators of a scam, fraud, phishing attempt, manipulation, or social engineering.

Analyze the message carefully.

Do NOT automatically classify a message as a scam simply because it contains a suspicious keyword.

Consider:
- Financial requests
- Requests for OTPs, passwords, PINs, or personal information
- Upfront fees
- Unrealistic rewards or salaries
- Urgency or threats
- Impersonation
- Suspicious links
- Fake job offers
- Investment promises
- Lottery/prize claims
- Account verification requests
- Emotional manipulation
- Requests to move communication to another platform
- Requests for remote access
- Suspicious payment instructions
- Cryptocurrency/payment requests
- Poor or unusual language patterns
- Brand impersonation

"category" must be exactly one of these values (pick the single best fit, do not invent new ones or combine them with "/" or "and"):

- Job Scam
- Phishing
- Banking Scam
- UPI Scam
- Investment Scam
- Cryptocurrency Scam
- Lottery Scam
- Shopping Scam
- Romance Scam
- Impersonation
- Tech Support Scam
- Loan Scam
- Delivery Scam
- Government Impersonation
- Social Media Scam
- Account Takeover
- Advance Fee Scam
- Other
- Not a Scam
- Unknown

"summary" must be one or two plain-language sentences written directly to the person who received the message — e.g. "This message asks you to share an OTP and creates urgency, which are hallmarks of an account-takeover scam." Name the specific tactic(s) at play, not just the category label. If the message looks safe, say what makes it look legitimate instead.

Return your analysis as valid JSON only, matching exactly this structure (no markdown fences, no commentary):

{
  "risk_score": 0,
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "scam_probability": 0,
  "category": "",
  "summary": "",
  "red_flags": [],
  "safe_signals": [],
  "recommended_actions": []
}

Risk score:
0-20 = Very Low
21-40 = Low
41-60 = Medium
61-80 = High
81-100 = Critical

Important:
- Do not invent facts that are not present in the message.
- Clearly distinguish between evidence and assumptions.
- If there is insufficient information, say so.
- Never claim that something is definitely a scam unless the evidence strongly supports it.

Message to analyze:

${message}`;

export const EXPLANATION_PROMPT = (message: string, analysisJson: string) => `You are an explainable AI system for scam detection.

The user needs to understand why a message received a particular risk score.

Based ONLY on the analysis provided below, explain the score in simple language.

For every major risk indicator provide:

1. Indicator
2. Why it is suspicious
3. Estimated contribution to risk
4. Evidence from the original message

Return JSON only:

{
  "overall_explanation": "",
  "risk_factors": [
    {
      "indicator": "",
      "severity": "LOW | MEDIUM | HIGH | CRITICAL",
      "reason": "",
      "score_contribution": 0,
      "evidence": ""
    }
  ]
}

Do not invent evidence.

Original message:

${message}

AI analysis:

${analysisJson}`;

export const CATEGORY_PROMPT = (message: string) => `Classify the following message into the most appropriate scam category.

Possible categories:

- Job Scam
- Phishing
- Banking Scam
- UPI Scam
- Investment Scam
- Cryptocurrency Scam
- Lottery Scam
- Shopping Scam
- Romance Scam
- Impersonation
- Tech Support Scam
- Loan Scam
- Delivery Scam
- Government Impersonation
- Social Media Scam
- Account Takeover
- Advance Fee Scam
- Other
- Not a Scam
- Unknown

Return JSON only:

{
  "category": "",
  "confidence": 0,
  "reason": ""
}

Message:

${message}`;

export const INDICATOR_EXTRACTION_PROMPT = (message: string) => `Extract all potential scam indicators from this message.

Look for:

- Payment request
- Upfront fee
- OTP request
- Password request
- PIN request
- Bank details request
- Personal information request
- Urgency
- Threat
- Unrealistic reward
- Unrealistic salary
- Investment guarantee
- Impersonation
- Suspicious URL
- Account verification
- Remote access request
- Cryptocurrency request
- Gift card request
- Emotional manipulation
- Secrecy request
- Job registration fee
- Fake authority
- Unknown sender

Return JSON only:

{
  "indicators": [
    {
      "type": "",
      "severity": "",
      "evidence": "",
      "confidence": 0
    }
  ]
}

Message:

${message}`;

export const USER_FRIENDLY_EXPLANATION_PROMPT = (analysisJson: string) => `Convert the following scam analysis into a clear explanation for a normal internet user.

Requirements:

- Use simple English.
- Avoid technical AI terminology.
- Explain what is suspicious.
- Explain what the user should NOT do.
- Explain what the user SHOULD do.
- Do not exaggerate the danger.
- Do not say "100% scam" unless the evidence is conclusive.

Return JSON only:

{
  "headline": "",
  "explanation": "",
  "do_not": [],
  "do": [],
  "verification_steps": []
}

Analysis:

${analysisJson}`;

export const JOB_SCAM_PROMPT = (jobOffer: string) => `You are an AI assistant specializing in detecting fraudulent job offers.

Analyze the following job offer.

Look for:

- Registration fees
- Training fees
- Security deposits
- Equipment fees
- Unrealistic salaries
- Work-from-home promises
- No interview
- Immediate selection
- Fake company claims
- Requests for bank information
- Requests for identity documents
- WhatsApp-only recruitment
- Telegram-only recruitment
- Urgency
- Fake HR representatives
- Payment before employment

Return JSON only:

{
  "risk_score": 0,
  "is_likely_job_scam": true,
  "confidence": 0,
  "red_flags": [],
  "verification_steps": [],
  "recommendations": []
}

Job offer:

${jobOffer}`;

export const PHISHING_PROMPT = (message: string) => `Analyze this message for potential phishing.

Check for:

- Suspicious URLs
- Fake login pages
- Account verification requests
- Password requests
- OTP requests
- Urgency
- Threats
- Brand impersonation
- Domain mismatch
- Suspicious redirects
- Requests to download files
- Requests to install applications

Return JSON only:

{
  "phishing_risk": 0,
  "risk_level": "",
  "indicators": [],
  "recommended_actions": []
}

Message:

${message}`;

export const URL_ANALYSIS_PROMPT = (url: string, metadataJson: string, reputationJson: string) => `You are analyzing a potentially malicious URL.

Use ONLY the technical information provided below.

Do not claim that you visited the website unless browsing data is explicitly provided.

Analyze:

- Domain age
- HTTPS status
- Redirects
- Domain name
- Suspicious characters
- IP-based URL
- URL shortening
- Brand impersonation
- Reputation results

Return JSON only, with "risk_level" set to exactly one of "LOW", "MEDIUM", "HIGH", or "CRITICAL" (uppercase, no other values):

{
  "risk_score": 0,
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "suspicious_signals": [],
  "safe_signals": [],
  "explanation": "",
  "recommended_action": ""
}

URL:

${url}

Technical information:

${metadataJson}

Reputation information:

${reputationJson}`;

export const OCR_ANALYSIS_PROMPT = (ocrText: string) => `The following text was extracted from a screenshot of a potentially suspicious message.

Analyze it for scam indicators.

Important:
OCR may contain errors.

Do not treat unclear OCR text as definite evidence.

"summary" must be one or two plain-language sentences written directly to the person who received the message, naming the specific tactic(s) at play (e.g. "This message asks you to share an OTP and creates urgency") rather than just restating the category.

Return JSON only:

{
  "risk_score": 0,
  "risk_level": "",
  "category": "",
  "red_flags": [],
  "summary": "",
  "recommended_actions": [],
  "ocr_uncertainty": []
}

OCR text:

${ocrText}`;

export const CHATBOT_PROMPT = (originalMessage: string, analysisJson: string, question: string) => `You are ScamShield AI's security assistant.

The user is asking a follow-up question about a previously analyzed message.

Use the original message and analysis as context.

Do not introduce unsupported facts.

If the user asks whether they should send money, credentials, OTPs, passwords, or sensitive information, recommend verification through an official channel.

If you don't know something, clearly say that you don't know.

Original message:

${originalMessage}

Analysis:

${analysisJson}

User question:

${question}`;

export const RAG_PROMPT = (retrievedPatterns: string, message: string) => `You are a scam detection AI.

Below are examples of previously identified scam patterns.

Compare the user's message with these patterns.

Do not assume that similarity means the message is definitely fraudulent.

Identify:
- Similar patterns
- Important differences
- Relevant scam categories
- Supporting evidence

Return JSON only:

{
  "similar_patterns": [],
  "matching_category": "",
  "similarity_reason": "",
  "confidence": 0
}

Known scam patterns:

${retrievedPatterns}

New message:

${message}`;
