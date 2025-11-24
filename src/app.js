import express from 'express';
import cors from 'cors';
import logger from './middleware/logger.js';

// Import routes one by one
import authRoutes from './routes/authRoutes.js';
console.log('✓ authRoutes loaded:', typeof authRoutes);

import userRoutes from './routes/userRoutes.js';
console.log('✓ userRoutes loaded:', typeof userRoutes);

import parentRoutes from "./routes/parentRoutes.js";
console.log('✓ parentRoutes loaded:', typeof parentRoutes);

import schoolRoutes from "./routes/schoolRoutes.js";
console.log('✓ schoolRoutes loaded:', typeof schoolRoutes);

import studentRoutes from "./routes/studentRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import ptmRoutes from "./routes/ptmRoutes.js";
import masterDataRoutes from "./routes/masterDataRoutes.js";
import parentStudentRelationshipRoutes from "./routes/parentStudentRelationshipRoutes.js";
import bulkUploadRoutes from "./routes/bulkUploadRoutes.js";
import reportCardRoutes from "./routes/reportCardRoutes.js";
import unifiedSchoolSetupRoutes from "./routes/unifiedSchoolSetupRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logger);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'School Auth API Running' });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/ptm", ptmRoutes);
app.use("/api/master", masterDataRoutes);
app.use("/api/relationships", parentStudentRelationshipRoutes);
app.use("/api/bulk-upload", bulkUploadRoutes);

app.use('/api/report-cards', reportCardRoutes);
app.use('/api/unified-setup', unifiedSchoolSetupRoutes);


export default app;
