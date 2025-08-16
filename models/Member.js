// models/Member.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    email: String,
    feeAmount: { type: Number, required: true },
    feesDueDate: { type: Date, required: true },
    feesStatus: { 
        type: String, 
        enum: ['paid', 'pending', 'overdue'], 
        default: 'pending' 
    },
    joinDate: { type: Date, default: Date.now },
    membershipType: String
});

module.exports = mongoose.model('Member', memberSchema);