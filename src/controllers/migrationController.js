import { migrateSchoolData } from "../services/migrationService.js";

export const uploadAndMigrate = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }
  
      const filePath = req.file.path;
      const originalName = req.file.originalname;   // 👈
      const table = req.query.table || null;
  
      const result = await migrateSchoolData(filePath, table, originalName);
  
      res.status(200).json({
        status: "success",
        message: "Migration completed",
        summary: result,
      });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ message: error.message });
    }
  };
