import moment from 'moment';

export const messageTemplates = {
  feeReminder: (customer) => {
    return `🏋️‍♂️ *AM FITNESS - Fee Reminder*

Dear *${customer.name}*,

This is a friendly reminder that your gym membership fee is due today.

📋 *Member Details:*
• Roll Number: ${customer.rollNumber}
• Membership Type: ${customer.membership.toUpperCase()}
• Total Fee: RS${customer.fee}
• Paid Amount: RS${customer.paidAmount || 0}
• *Remaining Amount: RS${customer.remaining}*

📅 *Payment Due Date:* ${moment().format('DD/MM/YYYY')}

Please visit the gym or contact us to clear your dues and continue enjoying our services.

💪 Keep fit, keep healthy!

Contact: +92-3214468123
Address: China Scheme Block D-1 Lahore

_This is an automated message from AM FITNESS `;
  },

  membershipExpiry: (customer) => {
    const expiryDate = moment(customer.expiryDate);
    const daysLeft = expiryDate.diff(moment(), 'days');
    
    return `🏋️‍♂️ *AM FITNESS - Membership Expiry Alert*

Dear *${customer.name}*,

Your gym membership is expiring soon!

📋 *Member Details:*
• Roll Number: ${customer.rollNumber}
• Membership Type: ${customer.membership.toUpperCase()}
• Expiry Date: ${expiryDate.format('DD/MM/YYYY')}
• Days Remaining: *${daysLeft} days*

🔄 *Renew your membership now to avoid any interruption in your fitness journey!*

Visit us or call to renew:
📞 Contact: +92-3214468123
📍 Address: China Scheme Block D-1 Lahore

💪 Stay committed to your fitness goals!

_This is an automated message from AM FITNESS_`;
  },

  welcomeMessage: (customer) => {
    return `🎉 *Welcome to AM FITNESS!*

Dear *${customer.name}*,

Welcome to our gym family! We're excited to have you on board.

📋 *Your Membership Details:*
• Roll Number: ${customer.rollNumber}
• Membership Type: ${customer.membership.toUpperCase()}
• Join Date: ${moment(customer.joinDate).format('DD/MM/YYYY')}
• Expiry Date: ${moment(customer.expiryDate).format('DD/MM/YYYY')}

🏋️‍♂️ *What's Next?*
• Visit during operating hours: 6:00 AM - 10:00 PM
• Bring your ID for verification
• Follow gym rules and regulations
• Ask our trainers for guidance

💪 *Let's achieve your fitness goals together!*

Contact us: +92-3214468123
Address: China Scheme Block D-1 Lahore

_Welcome to the AM FITNESS family!_`;
  },

  paymentConfirmation: (customer, amount) => {
    return `✅ *Payment Confirmation - AM FITNESS*

Dear *${customer.name}*,

Your payment has been received successfully!

💳 *Payment Details:*
• Amount Paid: RS${amount}
• Date: ${moment().format('DD/MM/YYYY HH:mm')}
• Remaining Balance: RS${customer.remaining - amount}

📋 *Member Details:*
• Roll Number: ${customer.rollNumber}
• Membership Type: ${customer.membership.toUpperCase()}

Thank you for your payment! 🙏

Contact: +92-3214468123

_This is an automated confirmation from AM FITNESS_`;
  }
};

export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if not present (assuming India +91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
};
