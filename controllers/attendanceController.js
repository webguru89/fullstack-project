import Attendance from '../models/Attendance.js';
import Customer from '../models/Customer.js';

// Mark attendance
export const markAttendance = async (req, res) => {
  try {
    const { customerId } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Check if attendance already marked today
    const existingAttendance = await Attendance.findOne({
      customerId,
      date: today
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'Attendance already marked for today' });
    }

    // Get customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const attendance = new Attendance({
      customerId,
      customerName: customer.name,
      rollNumber: customer.rollNumber,
      date: today
    });

    await attendance.save();
    res.status(201).json({ message: 'Attendance marked successfully!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all attendance
export const getAttendance = async (req, res) => {
  try {
    const { date, customerId } = req.query;
    let query = {};

    if (date) query.date = date;
    if (customerId) query.customerId = customerId;

    const attendance = await Attendance.find(query)
      .populate('customerId', 'name rollNumber')
      .sort({ date: -1, checkInTime: -1 });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get attendance by date range
export const getAttendanceByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const attendance = await Attendance.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate('customerId', 'name rollNumber')
      .sort({ date: -1 });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update checkout time
export const updateCheckout = async (req, res) => {
  try {
    const { id } = req.params;
    const checkOutTime = new Date().toLocaleTimeString();

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Calculate duration
    const checkIn = new Date(`1970-01-01 ${attendance.checkInTime}`);
    const checkOut = new Date(`1970-01-01 ${checkOutTime}`);
    const diffMs = checkOut - checkIn;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = `${diffHours}h ${diffMins}m`;

    await Attendance.findByIdAndUpdate(id, {
      checkOutTime,
      duration
    });

    res.json({ message: 'Checkout time updated successfully!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
