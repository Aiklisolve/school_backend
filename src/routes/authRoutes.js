import express from 'express';
import { loginController } from '../controllers/authController.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginController);

export default router;
