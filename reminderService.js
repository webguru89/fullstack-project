// reminderService.js
const cron = require('node-cron');
const { sendWhatsAppMessage } = require('./whatsapp');
const Member = require('./models/Member'); // Your member model

// Daily check for due fees
cron.schedule('0 9 * * *', async () => {
    try {
        const today = new Date();
        const members = await Member.find({
            feesDueDate: { $lte: today },
            feesStatus: 'pending'
        });

        members.forEach(async (member) => {
            const message = `
🏋️ *Gym Fee Reminder*

Hello ${member.name},

Your gym membership fee is due today.
Amount: Rs. ${member.feeAmount}
Due Date: ${member.feesDueDate.toDateString()}

Please pay at your earliest convenience.

Thanks,
${process.env.GYM_NAME}
            `;
            
            await sendWhatsAppMessage(member.phoneNumber, message);
        });
    } catch (error) {
        console.error('Error in fee reminder:', error);
    }
});