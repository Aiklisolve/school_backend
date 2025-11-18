import { Router } from "express";
import { registerSchool } from "../controllers/schoolController.js";

const router = Router();

router.post("/register", registerSchool);

export default router;
