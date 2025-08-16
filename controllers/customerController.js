import Customer from '../models/Customer.js';

// Get all customers
export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ rollNumber: 1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get customers count
export const getCustomersCount = async (req, res) => {
  try {
    const count = await Customer.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create customer
export const createCustomer = async (req, res) => {
  try {
    const {
      name, phone, email, address, joinDate, expiryDate,
      membership, fee, paidAmount, remaining, emergencyContact
    } = req.body;

    // Generate roll number
    const count = await Customer.countDocuments();
    const rollNumber = `GYM-${String(count + 1).padStart(4, '0')}`;

    const customerData = {
      rollNumber,
      name,
      phone,
      email,
      address,
      joinDate,
      expiryDate,
      membership,
      fee: parseFloat(fee),
      paidAmount: parseFloat(paidAmount) || 0,
      remaining: parseFloat(remaining),
      emergencyContact: emergencyContact ? JSON.parse(emergencyContact) : {},
      image: req.file ? req.file.filename : ''
    };

    const customer = new Customer(customerData);
    await customer.save();

    res.status(201).json({
      message: 'Customer added successfully!',
      customer
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    if (updateData.emergencyContact) {
      updateData.emergencyContact = JSON.parse(updateData.emergencyContact);
    }

    const customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      message: 'Customer updated successfully!',
      customer
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndDelete(id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending payments
export const getPendingPayments = async (req, res) => {
  try {
    const customers = await Customer.find({ remaining: { $gt: 0 } })
      .sort({ remaining: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const newPaidAmount = customer.paidAmount + parseFloat(amount);
    const newRemaining = customer.fee - newPaidAmount;

    await Customer.findByIdAndUpdate(id, {
      paidAmount: newPaidAmount,
      remaining: Math.max(0, newRemaining)
    });

    res.json({ message: 'Payment updated successfully!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
