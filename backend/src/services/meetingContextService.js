import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { TranscriptSegment } from "../models/transcriptSegment.js";
import { TranscriptDocument } from "../models/transcriptDocument.js";
import { ContextSummary } from "../models/contextSummary.js";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function toSecondsOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeChainPoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { text: item.trim(), startTs: null, endTs: null };
    }
    const text = String(item.text ?? item.point ?? item.content ?? "").trim();
    return {
      text,
      startTs: toSecondsOrNull(item.startTs ?? item.start ?? item.t0),
      endTs: toSecondsOrNull(item.endTs ?? item.end ?? item.t1),
    };
  });
}

function normalizeHighlightPoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { text: item.trim(), startTs: null, endTs: null };
    }
    return {
      text: String(item.text ?? item.highlight ?? "").trim(),
      startTs: toSecondsOrNull(item.startTs ?? item.start),
      endTs: toSecondsOrNull(item.endTs ?? item.end),
    };
  });
}

export function buildTranscriptLines(segments) {
  return segments
    .map((s) => {
      const start = typeof s.startTs === "number" ? s.startTs.toFixed(2) : String(s.startTs);
      const end = typeof s.endTs === "number" ? s.endTs.toFixed(2) : String(s.endTs);
      const speaker = s.speakerId ? `user:${String(s.speakerId)}` : "speaker";
      return `[${start}s – ${end}s] ${speaker}: ${(s.text || "").trim()}`;
    })
    .join("\n");
}

export async function loadSegmentsForMeeting(meetingId) {
  if (!meetingId) return [];
  const or = [{ meetingId }];
  if (mongoose.Types.ObjectId.isValid(meetingId)) {
    or.push({ meetingId: new mongoose.Types.ObjectId(meetingId) });
  }
  return TranscriptSegment.find({ $or: or }).sort({ sequence: 1 }).lean();
}

export async function loadLatestTranscriptDocument(meetingId) {
  const or = [{ meetingId }];
  if (mongoose.Types.ObjectId.isValid(meetingId)) {
    or.push({ meetingId: new mongoose.Types.ObjectId(meetingId) });
  }
  return TranscriptDocument.findOne({ $or: or }).sort({ version: -1 }).lean();
}

/**
 * Runs the same Gemini flow as POST /generate-context-summary: persists ContextSummary and returns payload.
 * @throws {Error} with .code === "NO_SEGMENTS" | "NO_API_KEY"
 */
export async function buildMeetingContextSummary(meetingId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e = new Error("GEMINI_API_KEY is not configured");
    e.code = "NO_API_KEY";
    throw e;
  }

  const segments = await loadSegmentsForMeeting(meetingId);
  if (!segments.length) {
    const e = new Error("No transcript segments found for this meeting yet");
    e.code = "NO_SEGMENTS";
    throw e;
  }

  const transcriptBlock = buildTranscriptLines(segments);
  const td = await loadLatestTranscriptDocument(meetingId);

  const systemInstruction = `You are summarizing a live meeting from its ASR transcript.
Each transcript line is: [start time in seconds – end time in seconds] speaker label: spoken text.
Produce a clear, chronological "chain" of what happened. For EVERY chain point you MUST give:
- "text": the summary sentence(s)
- "startTs" and "endTs": numbers in SECONDS (decimals allowed), taken from the transcript line(s) that support that point (use the segment time range that best matches; do not invent times far outside the transcript).
Include a "Highlights" list; each highlight also has "text", "startTs", "endTs" when possible.
Respond with VALID JSON ONLY (no markdown fences), exactly this shape:
{
  "chain": [
    { "text": "First event summarized...", "startTs": 12.5, "endTs": 40.0 }
  ],
  "highlights": [
    { "text": "Key decision or moment", "startTs": 120.0, "endTs": 135.5 }
  ],
  "oneParagraphOverview": "2-4 sentence overview of the meeting so far."
}`;

  const userPrompt = `Transcript document version: ${td?.version ?? "unknown"}
Number of segments: ${segments.length}

--- TRANSCRIPT ---
${transcriptBlock}
--- END ---`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 4096,
    },
  });

  const result = await model.generateContent(userPrompt);
  const raw = result.response.text().trim();

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch (err) {
    console.warn("Gemini did not return pure JSON, wrapping raw text:", err.message);
    parsed = {
      chain: [{ text: raw, startTs: null, endTs: null }],
      highlights: [],
      oneParagraphOverview: "",
    };
  }

  const chainPoints = normalizeChainPoints(parsed.chain);
  const highlightPoints = normalizeHighlightPoints(parsed.highlights);
  const overview =
    typeof parsed.oneParagraphOverview === "string" ? parsed.oneParagraphOverview : "";

  const fmtSec = (a, b) => {
    if (a == null && b == null) return "";
    if (a != null && b != null) return `[${a}s–${b}s] `;
    if (a != null) return `[from ${a}s] `;
    return `[until ${b}s] `;
  };

  const sections = [
    {
      title: "Overview",
      content: overview || chainPoints.map((c) => c.text).join(" "),
      startTs: segments[0]?.startTs ?? null,
      endTs: segments[segments.length - 1]?.endTs ?? null,
    },
    {
      title: "What happened (chronological)",
      content: chainPoints
        .map((c, i) => `${i + 1}. ${fmtSec(c.startTs, c.endTs)}${c.text}`)
        .join("\n"),
      startTs: null,
      endTs: null,
    },
    {
      title: "Highlights",
      content: highlightPoints.length
        ? highlightPoints.map((h, i) => `• ${fmtSec(h.startTs, h.endTs)}${h.text}`).join("\n")
        : "(none)",
      startTs: null,
      endTs: null,
    },
  ];

  const meetingIdForDoc =
    mongoose.Types.ObjectId.isValid(meetingId) &&
    String(new mongoose.Types.ObjectId(meetingId)) === String(meetingId)
      ? new mongoose.Types.ObjectId(meetingId)
      : meetingId;

  const doc = await ContextSummary.create({
    meetingId: meetingIdForDoc,
    generatedAt: new Date(),
    sections,
    modelMeta: {
      model: DEFAULT_GEMINI_MODEL,
      segmentCount: segments.length,
      transcriptDocumentVersion: td?.version ?? null,
      // persist structured context so later callers (AI chat, context panel)
      // can reuse without regenerating via Gemini
      chain: chainPoints,
      highlights: highlightPoints,
      oneParagraphOverview: overview,
    },
  });

  console.log(`[ContextSummary] Created ${doc._id} for meetingId=${meetingId}`);

  return {
    contextSummaryId: doc._id,
    meetingId: String(meetingId),
    chain: chainPoints,
    highlights: highlightPoints,
    oneParagraphOverview: overview,
    sections: doc.sections,
    generatedAt: doc.generatedAt,
  };
}

export async function getLatestContextSummary(meetingId) {
  if (!meetingId) return null;
  const or = [{ meetingId }];
  if (mongoose.Types.ObjectId.isValid(meetingId)) {
    or.push({ meetingId: new mongoose.Types.ObjectId(meetingId) });
  }
  const doc = await ContextSummary.findOne({ $or: or }).sort({ createdAt: -1 }).lean();
  if (!doc) return null;
  const meta = doc.modelMeta || {};
  const chain = normalizeChainPoints(meta.chain || []);
  const highlights = normalizeHighlightPoints(meta.highlights || []);
  const overview =
    typeof meta.oneParagraphOverview === "string" && meta.oneParagraphOverview.trim()
      ? meta.oneParagraphOverview.trim()
      : "";

  return {
    contextSummaryId: doc._id,
    meetingId: String(doc.meetingId),
    chain,
    highlights,
    oneParagraphOverview: overview,
    sections: doc.sections || [],
    generatedAt: doc.generatedAt,
  };
}

/**
 * Plain-text block for injecting into an AI chat prompt.
 */
export function formatContextForChatPrompt(payload) {
  if (!payload) return "";
  const lines = [];
  if (payload.oneParagraphOverview) {
    lines.push("Overview:", payload.oneParagraphOverview, "");
  }
  if (Array.isArray(payload.chain) && payload.chain.length) {
    lines.push("Timeline:");
    payload.chain.forEach((c, i) => {
      const t =
        c.startTs != null && c.endTs != null
          ? ` [${c.startTs}s–${c.endTs}s]`
          : "";
      lines.push(`${i + 1}.${t} ${c.text || ""}`);
    });
    lines.push("");
  }
  if (Array.isArray(payload.highlights) && payload.highlights.length) {
    lines.push("Highlights:");
    payload.highlights.forEach((h) => {
      const t =
        h.startTs != null && h.endTs != null
          ? ` [${h.startTs}s–${h.endTs}s]`
          : "";
      lines.push(`•${t} ${h.text || ""}`);
    });
  }
  return lines.join("\n").trim();
}
