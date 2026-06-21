const mongoose = require('mongoose');

const EqubMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  isDrawn: { type: Boolean, default: false },
  drawnRound: { type: Number, default: null },
  kycVerified: { type: Boolean, default: false },
  bankLinked: { type: Boolean, default: false },
  hasDefaulted: { type: Boolean, default: false },
  trustScore: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
});

const EqubPaymentSchema = new mongoose.Schema({
  round: { type: Number, required: true },
  paidMemberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }] // We will use embedded subdocuments instead, so we use string IDs to match frontend
});

// Fix: because frontend generates IDs like 'Math.random().toString(36)', 
// we will just store strings for IDs to maintain compatibility for now.
const EqubPaymentSchemaCompat = new mongoose.Schema({
  round: { type: Number, required: true },
  paidMemberIds: [{ type: String }] 
}, { _id: false });

const EqubMemberSchemaCompat = new mongoose.Schema({
  id: { type: String, required: true }, // Frontend uses its own string IDs
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  isDrawn: { type: Boolean, default: false },
  drawnRound: { type: Number, default: null },
  kycVerified: { type: Boolean, default: false },
  bankLinked: { type: Boolean, default: false },
  hasDefaulted: { type: Boolean, default: false },
  trustScore: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
}, { _id: false });

const EqubSchema = new mongoose.Schema({
  creatorId: { type: String, required: true },
  name: { type: String, required: true },
  paymentAmount: { type: Number, required: true },
  poolSize: { type: Number, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  startDate: { type: String, required: true },
  nextDrawDate: { type: String, required: true },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  currentRound: { type: Number, default: 1 },
  members: [EqubMemberSchemaCompat],
  payments: [EqubPaymentSchemaCompat]
}, { timestamps: true });

// Ensure id maps to _id for frontend compatibility
EqubSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  }
});

module.exports = mongoose.model('Equb', EqubSchema);
