// src/routes/parentRoutes.js
import { Router } from "express";
import { getParentsBySchoolId, registerParent } from "../controllers/parentController.js";

const router = Router();

router.post("/register", registerParent);
router.get('/school/:school_id', getParentsBySchoolId);

export default router;
