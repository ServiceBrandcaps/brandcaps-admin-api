
// Model for tracking failed sync attempts for retry
import mongoose from 'mongoose';

const FailedSyncSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['zecat', 'dataverse', 'manual'],
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['product', 'family', 'category', 'other'],
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    error: {
      message: { type: String, required: true },
      code: String,
      statusCode: Number,
      stack: String,
    },
    attemptCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'failed_syncs',
  }
);

// Compound index for finding unresolved failures
FailedSyncSchema.index({ type: 1, resolved: 1, lastAttempt: -1 });
FailedSyncSchema.index({ entityType: 1, entityId: 1, resolved: 1 });

// Method to mark as resolved
FailedSyncSchema.methods.markResolved = function() {
  this.resolved = true;
  this.resolvedAt = new Date();
  return this.save();
};

// Static method to get unresolved failures
FailedSyncSchema.statics.getUnresolved = function(type = null, limit = 100) {
  const query = { resolved: false };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ lastAttempt: 1 }) // Oldest first
    .limit(limit);
};

export default mongoose.models.FailedSync ||
  mongoose.model('FailedSync', FailedSyncSchema);
