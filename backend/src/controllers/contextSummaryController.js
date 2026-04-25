import {
  buildMeetingContextSummary,
  getLatestContextSummary,
} from "../services/meetingContextService.js";

/**
 * POST /api/v1/transcript/generate-context-summary
 * Body: { meetingId: string }
 *
 * Forces regeneration of the context summary via Gemini and persists it.
 */
export async function generateContextSummary(req, res) {
  try {
    const meetingId = req.body?.meetingId || req.query?.meetingId;
    if (!meetingId) {
      return res.status(400).json({ success: false, message: "meetingId is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "GEMINI_API_KEY is not configured on the server",
      });
    }

    try {
      const data = await buildMeetingContextSummary(meetingId);
      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (err) {
      if (err.code === "NO_SEGMENTS") {
        return res.status(404).json({
          success: false,
          message: err.message || "No transcript segments found for this meeting yet",
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("generateContextSummary error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate context summary",
    });
  }
}

/**
 * GET /api/v1/transcript/generate-context-summary
 * Query: ?meetingId=...
 *
 * Returns the latest saved ContextSummary for this meeting without regenerating.
 */
export async function getLatestContextSummaryHandler(req, res) {
  try {
    const meetingId = req.query?.meetingId || req.body?.meetingId;
    if (!meetingId) {
      return res.status(400).json({ success: false, message: "meetingId is required" });
    }

    const payload = await getLatestContextSummary(meetingId);
    if (!payload) {
      return res.status(404).json({
        success: false,
        message: "No context summary has been generated yet. Press Refresh to create one.",
      });
    }

    return res.status(200).json({
      success: true,
      ...payload,
    });
  } catch (err) {
    console.error("getLatestContextSummaryHandler error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load context summary",
    });
  }
}
