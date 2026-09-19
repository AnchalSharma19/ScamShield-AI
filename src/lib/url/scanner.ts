import type { UrlMetadata } from "@/types/analysis";

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy",
]);

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

const IMPERSONATED_BRANDS = ["paypal", "amazon", "google", "microsoft", "apple", "netflix", "bankofamerica", "chase"];

function getSuspiciousCharacters(hostname: string): string[] {
  const flags: string[] = [];
  if (/xn--/.test(hostname)) flags.push("Punycode/IDN domain (possible homograph attack)");
  if ((hostname.match(/-/g) || []).length >= 3) flags.push("Excessive hyphens in domain");
  if (/\d{4,}/.test(hostname)) flags.push("Long numeric sequence in domain");

  const registrableDomain = hostname.split(".").slice(-2, -1)[0] ?? "";
  const impersonated = IMPERSONATED_BRANDS.find((brand) => hostname.includes(brand) && registrableDomain !== brand);
  if (impersonated) flags.push(`Domain contains brand name "${impersonated}" but is not that brand's actual domain`);

  return flags;
}

/**
 * Collects real, verifiable technical facts about a URL: HTTPS, redirects,
 * hostname shape, shortener use. Does NOT fabricate domain age or claim to
 * have "browsed" the page — only a HEAD/GET request's metadata is used.
 */
export async function fetchUrlMetadata(inputUrl: string): Promise<UrlMetadata> {
  let normalized = inputUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const initial = new URL(normalized);
  const hostname = initial.hostname;

  let finalUrl = normalized;
  let redirectCount = 0;
  let httpsEnabled = initial.protocol === "https:";

  try {
    const response = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ScamShieldAI-URLScanner/1.0" },
    });
    finalUrl = response.url || normalized;
    httpsEnabled = finalUrl.startsWith("https://");
    // fetch() follows redirects transparently; `redirected` only tells us
    // whether at least one hop happened, not the exact count.
    redirectCount = response.redirected ? 1 : 0;
  } catch {
    // Unreachable, blocked, or timed out — still return what we know from the URL string itself.
  }

  const finalHostname = (() => {
    try {
      return new URL(finalUrl).hostname;
    } catch {
      return hostname;
    }
  })();

  return {
    url: inputUrl,
    domain: finalHostname,
    https_enabled: httpsEnabled,
    is_ip_based: IP_REGEX.test(finalHostname),
    uses_url_shortener: URL_SHORTENERS.has(hostname.replace(/^www\./, "")),
    redirect_count: redirectCount,
    final_url: finalUrl,
    suspicious_characters: getSuspiciousCharacters(finalHostname),
    domain_age_days: null, // requires a WHOIS API key; left null rather than guessed
  };
}
