// src/routes/userRoutes.js
import { Router } from 'express';
import { activateUser, changePassword, changePasswordWithOtp, deactivateUser, getAllUsers, getUserById, getUserBySchoolId, registerUser, sendPasswordResetOtp, updateUser, verifyEmail, verifyPhone } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();

// POST /api/users/register - Create user
router.post('/register', authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), registerUser);

// GET /api/users
router.get('/', getAllUsers);

// GET /api/users/school/:school_id
router.get('/school/:school_id/:role', getUserBySchoolId);

// GET /api/users/:id
router.get('/:id', getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, updateUser);

// PATCH /api/users/:id/deactivate - Deactivate user
router.patch('/:id/deactivate', authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), deactivateUser);

// PATCH /api/users/:id/activate - Activate user
router.patch('/:id/activate', authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), activateUser);

// PATCH /api/users/:id/verify-email - Verify email
router.patch('/:id/verify-email', authenticate, verifyEmail);

// PATCH /api/users/:id/verify-phone - Verify phone
router.patch('/:id/verify-phone', authenticate, verifyPhone);

// PATCH /api/users/:id/change-password - Change password
router.patch('/:id/change-password', authenticate, changePassword);

router.post("/password/send-otp", sendPasswordResetOtp);
router.post("/password/change-with-otp", changePasswordWithOtp);


export default router;
