// src/routes/ptmRoutes.js
import { Router } from "express";
import {
  createPtmSessionController,
  listPtmSessionsController,
} from "../controllers/ptmSessionController.js";
import {
  createPtmBookingController,
  listPtmBookingsController,
} from "../controllers/ptmBookingController.js";

const router = Router();

// PTM Sessions
router.post("/sessions", createPtmSessionController);   // create PTM session
router.get("/sessions", listPtmSessionsController);     // list PTM sessions (filters+pagination)

// PTM Bookings
router.post("/bookings", createPtmBookingController);   // create booking
router.get("/bookings", listPtmBookingsController);     // list bookings (filters+pagination)

export default router;
