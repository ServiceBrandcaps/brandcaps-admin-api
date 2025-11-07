// src/lib/mongoose.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('❌ Missing MONGODB_URI environment variable. Please check your .env file.');
}

// Use global caching for serverless environments
let cached = global.mongoose || { conn: null, promise: null };
global.mongoose = cached;

/**
 * Connect to MongoDB with optimized settings for Render + MongoDB Atlas free tier
 * Implements connection pooling and proper error handling
 */
export async function connectDB() {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Create new connection promise if none exists
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,           // Disable buffering for serverless
      maxPoolSize: 10,                 // Limit max connections (Atlas free tier: 500 max)
      minPoolSize: 2,                  // Keep minimum connections ready
      serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB unavailable
      socketTimeoutMS: 45000,          // Socket timeout
      family: 4,                       // Force IPv4 (avoid IPv6 issues)
      connectTimeoutMS: 10000,         // Connection timeout
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully');
        return mongoose;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        cached.promise = null; // Reset promise on error to allow retry
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Reset on failure
    throw err;
  }

  return cached.conn;
}

// Connection event monitoring
if (mongoose.connection) {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Will reconnect on next request.');
    cached.conn = null;
    cached.promise = null;
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
}

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    if (cached.conn) {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed through app termination');
      process.exit(0);
    }
  });
}
