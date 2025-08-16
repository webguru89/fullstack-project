import cron from 'node-cron';
import whatsappService from '../services/whatsappService.js';
import Customer from '../models/Customer.js';

class ReminderJobService {
  constructor() {
    this.jobs = [];
  }

  init() {
    console.log('🕐 Initializing reminder jobs...');
    
    // Fee reminder job - runs daily at 10:00 AM
    const feeReminderJob = cron.schedule('0 10 * * *', async () => {
      console.log('🔔 Running daily fee reminder job...');
      await this.sendFeeReminders();
    }, {
      scheduled: false,
      timezone: "Asia/Karachi"
    });

    // Expiry reminder job - runs daily at 9:00 AM
    const expiryReminderJob = cron.schedule('0 9 * * *', async () => {
      console.log('🔔 Running daily expiry reminder job...');
      await this.sendExpiryReminders();
    }, {
      scheduled: false,
      timezone: "Asia/Karachi"
    });

    // Start the jobs
    feeReminderJob.start();
    expiryReminderJob.start();

    this.jobs.push(feeReminderJob, expiryReminderJob);
    console.log('✅ Reminder jobs started successfully');
  }

  async sendFeeReminders() {
    try {
      if (!whatsappService.isReady) {
        console.log('⚠️ WhatsApp is not ready, skipping fee reminders');
        return;
      }

      const pendingCustomers = await Customer.find({ 
        remaining: { $gt: 0 },
        phone: { $exists: true, $ne: '', $ne: '0000' }
      });

      console.log(`📋 Found ${pendingCustomers.length} customers with pending payments`);

      for (const customer of pendingCustomers) {
        try {
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
          
          await Customer.findByIdAndUpdate(customer._id, {
            lastReminderSent: new Date()
          });

          console.log(`✅ Fee reminder sent to ${customer.name}`);
          
          // Delay between messages
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ Error sending fee reminder to ${customer.name}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error in fee reminder job:', error);
    }
  }

  async sendExpiryReminders() {
    try {
      if (!whatsappService.isReady) {
        console.log('⚠️ WhatsApp is not ready, skipping expiry reminders');
        return;
      }

      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const expiringCustomers = await Customer.find({
        endDate: {
          $lte: threeDaysFromNow,
          $gte: new Date()
        },
        phone: { $exists: true, $ne: '', $ne: '0000' }
      });

      console.log(`📋 Found ${expiringCustomers.length} customers with expiring memberships`);

      for (const customer of expiringCustomers) {
        try {
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
          
          await Customer.findByIdAndUpdate(customer._id, {
            lastExpiryReminderSent: new Date()
          });

          console.log(`✅ Expiry reminder sent to ${customer.name}`);
          
          // Delay between messages
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ Error sending expiry reminder to ${customer.name}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error in expiry reminder job:', error);
    }
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('🛑 All reminder jobs stopped');
  }
}

const reminderJobService = new ReminderJobService();
export default reminderJobService;
