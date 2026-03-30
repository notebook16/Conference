import { Router } from "express";
import {
  generateContextSummary,
  getLatestContextSummaryHandler,
} from "../controllers/contextSummaryController.js";
import { postAiChat } from "../controllers/aiChatController.js";

const router = Router();

// POST -> regenerate via Gemini, GET -> reuse last saved summary
router.route("/generate-context-summary").post(generateContextSummary);
router.route("/generate-context-summary").get(getLatestContextSummaryHandler);

router.route("/ai-chat").post(postAiChat);

export default router;
