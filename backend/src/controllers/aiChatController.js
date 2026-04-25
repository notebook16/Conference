import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getLatestContextSummary,
  formatContextForChatPrompt,
  DEFAULT_GEMINI_MODEL,
} from "../services/meetingContextService.js";

/**
 * POST /api/v1/transcript/ai-chat
 * Body: { meetingId: string, message: string, useContext: boolean }
 * - useContext true: reuses the latest saved ContextSummary for the meeting (no regeneration),
 *   then answers with Gemini using that context + user message. If no summary exists yet,
 *   the caller should trigger a refresh via the context summary UI first.
 * - useContext false: general Gemini chat (no meeting transcript context).
 */
export async function postAiChat(req, res) {
  try {
    const meetingId = req.body?.meetingId;
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const useContext = Boolean(req.body?.useContext);

    if (!meetingId) {
      return res.status(400).json({ success: false, message: "meetingId is required" });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: "GEMINI_API_KEY is not configured on the server",
      });
    }

    let contextPayload = null;
    let contextBlock = "";

    if (useContext) {
      contextPayload = await getLatestContextSummary(meetingId);
      if (!contextPayload) {
        return res.status(404).json({
          success: false,
          message:
            "No meeting context summary found yet. Open the Meeting context panel and press Refresh to generate one.",
        });
      }
      contextBlock = formatContextForChatPrompt(contextPayload);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    let systemInstruction;
    let userPrompt;

    if (useContext && contextBlock) {
      systemInstruction = `You are a helpful assistant in a live video meeting. The user will ask questions about the meeting.
Use ONLY the "Meeting context" section below (summary of what was said) to answer when the question is about the meeting. If the context does not contain enough information, say so briefly and suggest what might still happen in the meeting.
Keep answers concise and clear. Do not invent facts that are not supported by the context.`;
      userPrompt = `--- Meeting context ---\n${contextBlock}\n--- End context ---\n\nUser question: ${message}`;
    } else {
      systemInstruction =
        "You are a friendly, concise assistant. Answer the user's message helpfully. You are not given meeting transcript context for this turn.";
      userPrompt = message;
    }

    const model = genAI.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      systemInstruction,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(userPrompt);
    const answer = (result.response.text() || "").trim();

    return res.status(200).json({
      success: true,
      answer,
      useContext,
      contextRefreshed: false,
      contextSummaryId: contextPayload?.contextSummaryId ?? null,
    });
  } catch (err) {
    console.error("postAiChat error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "AI chat failed",
    });
  }
}
