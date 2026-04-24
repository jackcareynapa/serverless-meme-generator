import { createHash } from "node:crypto";
import OpenAI from "openai";
import { normalizeStyle } from "./styles.js";

const MAX_LEN = 48;
const PAIR_COUNT = 3;

/**
 * @param {string} s
 */
function clampLine(s) {
  return String(s || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, MAX_LEN);
}

/**
 * @typedef {{ topText: string, bottomText: string }} CaptionPairV2
 * @param {CaptionPairV2[]} pairs
 * @returns {CaptionPairV2[]}
 */
function ensureThreeCaptions(pairs) {
  const out = pairs.slice(0, PAIR_COUNT).map((p) => ({
    topText: clampLine(p.topText).toUpperCase(),
    bottomText: clampLine(p.bottomText).toUpperCase(),
  }));
  while (out.length < PAIR_COUNT) {
    out.push({ topText: "MEME", bottomText: "CAPTION" });
  }
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i].topText) out[i].topText = "TOP";
    if (!out[i].bottomText) out[i].bottomText = "BOTTOM";
  }
  return out;
}

function isProdLike() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

/**
 * Neutral, non-themed placeholders when OpenAI is unavailable (dev) or after API failure.
 * @param {string} jobId
 * @returns {CaptionPairV2[]}
 */
function minimalFallbackCaptions(jobId) {
  const token = createHash("sha256").update(`fallback|${jobId}`).digest("hex").slice(0, 4);
  return [0, 1, 2].map((i) => ({
    topText: `VARIANT ${i + 1} · ${token}`,
    bottomText: "RETRY OR CHECK API",
  }));
}

const SYSTEM = `You write meme captions for image macros (top + bottom text).
Respond with ONLY a JSON object of this exact shape, no markdown:
{"captions":[
  {"topText":"string","bottomText":"string"},
  {"topText":"string","bottomText":"string"},
  {"topText":"string","bottomText":"string"}
]}
Rules:
- Exactly three items in "captions"; each pair must be a distinct joke or angle.
- topText: short line for the top of the image; bottomText: short line for the bottom.
- Max ${MAX_LEN} characters per string; no newlines; keep it safe for work: no slurs, hate, or explicit content.
- Match the requested tone. Use the user's prompt/idea; if the prompt is empty, invent three funny angles that still fit the tone.`;

/**
 * @param {string} userPrompt
 * @param {string} tone
 * @param {string} model
 * @returns {Promise<CaptionPairV2[] | null>}
 */
async function generateWithOpenAI(userPrompt, tone, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model: model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.85,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Tone: ${tone}\nMeme idea / context: ${(userPrompt && userPrompt.trim()) || "(none — invent three funny variants that fit the tone only)"}`,
      },
    ],
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed?.captions || !Array.isArray(parsed.captions)) return null;
  const pairs = parsed.captions
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      topText: String(c.topText ?? ""),
      bottomText: String(c.bottomText ?? ""),
    }));
  if (pairs.length < PAIR_COUNT) return null;
  return ensureThreeCaptions(pairs);
}

/**
 * @param {object} opts
 * @param {string} [opts.context]
 * @param {string} [opts.style]
 * @param {string} opts.jobId
 * @param {"openai" | "fallback" | "auto"} [opts.mode]
 * @returns {Promise<{ pairs: CaptionPairV2[], source: "openai" | "fallback" }>}
 */
export async function generateCaptionPairs({ context, style, jobId, mode = "auto" }) {
  const tone = normalizeStyle(style);
  const prompt = typeof context === "string" ? context : "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (mode === "fallback") {
    return { pairs: minimalFallbackCaptions(jobId), source: "fallback" };
  }

  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  if (isProdLike() && !hasKey) {
    throw new Error("OPENAI_API_KEY is not configured. Add it in Vercel project settings.");
  }

  if (mode === "openai" || (mode === "auto" && hasKey)) {
    try {
      const pairs = await generateWithOpenAI(prompt, tone, model);
      if (pairs) return { pairs, source: "openai" };
    } catch (e) {
      console.error("openai_caption_error", e?.message || e);
      if (mode === "openai") throw e;
    }
  }

  if (!hasKey) {
    return { pairs: minimalFallbackCaptions(jobId), source: "fallback" };
  }

  return { pairs: minimalFallbackCaptions(jobId), source: "fallback" };
}

export { MAX_LEN, PAIR_COUNT };
