
// Model for tracking quote submissions with idempotency
import mongoose from 'mongoose';

const QuoteSubmissionSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      company: String,
      message: String,
    },
    cart: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailError: {
      type: String,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
    collection: 'quote_submissions',
  }
);

// Index for querying recent quotes
QuoteSubmissionSchema.index({ submittedAt: -1 });
QuoteSubmissionSchema.index({ 'customer.email': 1 });

export default mongoose.models.QuoteSubmission ||
  mongoose.model('QuoteSubmission', QuoteSubmissionSchema);
