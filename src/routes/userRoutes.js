// src/routes/userRoutes.js
import { Router } from 'express';
import { activateUser, changePassword, deactivateUser, getAllUsers, getUserById, registerUser, updateUser, verifyEmail, verifyPhone } from '../controllers/userController.js';

const router = Router();

// POST /api/users/register
router.post('/register', registerUser);

// GET /api/users
router.get('/getusers', getAllUsers);

// GET /api/users/:id
router.get('/:id', getUserById);

// PUT /api/users/:id
router.put('/:id', updateUser);

// PATCH /api/users/:id/deactivate
router.patch('/:id/deactivate', deactivateUser);

// PATCH /api/users/:id/activate
router.patch('/:id/activate', activateUser);

// PATCH /api/users/:id/verify-email
router.patch('/:id/verify-email', verifyEmail);

// PATCH /api/users/:id/verify-phone
router.patch('/:id/verify-phone', verifyPhone);

// PATCH /api/users/:id/change-password
router.patch('/:id/change-password', changePassword);
export default router;
