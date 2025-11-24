// routes/bulkUploadRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { bulkUploadFamilies } from "../controllers/bulkUploadController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bulkUploadDir = path.join(__dirname, "../../uploads/bulk");

if (!fs.existsSync(bulkUploadDir)) {
  fs.mkdirSync(bulkUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, bulkUploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedOriginal = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${sanitizedOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [".csv", ".xls", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Only CSV or Excel files are allowed"));
    }
    cb(null, true);
  },
});

// POST /api/bulk-upload/families
router.post(
  "/families",
  authenticate,
  authorizeRoles("ADMIN", "PRINCIPAL"),
  upload.single("file"),
  bulkUploadFamilies
);

export default router;
