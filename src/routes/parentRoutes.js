// src/routes/parentRoutes.js
import { Router } from "express";
import { registerParent } from "../controllers/parentController.js";

const router = Router();

router.post("/register", registerParent);

export default router;
