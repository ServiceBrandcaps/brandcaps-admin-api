
// Model for tracking sync metadata and statistics
import mongoose from 'mongoose';

const SyncMetadataSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['zecat_sync', 'dataverse_sync', 'manual_sync'],
      index: true,
    },
    lastSuccessfulSync: {
      type: Date,
      default: null,
    },
    lastAttemptedSync: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['idle', 'running', 'completed', 'failed', 'partial'],
      default: 'idle',
    },
    stats: {
      total: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      duration: { type: Number, default: 0 }, // in milliseconds
    },
    error: {
      message: String,
      timestamp: Date,
      details: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'sync_metadata',
  }
);

// Index for querying recent sync status
SyncMetadataSchema.index({ lastSuccessfulSync: -1 });
SyncMetadataSchema.index({ lastAttemptedSync: -1 });

export default mongoose.models.SyncMetadata ||
  mongoose.model('SyncMetadata', SyncMetadataSchema);
