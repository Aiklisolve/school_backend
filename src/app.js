import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import logger from './middleware/logger.js';

const app = express();

app.use(cors());
app.use(express.json());

// logging middleware
app.use(logger);

// base health route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'School Auth API Running' });
});

app.use('/api/auth', authRoutes);

export default app;
