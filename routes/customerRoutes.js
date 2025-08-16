import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import Customer from '../models/Customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// ========== SPECIFIC ROUTES FIRST (BEFORE PARAMETERIZED ROUTES) ==========

// Get customers expiring soon - MUST BE BEFORE /customers/:id
router.get('/customers/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 5;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    const futureDateString = futureDate.toISOString().split('T')[0];
    
    const expiringCustomers = await Customer.find({
      expiryDate: { $lte: futureDateString },
      status: { $ne: 'expired' }
    });
    
    res.json({
      success: true,
      count: expiringCustomers.length,
      customers: expiringCustomers
    });

  } catch (error) {
    console.error('Error fetching expiring customers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expiring customers',
      details: error.message 
    });
  }
});

// Get customers with pending payments - MUST BE BEFORE /customers/:id
router.get('/customers/pending-payments', async (req, res) => {
  try {
    const pendingCustomers = await Customer.find({
      remaining: { $gt: 0 }
    });
    
    res.json({
      success: true,
      count: pendingCustomers.length,
      customers: pendingCustomers
    });

  } catch (error) {
    console.error('Error fetching customers with pending payments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customers with pending payments',
      details: error.message 
    });
  }
});

// ========== GENERAL ROUTES ==========

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Create new customer
router.post('/customers', upload.single('image'), async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      image: req.file ? req.file.filename : '',
      remaining: parseFloat(req.body.fee) - parseFloat(req.body.paidAmount || 0)
    };

    const customer = new Customer(customerData);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ========== PARAMETERIZED ROUTES (AFTER SPECIFIC ROUTES) ==========

// Get customer renewal history - SPECIFIC route with :id
router.get('/customers/:id/renewal-history', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const customer = await Customer.findById(id).select('name rollNumber renewalHistory totalRenewals');
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      customer: {
        name: customer.name,
        rollNumber: customer.rollNumber,
        totalRenewals: customer.totalRenewals || 0
      },
      renewalHistory: customer.renewalHistory ? 
        customer.renewalHistory.sort((a, b) => new Date(b.renewalDate) - new Date(a.renewalDate)) : 
        []
    });

  } catch (error) {
    console.error('Error fetching renewal history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch renewal history',
      details: error.message 
    });
  }
});

// Update payment
router.put('/customers/:id/payment', async (req, res) => {
  try {
    const { amount } = req.body;
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const newPaidAmount = (customer.paidAmount || 0) + parseFloat(amount);
    const newRemaining = Math.max(0, customer.fee - newPaidAmount);

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        paidAmount: newPaidAmount,
        remaining: newRemaining
      },
      { new: true }
    );

    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Renew customer membership
router.put('/customers/:id/renew', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      membership,
      fee,
      paidAmount = 0,
      startDate,
      expiryDate,
      duration,
      durationType
    } = req.body;

    console.log('Renewal request received:', {
      id,
      membership,
      fee,
      paidAmount,
      startDate,
      expiryDate,
      duration,
      durationType
    });

    // Validate required fields
    if (!membership || !fee || !startDate || !expiryDate || !duration || !durationType) {
      return res.status(400).json({ 
        error: 'Missing required fields for renewal',
        required: ['membership', 'fee', 'startDate', 'expiryDate', 'duration', 'durationType']
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    // Find the customer
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    console.log('Customer found:', customer.name);

    // Convert expiryDate to the same format as stored (string)
    const expiryDateString = new Date(expiryDate).toISOString().split('T')[0];
    const remaining = parseFloat(fee) - parseFloat(paidAmount);

    // Create renewal history record
    const renewalRecord = {
      previousMembership: customer.membership,
      previousExpiryDate: customer.expiryDate,
      newMembership: membership,
      newExpiryDate: expiryDateString,
      renewalDate: new Date(),
      fee: parseFloat(fee),
      paidAmount: parseFloat(paidAmount),
      remaining: remaining,
      duration: parseInt(duration),
      durationType: durationType,
      startDate: startDate
    };

    // Prepare update data
    const updateData = {
      membership: membership,
      fee: parseFloat(fee),
      paidAmount: parseFloat(paidAmount),
      remaining: remaining,
      expiryDate: expiryDateString,
      status: 'active',
      totalRenewals: (customer.totalRenewals || 0) + 1,
      lastRenewalDate: new Date()
    };

    // Update customer and add renewal history
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        ...updateData,
        $push: { renewalHistory: renewalRecord }
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ error: 'Failed to update customer' });
    }

    console.log('Customer renewed successfully:', updatedCustomer.name);

    res.json({
      success: true,
      message: 'Membership renewed successfully',
      customer: updatedCustomer
    });

  } catch (error) {
    console.error('Error renewing membership:', error);
    res.status(500).json({ 
      error: 'Failed to renew membership',
      details: error.message 
    });
  }
});

// Get single customer - MUST BE LAST among GET routes with :id
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Update customer
router.put('/customers/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    if (req.file) {
      updateData.image = req.file.filename;
    }

    if (updateData.fee || updateData.paidAmount) {
      updateData.remaining = parseFloat(updateData.fee || 0) - parseFloat(updateData.paidAmount || 0);
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
