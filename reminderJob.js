// reminderJob.js
import Customer from './models/Customer.js';
import sendWhatsappMessage from './utils/sendWhatsappMessage.js';

const reminderJob = async () => {
  const today = new Date().toISOString().split('T')[0];
  const customers = await Customer.find({ expiryDate: today });

  for (let customer of customers) {
    const message = `📢 Reminder: Aaj aapki gym fee expire ho chuki hai. Kripya renew karwa lein. 💪`;
    const phone = customer.phone.startsWith('+') ? customer.phone : `+92${customer.phone.slice(-10)}`;

    try {
      await sendWhatsappMessage(phone, message);
      console.log(`✅ Reminder sent to ${phone}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${phone}:`, err.message);
    }
  }
};

export default reminderJob;
