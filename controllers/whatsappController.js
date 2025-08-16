import whatsappService from '../services/whatsappService.js';
import Customer from '../models/Customer.js';

export const initializeWhatsApp = async (req, res) => {
  try {
    await whatsappService.initialize();
    res.json({ 
      success: true, 
      message: 'WhatsApp initialization started',
      status: whatsappService.getStatus()
    });
  } catch (error) {
    console.error('Initialize WhatsApp error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const getWhatsAppStatus = async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { phoneNumber, message, customerId } = req.body;

    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message cannot be empty' 
      });
    }

    // Check if WhatsApp is ready
    const status = whatsappService.getStatus();
    if (!status.isReady) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp is not ready. Please scan QR code and wait for connection.',
        status: status.status
      });
    }

    console.log(`📱 Attempting to send message to: ${phoneNumber}`);
    const result = await whatsappService.sendMessage(phoneNumber, message);
    
    // Log message to database if customer ID is provided
    if (customerId) {
      try {
        await Customer.findByIdAndUpdate(customerId, {
          $push: {
            messageHistory: {
              message,
              phoneNumber: result.phoneNumber,
              sentAt: new Date(),
              status: 'sent',
              type: 'custom'
            }
          }
        });
      } catch (dbError) {
        console.error('Error logging message to database:', dbError);
        // Don't fail the request if database logging fails
      }
    }

    res.json(result);
    
  } catch (error) {
    console.error('Send message error:', error);
    
    // Handle different types of errors
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('Phone validation failed') ||
        error.message.includes('Invalid phone number') ||
        error.message.includes('Phone number is required')) {
      statusCode = 400;
    } else if (error.message.includes('not registered on WhatsApp')) {
      statusCode = 404;
    } else if (error.message.includes('WhatsApp is not ready')) {
      statusCode = 503;
    }

    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: error.stack?.split('\n')[0] || 'No additional details'
    });
  }
};

export const sendWelcomeMessage = async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found' 
      });
    }

    // Validate customer phone number
    if (!customer.phone || customer.phone.trim() === '' || customer.phone === '0000') {
      return res.status(400).json({
        success: false,
        error: `Customer ${customer.name} does not have a valid phone number`
      });
    }

    const welcomeMessage = `🎉 Welcome to our Gym, ${customer.name}!

We're excited to have you as part of our fitness family!

📋 Your Details:
• Name: ${customer.name}
• Roll Number: ${customer.rollNumber}
• Phone: ${customer.phone}
• Package: ${customer.package}

💪 Let's achieve your fitness goals together!

For any queries, feel free to contact us.

Best regards,
Gym Management Team`;

    const result = await whatsappService.sendMessage(customer.phone, welcomeMessage);
    
    // Update customer record
    await Customer.findByIdAndUpdate(customerId, {
      $push: {
        messageHistory: {
          message: welcomeMessage,
          type: 'welcome',
          phoneNumber: result.phoneNumber,
          sentAt: new Date(),
          status: 'sent'
        }
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Send welcome message error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const sendFeeReminder = async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found' 
      });
    }

    if (customer.remaining <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No pending payment for this customer' 
      });
    }

    // Validate customer phone number
    if (!customer.phone || customer.phone.trim() === '' || customer.phone === '0000') {
      return res.status(400).json({
        success: false,
        error: `Customer ${customer.name} does not have a valid phone number`
      });
    }

    const reminderMessage = `💰 Fee Payment Reminder

Dear ${customer.name},

This is a friendly reminder that you have a pending payment:

📋 Payment Details:
• Roll Number: ${customer.rollNumber}
• Total Fee: ₹${customer.totalFee}
• Paid Amount: ₹${customer.paidFee}
• Remaining: ₹${customer.remaining}

Please complete your payment at your earliest convenience.

Thank you!
Gym Management Team`;

    const result = await whatsappService.sendMessage(customer.phone, reminderMessage);
    
    // Update customer record
    await Customer.findByIdAndUpdate(customerId, {
      $push: {
        messageHistory: {
          message: reminderMessage,
          type: 'fee_reminder',
          phoneNumber: result.phoneNumber,
          sentAt: new Date(),
          status: 'sent'
        }
      },
      lastReminderSent: new Date()
    });

    res.json(result);
  } catch (error) {
    console.error('Send fee reminder error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const triggerFeeReminders = async (req, res) => {
  try {
    const pendingCustomers = await Customer.find({ 
      remaining: { $gt: 0 },
      phone: { $exists: true, $ne: '', $ne: '0000' } // Only customers with valid phone numbers
    });
    
    if (pendingCustomers.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No customers with pending payments and valid phone numbers found',
        count: 0
      });
    }

    let successCount = 0;
    let errors = [];

    for (const customer of pendingCustomers) {
      try {
        // Additional validation using the service
        const phoneValidation = whatsappService.validatePhoneNumber(customer.phone);
        if (!phoneValidation.isValid) {
          errors.push({ 
            customer: customer.name, 
            error: `Invalid phone number: ${phoneValidation.error}`,
            phone: customer.phone 
          });
          continue;
        }

        const reminderMessage = `💰 Fee Payment Reminder

Dear ${customer.name},

This is a friendly reminder that you have a pending payment:

📋 Payment Details:
• Roll Number: ${customer.rollNumber}
• Total Fee: ₹${customer.totalFee}
• Paid Amount: ₹${customer.paidFee}
• Remaining: ₹${customer.remaining}

Please complete your payment at your earliest convenience.

Thank you!
Gym Management Team`;

        await whatsappService.sendMessage(customer.phone, reminderMessage);
        
        // Update customer record
        await Customer.findByIdAndUpdate(customer._id, {
          $push: {
            messageHistory: {
              message: reminderMessage,
              type: 'fee_reminder',
              phoneNumber: phoneValidation.formattedNumber,
              sentAt: new Date(),
              status: 'sent'
            }
          },
          lastReminderSent: new Date()
        });

        successCount++;
        console.log(`✅ Fee reminder sent to ${customer.name}`);
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error sending reminder to ${customer.name}:`, error);
        errors.push({ 
          customer: customer.name, 
          error: error.message,
          phone: customer.phone 
        });
      }
    }

    res.json({ 
      success: true, 
      message: `Fee reminders processed for ${pendingCustomers.length} customers`,
      totalCustomers: pendingCustomers.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // Limit errors in response
    });
  } catch (error) {
    console.error('Trigger fee reminders error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const triggerExpiryReminders = async (req, res) => {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiringCustomers = await Customer.find({
      endDate: {
        $lte: threeDaysFromNow,
        $gte: new Date()
      },
      phone: { $exists: true, $ne: '', $ne: '0000' } // Only valid phone numbers
    });

    if (expiringCustomers.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No customers with expiring memberships and valid phone numbers found',
        count: 0
      });
    }

    let successCount = 0;
    let errors = [];

    for (const customer of expiringCustomers) {
      try {
        // Validate phone number
        const phoneValidation = whatsappService.validatePhoneNumber(customer.phone);
        if (!phoneValidation.isValid) {
          errors.push({ 
            customer: customer.name, 
            error: `Invalid phone number: ${phoneValidation.error}`,
            phone: customer.phone 
          });
          continue;
        }

        const daysUntilExpiry = Math.ceil((customer.endDate - new Date()) / (1000 * 60 * 60 * 24));
        
        const expiryMessage = `⚠️ Membership Expiry Reminder

Dear ${customer.name},

Your gym membership is expiring soon:

📋 Membership Details:
• Roll Number: ${customer.rollNumber}
• Current Package: ${customer.package}
• Expiry Date: ${customer.endDate.toDateString()}
• Days Remaining: ${daysUntilExpiry} days

Please renew your membership to continue enjoying our services.

Contact us for renewal options!

Best regards,
Gym Management Team`;

        await whatsappService.sendMessage(customer.phone, expiryMessage);
        
        // Update customer record
        await Customer.findByIdAndUpdate(customer._id, {
          $push: {
            messageHistory: {
              message: expiryMessage,
              type: 'expiry_reminder',
              phoneNumber: phoneValidation.formattedNumber,
              sentAt: new Date(),
              status: 'sent'
            }
          },
          lastExpiryReminderSent: new Date()
        });

        successCount++;
        console.log(`✅ Expiry reminder sent to ${customer.name}`);
        
        // Add delay between messages
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`❌ Error sending expiry reminder to ${customer.name}:`, error);
        errors.push({ 
          customer: customer.name, 
          error: error.message,
          phone: customer.phone 
        });
      }
    }

    res.json({ 
      success: true, 
      message: `Expiry reminders processed for ${expiringCustomers.length} customers`,
      totalCustomers: expiringCustomers.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('Trigger expiry reminders error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const disconnectWhatsApp = async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({ 
      success: true, 
      message: 'WhatsApp disconnected successfully' 
    });
  } catch (error) {
    console.error('Disconnect WhatsApp error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const restartWhatsApp = async (req, res) => {
  try {
    await whatsappService.restart();
    res.json({ 
      success: true, 
      message: 'WhatsApp client restarted successfully',
      status: whatsappService.getStatus()
    });
  } catch (error) {
    console.error('Restart WhatsApp error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
