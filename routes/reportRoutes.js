import express from 'express';
import Customer from '../models/Customer.js';
import Attendance from '../models/Attendance.js';

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
  try {
    const customers = await Customer.find();
    const attendance = await Attendance.find();
    
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calculate statistics
    const totalCustomers = customers.length;
    const activeMembers = customers.filter(c => 
      new Date(c.expiryDate) > new Date()
    ).length;
    const expiredMembers = totalCustomers - activeMembers;
    
    const todayAttendance = attendance.filter(a => a.date === today).length;
    const totalIncome = customers.reduce((sum, c) => sum + (c.fee || 0), 0);
    const pendingAmount = customers.reduce((sum, c) => sum + (c.remaining || 0), 0);
    
    const monthlyIncome = customers
      .filter(c => {
        const joinDate = new Date(c.joinDate);
        return joinDate.getMonth() === currentMonth && 
               joinDate.getFullYear() === currentYear;
      })
      .reduce((sum, c) => sum + (c.fee || 0), 0);

    const membershipStats = {
      regular: customers.filter(c => c.membership === 'regular').length,
      training: customers.filter(c => c.membership === 'training').length,
      premium: customers.filter(c => c.membership === 'premium').length,
    };

    res.json({
      totalCustomers,
      activeMembers,
      expiredMembers,
      todayAttendance,
      totalIncome,
      pendingAmount,
      monthlyIncome,
      membershipStats,
      totalAttendance: attendance.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly income report
router.get('/monthly-income', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const customers = await Customer.find({
      joinDate: {
        $gte: `${year}-01-01`,
        $lt: `${parseInt(year) + 1}-01-01`
      }
    });

    const monthlyData = Array(12).fill(0).map((_, index) => {
      const month = index + 1;
      const monthlyIncome = customers
        .filter(c => {
          const joinDate = new Date(c.joinDate);
          return joinDate.getMonth() === index;
        })
        .reduce((sum, c) => sum + (c.fee || 0), 0);
      
      return {
        month: new Date(year, index).toLocaleString('default', { month: 'long' }),
        income: monthlyIncome
      };
    });

    res.json(monthlyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance report
router.get('/attendance-report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('customerId', 'name rollNumber')
      .sort({ date: -1 });

    // Group by date
    const attendanceByDate = attendance.reduce((acc, record) => {
      const date = record.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(record);
      return acc;
    }, {});

    res.json({
      attendanceByDate,
      totalRecords: attendance.length,
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending payments report
router.get('/pending-payments', async (req, res) => {
  try {
    const pendingPayments = await Customer.find({
      remaining: { $gt: 0 }
    }).sort({ remaining: -1 });

    const totalPending = pendingPayments.reduce((sum, c) => sum + c.remaining, 0);
    
    res.json({
      customers: pendingPayments,
      totalPending,
      count: pendingPayments.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get membership expiry report
router.get('/expiry-report', async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    const expiringThisWeek = await Customer.find({
      expiryDate: {
        $gte: today.toISOString().split('T')[0],
        $lte: nextWeek.toISOString().split('T')[0]
      }
    });

    const expiringThisMonth = await Customer.find({
      expiryDate: {
        $gte: today.toISOString().split('T')[0],
        $lte: nextMonth.toISOString().split('T')[0]
      }
    });

    const expired = await Customer.find({
      expiryDate: { $lt: today.toISOString().split('T')[0] }
    });

    res.json({
      expiringThisWeek,
      expiringThisMonth,
      expired,
      counts: {
        thisWeek: expiringThisWeek.length,
        thisMonth: expiringThisMonth.length,
        expired: expired.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
