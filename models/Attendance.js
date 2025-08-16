import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  rollNumber: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  checkInTime: {
    type: String,
    default: () => new Date().toLocaleTimeString()
  },
  checkOutTime: {
    type: String,
    default: null
  },
  duration: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('Attendance', attendanceSchema);
