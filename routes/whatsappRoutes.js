import express from 'express';
import axios from 'axios';
// Fixed import for whatsapp-web.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import Customer from '../models/Customer.js';

const router = express.Router();

// WhatsApp Web client
let whatsappClient = null;
let qrCodeData = null;

// WhatsApp configuration state
let whatsappConfig = {
  method: 'none',
  isReady: false,
  status: 'disconnected',
  provider: 'none',
  qrCode: null
};

// Store verification codes temporarily
const verificationCodes = new Map();

// Store phone number for verification
let verifyingPhoneNumber = null;

// Initialize WhatsApp Web Client
const initializeWhatsAppClient = () => {
  try {
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: "gym-management-client",
        dataPath: "./whatsapp-auth"
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        executablePath: undefined // Let puppeteer find Chrome automatically
      }
    });

    whatsappClient.on('loading_screen', (percent, message) => {
      console.log(`⏳ Loading... ${percent}% - ${message}`);
    });

    whatsappClient.on('qr', async (qr) => {
      console.log('🔗 QR Code received, generating image...');
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        whatsappConfig.qrCode = qrCodeData;
        whatsappConfig.status = 'qr_ready';
        console.log('✅ QR Code generated successfully');
        console.log('📱 Please scan the QR code with your WhatsApp mobile app');
      } catch (error) {
        console.error('❌ Error generating QR code:', error);
      }
    });

    whatsappClient.on('ready', async () => {
      console.log('✅ WhatsApp Web Client is ready!');
      
      // Get client info
      const clientInfo = whatsappClient.info;
      console.log(`📱 Connected as: ${clientInfo.pushname} (${clientInfo.wid.user})`);
      
      whatsappConfig = {
        method: 'whatsapp_web',
        isReady: true,
        status: 'connected',
        provider: 'whatsapp_web',
        qrCode: null,
        clientInfo: {
          name: clientInfo.pushname,
          number: clientInfo.wid.user
        }
      };
    });

    whatsappClient.on('authenticated', () => {
      console.log('✅ WhatsApp Web Client authenticated');
      whatsappConfig.status = 'authenticated';
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      whatsappConfig.status = 'auth_failure';
      whatsappConfig.qrCode = null;
    });

    whatsappClient.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp Web Client disconnected:', reason);
      whatsappConfig = {
        method: 'none',
        isReady: false,
        status: 'disconnected',
        provider: 'none',
        qrCode: null
      };
    });

    whatsappClient.on('message_create', async (message) => {
      // Handle incoming messages for verification
      if (message.fromMe) return; // Ignore messages sent by us
      
      if (message.body && /^\d{6}$/.test(message.body.trim())) {
        const code = message.body.trim();
        const phoneNumber = message.from.replace('@c.us', '').replace(/^92/, '');
        
        console.log(`📨 Received potential verification code: ${code} from ${phoneNumber}`);
        
        // Check if this phone number is waiting for verification
        if (verifyingPhoneNumber === phoneNumber) {
          // Store the code they sent back to us
          verificationCodes.set(phoneNumber, {
            code: code,
            expires: Date.now() + 5 * 60 * 1000,
            verified: true
          });
          
          // Send confirmation
          try {
            await whatsappClient.sendMessage(message.from, 
              '✅ Verification code received! You can now use the WhatsApp messaging system.'
            );
          } catch (error) {
            console.error('Error sending confirmation:', error);
          }
        }
      }
    });

    whatsappClient.on('change_state', (state) => {
      console.log('🔄 WhatsApp state changed:', state);
    });

    return whatsappClient;
  } catch (error) {
    console.error('❌ Error initializing WhatsApp client:', error);
    throw error;
  }
};

// Get WhatsApp status
router.get('/status', (req, res) => {
  res.json({
    status: whatsappConfig.status,
    isReady: whatsappConfig.isReady,
    method: whatsappConfig.method,
    provider: whatsappConfig.provider,
    qrCode: whatsappConfig.qrCode,
    clientInfo: whatsappConfig.clientInfo || null
  });
});

// Initialize WhatsApp Web
router.post('/init-whatsapp-web', async (req, res) => {
  try {
    if (whatsappClient && whatsappConfig.isReady) {
      return res.json({
        success: true,
        message: 'WhatsApp Web is already connected',
        status: whatsappConfig.status
      });
    }

    console.log('🚀 Initializing WhatsApp Web client...');
    
    whatsappConfig.status = 'initializing';
    
    if (whatsappClient) {
      try {
        await whatsappClient.destroy();
      } catch (e) {
        console.log('Previous client cleanup done');
      }
    }
    
    whatsappClient = initializeWhatsAppClient();
    
    // Initialize the client
    whatsappClient.initialize().catch((error) => {
      console.error('❌ WhatsApp initialization failed:', error);
      whatsappConfig.status = 'initialization_failed';
    });
    
    res.json({
      success: true,
      message: 'WhatsApp Web initialization started. Please wait for QR code...',
      status: 'initializing'
    });
    
  } catch (error) {
    console.error('❌ WhatsApp Web initialization error:', error);
    res.status(500).json({
      error: 'Failed to initialize WhatsApp Web',
      details: error.message
    });
  }
});

// Request verification code via WhatsApp
router.post('/request-whatsapp-verification', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    if (!whatsappConfig.isReady) {
      return res.status(400).json({
        error: 'WhatsApp Web is not connected. Please connect first.',
        status: whatsappConfig.status,
        instruction: 'Click "Connect WhatsApp Web" and scan the QR code first'
      });
    }
    
    // Format phone number for WhatsApp
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('92')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '92' + formattedPhone.substring(1);
      } else {
        formattedPhone = '92' + formattedPhone;
      }
    }
    
    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code and phone number for verification
    verificationCodes.set(phoneNumber, {
      code: verificationCode,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      verified: false
    });
    
    verifyingPhoneNumber = phoneNumber;
    
    // Send WhatsApp message with verification code
    const chatId = `${formattedPhone}@c.us`;
    const message = `🏋️‍♂️ *Gym Management System*

Your verification code is: *${verificationCode}*

Please enter this code in the application to verify your WhatsApp number.

⏰ This code expires in 5 minutes.

Reply with this same code to confirm you received it.

---
_This is an automated message from your gym management system._`;

    try {
      // Check if number exists on WhatsApp
      const numberId = await whatsappClient.getNumberId(chatId);
      if (!numberId) {
        return res.status(400).json({
          error: 'This phone number is not registered on WhatsApp',
          phoneNumber: `+${formattedPhone}`,
          suggestion: 'Please make sure the number is active on WhatsApp'
        });
      }

      await whatsappClient.sendMessage(chatId, message);
      
      console.log(`✅ Verification code sent via WhatsApp to ${formattedPhone}: ${verificationCode}`);
      
      res.json({
        success: true,
        message: `Verification code sent to WhatsApp number +${formattedPhone}`,
        phoneNumber: `+${formattedPhone}`,
        sentVia: 'WhatsApp Web',
        expiresIn: '5 minutes',
        // For development only - remove in production
        ...(process.env.NODE_ENV === 'development' && { 
          devCode: verificationCode,
          devMessage: `Development mode: Your code is ${verificationCode}`
        })
      });
      
    } catch (whatsappError) {
      console.error('❌ WhatsApp sending failed:', whatsappError);
      
      // Handle specific WhatsApp errors
      if (whatsappError.message.includes('phone number is not registered')) {
        return res.status(400).json({
          error: 'This phone number is not registered on WhatsApp',
          phoneNumber: `+${formattedPhone}`,
          suggestion: 'Please make sure the number is active on WhatsApp'
        });
      } else if (whatsappError.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending another message.',
          retryAfter: '1 minute'
        });
      }
      
      throw whatsappError;
    }
    
  } catch (error) {
    console.error('❌ Verification request error:', error);
    res.status(500).json({
      error: 'Failed to send verification code',
      details: error.message
    });
  }
});

// Verify WhatsApp code and connect
router.post('/verify-whatsapp-code', (req, res) => {
  try {
    const { phoneNumber, verificationCode } = req.body;
    
    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({
        error: 'Phone number and verification code are required'
      });
    }
    
    const storedData = verificationCodes.get(phoneNumber);
    
    if (!storedData) {
      return res.status(400).json({
        error: 'No verification code found. Please request a new code.'
      });
    }
    
    if (Date.now() > storedData.expires) {
      verificationCodes.delete(phoneNumber);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.'
      });
    }
    
    if (storedData.code === verificationCode.toString()) {
      // Mark as verified
      storedData.verified = true;
      verificationCodes.set(phoneNumber, storedData);
      
      // Update WhatsApp config to include verified phone
      whatsappConfig.verifiedPhone = phoneNumber;
      
      res.json({
        success: true,
        message: 'Phone number verified successfully! You can now send WhatsApp messages.',
        verifiedPhone: `+92${phoneNumber}`,
        status: 'verification_complete'
      });
      
      // Clear the verifying phone number
      verifyingPhoneNumber = null;
      
      console.log(`✅ Phone number verified: +92${phoneNumber}`);
      
    } else {
      res.status(400).json({
        error: 'Invalid verification code. Please try again.',
        remainingAttempts: 'Unlimited',
        hint: 'Make sure you entered the 6-digit code correctly'
      });
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      details: error.message
    });
  }
});

// Send message via WhatsApp Web
router.post('/send-message', async (req, res) => {
  try {
    const { phoneNumber, message, customerId } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: 'Phone number and message are required'
      });
    }
    
    if (!whatsappConfig.isReady) {
      return res.status(400).json({
        error: 'WhatsApp Web is not connected. Please connect first.',
        currentStatus: whatsappConfig.status,
        instruction: 'Go to Setup tab and connect WhatsApp Web'
      });
    }
    
    // Format phone number
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('92')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '92' + formattedPhone.substring(1);
      } else {
        formattedPhone = '92' + formattedPhone;
      }
    }
    
    const chatId = `${formattedPhone}@c.us`;
    
    console.log(`📤 Sending WhatsApp message to ${chatId}`);
    console.log(`📝 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    try {
      // Check if number exists on WhatsApp
      const numberId = await whatsappClient.getNumberId(chatId);
      if (!numberId) {
        return res.status(400).json({
          error: 'This phone number is not registered on WhatsApp',
          phoneNumber: `+${formattedPhone}`,
          details: 'The recipient must have WhatsApp installed and active'
        });
      }

      const sentMessage = await whatsappClient.sendMessage(chatId, message);
      
      console.log('✅ WhatsApp message sent successfully');
      console.log(`📊 Message ID: ${sentMessage.id.id}`);
      
      res.json({
        success: true,
        message: 'Message sent successfully via WhatsApp',
        method: 'whatsapp_web',
        to: `+${formattedPhone}`,
        result: {
          status: 'sent',
          method: 'whatsapp_web',
          messageId: sentMessage.id.id,
          timestamp: sentMessage.timestamp,
          to: `+${formattedPhone}`
        }
      });
      
    } catch (sendError) {
      console.error('❌ WhatsApp send error:', sendError);
      
      if (sendError.message.includes('phone number is not registered')) {
        return res.status(400).json({
          error: 'This phone number is not registered on WhatsApp',
          details: `Number: +${formattedPhone}`
        });
      } else if (sendError.message.includes('Rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending another message.',
          retryAfter: '30 seconds'
        });
      }
      
      throw sendError;
    }
    
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      error: 'Failed to send WhatsApp message',
      details: error.message,
      method: 'whatsapp_web'
    });
  }
});

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, message) {
  if (!whatsappConfig.isReady) {
    throw new Error('WhatsApp Web is not connected');
  }
  
  let formattedPhone = phoneNumber;
  if (!formattedPhone.startsWith('92')) {
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '92' + formattedPhone.substring(1);
    } else {
      formattedPhone = '92' + formattedPhone;
    }
  }
  
  const chatId = `${formattedPhone}@c.us`;
  
  try {
    // Check if number exists on WhatsApp
    const numberId = await whatsappClient.getNumberId(chatId);
    if (!numberId) {
      throw new Error(`Phone number +${formattedPhone} is not registered on WhatsApp`);
    }

    const sentMessage = await whatsappClient.sendMessage(chatId, message);
    
    return {
      status: 'sent',
      method: 'whatsapp_web',
      messageId: sentMessage.id.id,
      timestamp: sentMessage.timestamp,
      to: `+${formattedPhone}`
    };
  } catch (error) {
    throw new Error(`WhatsApp send failed: ${error.message}`);
  }
}

// Send welcome message
router.post('/send-welcome', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (!customer.phone) {
      return res.status(400).json({ error: 'Customer does not have a phone number' });
    }
    
    const welcomeMessage = `🎉 *Welcome to AM FITNESS Gym, ${customer.name}!*

Your membership details:
📋 *Roll Number:* ${customer.rollNumber}
💪 *Membership:* ${customer.membership.toUpperCase()}
💰 *Fee:* PKR ${customer.fee}
💳 *Paid:* PKR ${customer.paidAmount}
${customer.remaining > 0 ? `❌ *Remaining:* PKR ${customer.remaining}` : '✅ *Fully Paid*'}
⏰ *Expires:* ${customer.expiryDate}

Thank you for joining us! 🏋️‍♂️

For any queries, contact us at the gym.

---
_Automated message from Gym Management System_`;

    const result = await sendWhatsAppMessage(customer.phone, welcomeMessage);
    
    res.json({
      success: true,
      message: 'Welcome message sent successfully via WhatsApp',
      result
    });
    
  } catch (error) {
    console.error('❌ Welcome message error:', error);
    res.status(500).json({
      error: 'Failed to send welcome message',
      details: error.message
    });
  }
});

// Send fee reminder
router.post('/send-fee-reminder', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (customer.remaining <= 0) {
      return res.status(400).json({ error: 'No pending payment for this customer' });
    }
    
    if (!customer.phone) {
      return res.status(400).json({ error: 'Customer does not have a phone number' });
    }
    
    const reminderMessage = `💳 *Payment Reminder*

Hello *${customer.name}!*

Your gym membership payment is pending:

📋 *Roll Number:* ${customer.rollNumber}
💰 *Total Fee:* PKR ${customer.fee}
✅ *Paid:* PKR ${customer.paidAmount}
❌ *Remaining:* PKR ${customer.remaining}
⏰ *Due Date:* ${customer.expiryDate}

Please complete your payment at your earliest convenience.

Thank you! 🏋️‍♂️

---
_Automated reminder from Gym Management System_`;

    const result = await sendWhatsAppMessage(customer.phone, reminderMessage);
    
    res.json({
      success: true,
      message: 'Fee reminder sent successfully via WhatsApp',
      result
    });
    
  } catch (error) {
    console.error('❌ Fee reminder error:', error);
    res.status(500).json({
      error: 'Failed to send fee reminder',
      details: error.message
    });
  }
});

// Trigger all fee reminders
router.post('/trigger-fee-reminders', async (req, res) => {
  try {
    if (!whatsappConfig.isReady) {
      return res.status(400).json({ 
        error: 'WhatsApp Web is not connected',
        instruction: 'Please connect WhatsApp Web first'
      });
    }
    
    const pendingCustomers = await Customer.find({ remaining: { $gt: 0 } });
    
    let sent = 0;
    let failed = 0;
    const results = [];
    
    console.log(`📤 Starting bulk reminder sending to ${pendingCustomers.length} customers...`);
    
    for (const customer of pendingCustomers) {
      try {
        if (!customer.phone || customer.phone.trim() === '') {
          failed++;
          results.push({ customer: customer.name, status: 'failed', reason: 'No phone number' });
          continue;
        }
        
        const reminderMessage = `💳 *Payment Reminder*

Hello *${customer.name}!*

Your gym membership payment is pending:

📋 *Roll Number:* ${customer.rollNumber}
💰 *Total Fee:* PKR ${customer.fee}
✅ *Paid:* PKR ${customer.paidAmount}
❌ *Remaining:* PKR ${customer.remaining}
⏰ *Due Date:* ${customer.expiryDate}

Please complete your payment at your earliest convenience.

Thank you! 🏋️‍♂️

---
_Automated reminder from Gym Management System_`;

        await sendWhatsAppMessage(customer.phone, reminderMessage);
        sent++;
        results.push({ customer: customer.name, status: 'sent', phone: customer.phone });
        
        console.log(`✅ Reminder sent to ${customer.name} (${customer.phone})`);
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        
      } catch (error) {
        console.error(`❌ Failed to send reminder to ${customer.name}:`, error.message);
        failed++;
        results.push({ customer: customer.name, status: 'failed', reason: error.message });
      }
    }
    
    console.log(`📊 Bulk reminder completed: ${sent} sent, ${failed} failed`);
    
    res.json({
      success: true,
      message: `Fee reminders completed via WhatsApp: ${sent} sent, ${failed} failed`,
      stats: { sent, failed, total: pendingCustomers.length },
      results: results
    });
    
  } catch (error) {
    console.error('❌ Bulk fee reminder error:', error);
    res.status(500).json({
      error: 'Failed to send fee reminders',
      details: error.message
    });
  }
});

// Disconnect WhatsApp
router.post('/disconnect', async (req, res) => {
  try {
    if (whatsappClient) {
      console.log('🛑 Disconnecting WhatsApp client...');
      await whatsappClient.destroy();
      whatsappClient = null;
    }
    
    whatsappConfig = {
      method: 'none',
      isReady: false,
      status: 'disconnected',
      provider: 'none',
      qrCode: null
    };
    
    // Clear verification codes
    verificationCodes.clear();
    verifyingPhoneNumber = null;
    qrCodeData = null;
    
    console.log('✅ WhatsApp disconnected successfully');
    
    res.json({
      success: true,
      message: 'WhatsApp disconnected successfully'
    });
    
  } catch (error) {
    console.error('❌ Disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect WhatsApp',
      details: error.message
    });
  }
});

// Get configuration status
router.get('/config-status', (req, res) => {
  res.json({
    whatsappWeb: {
      configured: whatsappClient !== null,
      status: whatsappConfig.status,
      isReady: whatsappConfig.isReady,
      clientInfo: whatsappConfig.clientInfo || null
    },
    current: whatsappConfig,
    activeCodesCount: verificationCodes.size,
    verifyingPhone: verifyingPhoneNumber,
    statistics: {
      totalVerificationCodes: verificationCodes.size,
      clientConnected: whatsappClient !== null,
      lastStatusUpdate: new Date().toISOString()
    }
  });
});

export default router;
