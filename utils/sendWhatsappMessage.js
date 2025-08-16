// utils/sendWhatsappMessage.js
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const sendWhatsappMessage = async (to, message) => {
  try {
    await client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox number
      to: to,
      body: message,
    });
    console.log(`📤 Message sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send message to ${to}:`, error.message);
  }
};

export default sendWhatsappMessage;
