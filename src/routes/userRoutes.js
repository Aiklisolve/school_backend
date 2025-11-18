// src/routes/userRoutes.js
import { Router } from 'express';
import { registerUser } from '../controllers/userController.js';

const router = Router();

// POST /api/users/register
router.post('/register', registerUser);

export default router;
