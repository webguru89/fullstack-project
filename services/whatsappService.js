import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.status = 'disconnected';
    this.initializationPromise = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeClient();
    return this.initializationPromise;
  }

  async _initializeClient() {
    try {
      // Cleanup any existing client
      await this._cleanup();

      console.log('🚀 Initializing WhatsApp client...');
      
      // Create auth directory if it doesn't exist
      const authPath = './whatsapp-auth';
      if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
      }

      this.client = new Client({
        authStrategy: new LocalAuth({ 
          name: 'gym-management-session',
          dataPath: authPath
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
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-back-forward-cache',
            '--disable-ipc-flooding-protection',
            '--window-size=1366,768'
          ],
          timeout: 60000
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
      });

      this._setupEventListeners();
      
      // Set timeout for initialization
      const initTimeout = setTimeout(() => {
        if (!this.isReady) {
          console.log('⏰ Initialization timeout, retrying...');
          this._handleInitializationTimeout();
        }
      }, 120000); // 2 minutes timeout

      await this.client.initialize();
      clearTimeout(initTimeout);
      
      console.log('🔄 WhatsApp client initialization started');
      return true;

    } catch (error) {
      console.error('❌ Error initializing WhatsApp:', error);
      this.status = 'error';
      this.isReady = false;
      this.initializationPromise = null;
      
      // Retry logic
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Retrying initialization (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        await this._delay(5000);
        return this._initializeClient();
      }
      
      throw error;
    }
  }

  _setupEventListeners() {
    this.client.on('qr', async (qr) => {
      console.log('🔗 WhatsApp QR Code generated');
      this.status = 'qr_code';
      
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        console.log('📱 QR Code ready. Please scan with WhatsApp');
      } catch (err) {
        console.error('Error generating QR code:', err);
        this.qrCode = qr;
      }
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp is ready!');
      this.isReady = true;
      this.status = 'connected';
      this.qrCode = null;
      this.reconnectAttempts = 0;
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authenticated successfully');
      this.status = 'authenticated';
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.status = 'auth_failed';
      this.isReady = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.isReady = false;
      this.status = 'disconnected';
      this.qrCode = null;
      this.initializationPromise = null;
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log(`Loading: ${percent}% - ${message}`);
    });

    // Handle client errors
    this.client.on('error', (error) => {
      console.error('WhatsApp client error:', error);
      if (error.message.includes('Protocol error') || 
          error.message.includes('Execution context was destroyed')) {
        this._handleProtocolError();
      }
    });
  }

  async _handleProtocolError() {
    console.log('🔄 Handling protocol error, reinitializing...');
    this.isReady = false;
    this.status = 'reconnecting';
    
    try {
      await this._cleanup();
      await this._delay(5000);
      await this.initialize();
    } catch (error) {
      console.error('Failed to recover from protocol error:', error);
      this.status = 'error';
    }
  }

  async _handleInitializationTimeout() {
    console.log('⏰ Initialization timed out');
    this.status = 'timeout';
    await this._cleanup();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Retrying after timeout (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      await this._delay(10000);
      this.initializationPromise = null;
      await this.initialize();
    }
  }

  async _cleanup() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.log('Error during cleanup:', err.message);
      }
      this.client = null;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Phone number validation
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { isValid: false, error: 'Phone number is required' };
    }

    let cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (!cleanedNumber || cleanedNumber.length === 0) {
      return { isValid: false, error: 'Phone number cannot be empty' };
    }

    if (cleanedNumber === '0000' || cleanedNumber === '0' || /^0+$/.test(cleanedNumber)) {
      return { isValid: false, error: 'Invalid phone number: contains only zeros' };
    }

    if (cleanedNumber.length < 10) {
      return { isValid: false, error: 'Phone number is too short' };
    }

    if (cleanedNumber.length > 15) {
      return { isValid: false, error: 'Phone number is too long' };
    }

    let formattedNumber = cleanedNumber;

    if (cleanedNumber.startsWith('92')) {
      if (cleanedNumber.length !== 12) {
        return { isValid: false, error: 'Invalid Pakistani international format' };
      }
      formattedNumber = cleanedNumber;
    } else if (cleanedNumber.startsWith('03')) {
      if (cleanedNumber.length !== 11) {
        return { isValid: false, error: 'Invalid Pakistani mobile format' };
      }
      formattedNumber = '92' + cleanedNumber.slice(1);
    } else if (cleanedNumber.length === 10 && cleanedNumber.startsWith('3')) {
      formattedNumber = '92' + cleanedNumber;
    } else {
      return { 
        isValid: false, 
        error: 'Unsupported phone number format. Please use Pakistani mobile format (03XXXXXXXXX)' 
      };
    }

    if (!/^92[0-9]{10}$/.test(formattedNumber)) {
      return { 
        isValid: false, 
        error: 'Invalid phone number format. Must be a valid Pakistani mobile number' 
      };
    }

    return { 
      isValid: true, 
      formattedNumber,
      chatId: `${formattedNumber}@c.us`
    };
  }

  async sendMessage(phoneNumber, message) {
    if (!this.client) {
      throw new Error('WhatsApp client is not initialized. Please initialize first.');
    }

    if (!this.isReady) {
      throw new Error('WhatsApp is not ready. Please scan the QR code or wait for connection.');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    // Validate phone number
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      throw new Error(`Phone validation failed: ${validation.error}`);
    }

    const { formattedNumber, chatId } = validation;
    console.log(`📤 Sending message to: ${chatId} (original: ${phoneNumber})`);

    const maxRetries = 3;
    let retryCount = 0;
    let lastError;

    while (retryCount < maxRetries) {
      try {
        if (!this.client || !this.isReady) {
          throw new Error('WhatsApp client is not ready');
        }

        const response = await this._sendMessageWithRetry(chatId, message, 2);
        
        console.log(`✅ Message sent successfully to ${phoneNumber}`);
        return { 
          success: true, 
          message: 'Message sent successfully',
          phoneNumber: formattedNumber,
          originalPhone: phoneNumber,
          messageId: response.id?.id || 'unknown',
          timestamp: response.timestamp || Date.now()
        };

      } catch (error) {
        retryCount++;
        lastError = error;
        
        console.error(`❌ Error sending message (attempt ${retryCount}/${maxRetries}):`, error.message);
        
        if (error.message.includes('phone number is not registered')) {
          throw new Error(`Phone number ${phoneNumber} is not registered on WhatsApp`);
        }
        
        if (error.message.includes('Rate limit')) {
          if (retryCount < maxRetries) {
            const delay = 5000 * retryCount;
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await this._delay(delay);
            continue;
          }
        }
        
        if (error.message.includes('Protocol error') || 
            error.message.includes('Execution context was destroyed')) {
          if (retryCount < maxRetries) {
            console.log('🔄 Protocol error detected, waiting before retry...');
            await this._delay(3000 * retryCount);
            continue;
          }
        }
        
        if (retryCount < maxRetries) {
          await this._delay(2000 * retryCount);
        }
      }
    }

    throw new Error(`Failed to send message after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async _sendMessageWithRetry(chatId, message, maxRetries = 2) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!this.client || !this.isReady) {
          throw new Error('Client not ready');
        }

        const response = await this.client.sendMessage(chatId, message);
        return response;
        
      } catch (error) {
        console.log(`Send attempt ${i + 1}/${maxRetries} failed:`, error.message);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        await this._delay(1000 * (i + 1));
      }
    }
  }

  async disconnect() {
    try {
      this.reconnectAttempts = this.maxReconnectAttempts;
      await this._cleanup();
      console.log('🔌 WhatsApp client disconnected');
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
    } finally {
      this.client = null;
      this.isReady = false;
      this.status = 'disconnected';
      this.qrCode = null;
      this.initializationPromise = null;
      this.reconnectAttempts = 0;
    }
  }

  getStatus() {
    return {
      status: this.status,
      isReady: this.isReady,
      qrCode: this.qrCode,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  async restart() {
    console.log('🔄 Force restarting WhatsApp client...');
    await this.disconnect();
    await this._delay(5000);
    return await this.initialize();
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService;
