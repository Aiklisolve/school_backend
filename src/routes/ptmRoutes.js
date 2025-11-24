// src/routes/ptmRoutes.js
import { Router } from "express";
import {
  createPtmSessionController,
  getSessionsByParentController,
  getSessionsByStudentController,
  getSessionsByTeacherController,
  listPtmSessionsController,
} from "../controllers/ptmSessionController.js";
import {
  createPtmBookingController,
  getBookingsByParentController,
  getBookingsByStudentController,
  getBookingsByTeacherController,
  listPtmBookingsController,
} from "../controllers/ptmBookingController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

// PTM Sessions
// POST /api/ptm/sessions - Create PTM session
router.post("/sessions", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), createPtmSessionController);
router.get("/sessions", listPtmSessionsController);     // list PTM sessions (filters+pagination)

// PTM Bookings
// POST /api/ptm/bookings - Create booking
router.post("/bookings", authenticate, authorizeRoles('PARENT', 'TEACHER'), createPtmBookingController);
router.get("/bookings", listPtmBookingsController);     // list bookings (filters+pagination)



// BOOKINGS
router.get("/bookings/teacher/:teacherId", getBookingsByTeacherController);
router.get("/bookings/parent/:parentId", getBookingsByParentController);
router.get("/bookings/student/:studentId", getBookingsByStudentController);

// SESSIONS
router.get("/sessions/teacher/:teacherId", getSessionsByTeacherController);
router.get("/sessions/parent/:parentId", getSessionsByParentController);
router.get("/sessions/student/:studentId", getSessionsByStudentController);


export default router;
