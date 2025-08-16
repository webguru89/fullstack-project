import express from 'express';
import {
  markAttendance,
  getAttendance,
  getAttendanceByDateRange,
  updateCheckout
} from '../controllers/attendanceController.js';

const router = express.Router();

router.post('/attendance', markAttendance);
router.get('/attendance', getAttendance);
router.get('/attendance/range', getAttendanceByDateRange);
router.put('/attendance/:id/checkout', updateCheckout);

export default router;
