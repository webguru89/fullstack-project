import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  rollNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  joinDate: {
    type: String,
    required: true
  },
  expiryDate: {
    type: String,
    required: true
  },
  membership: {
    type: String,
    enum: ['regular', 'training', 'premium', 'basic', 'vip', 'student'],
    required: true
  },
  fee: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remaining: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  emergencyContact: {
    name: String,
    phone: String
  },
  // Renewal history to track all membership renewals
  renewalHistory: [{
    previousMembership: {
      type: String,
      required: true
    },
    previousExpiryDate: {
      type: String,  // Keep as String to match your existing date format
      required: true
    },
    newMembership: {
      type: String,
      required: true
    },
    newExpiryDate: {
      type: String,  // Keep as String to match your existing date format
      required: true
    },
    renewalDate: {
      type: Date,
      default: Date.now
    },
    fee: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      required: true
    },
    durationType: {
      type: String,
      enum: ['day', 'month', 'year'],
      required: true
    },
    startDate: {
      type: String,  // Keep as String to match your existing date format
      required: true
    }
  }],
  // Additional fields for better tracking
  totalRenewals: {
    type: Number,
    default: 0
  },
  lastRenewalDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate remaining amount
customerSchema.pre('save', function(next) {
  if (this.isModified('fee') || this.isModified('paidAmount')) {
    this.remaining = this.fee - this.paidAmount;
  }
  next();
});

export default mongoose.model('Customer', customerSchema);
