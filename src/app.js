import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import logger from './middleware/logger.js';
import parentRoutes from "./routes/parentRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import reportCardRoutes from "./routes/reportCardRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // IMPORTANT for file uploads

// logging middleware
app.use(logger);

// base health route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'School Auth API Running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/students", studentRoutes);
app.use('/api/report-cards', reportCardRoutes);

export default app;
