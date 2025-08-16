// routes/messages.js
const express = require('express');
const router = express.Router();
const { sendWhatsAppMessage } = require('../services/whatsapp');

// Manual message send
router.post('/send-reminder', async (req, res) => {
    try {
        const { phoneNumber, memberName, amount, dueDate } = req.body;
        
        const message = `
🏋️ *Fee Reminder*

Hello ${memberName},
Your gym fee of Rs. ${amount} is due on ${dueDate}.
Please pay soon to avoid any inconvenience.

Thanks!
        `;
        
        await sendWhatsAppMessage(phoneNumber, message);
        res.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;