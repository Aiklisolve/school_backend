import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import logger from './middleware/logger.js';
import parentRoutes from "./routes/parentRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
const app = express();

app.use(cors());
app.use(express.json());

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
app.use("/api/sessions", sessionRoutes);


export default app;
