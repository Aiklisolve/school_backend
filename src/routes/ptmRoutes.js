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

const router = Router();

// PTM Sessions
router.post("/sessions", createPtmSessionController);   // create PTM session
router.get("/sessions", listPtmSessionsController);     // list PTM sessions (filters+pagination)

// PTM Bookings
router.post("/bookings", createPtmBookingController);   // create booking
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
