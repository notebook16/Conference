


import { Router } from "express";

import { login, register, addToHistory, getUserHistory, validateSession } from "../controllers/user.js";

const router = Router();

router.route("/login").post(login)
router.route("/register").post(register)
router.route("/add_to_activity").post(addToHistory)
router.route("/get_all_activity").get(getUserHistory)
router.route("/validate_session").get(validateSession)


export default router;
