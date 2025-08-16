const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.initialize();

// Message sending function
const sendWhatsAppMessage = async (phoneNumber, message) => {
    try {
        const chatId = `${phoneNumber}@c.us`;
        await client.sendMessage(chatId, message);
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

module.exports = { sendWhatsAppMessage };