import express from "express";
import multer from "multer";
import path from "path";
import { uploadAndMigrate } from "../controllers/migrationController.js";

const router = express.Router();

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname); // .csv / .xlsx
      const basename = Date.now() + "-" + file.fieldname;
      cb(null, basename + ext);                    // e.g., 1711372312345-file.csv
    },
  });
  
  const upload = multer({ storage });
  
  router.post("/migrate", upload.single("file"), uploadAndMigrate);

export default router;
