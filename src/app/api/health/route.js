// Health check endpoint for Render cold start mitigation
// This endpoint can be pinged periodically to keep the service warm
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongoose';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic'; // Disable caching for health checks

/**
 * GET /api/health
 * 
 * Returns health status of the API including:
 * - API status
 * - Database connection status
 * - Uptime
 * - Memory usage (in production)
 * 
 * Use this endpoint for:
 * - Render health checks
 * - Monitoring service
 * - Periodic pings to prevent cold starts (external cron job)
 */
export async function GET(req) {
  const startTime = Date.now();
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check database connectivity
  try {
    await connectDB();
    
    // Verify connection is actually working with a simple ping
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    health.database = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      state: dbStates[dbState],
      name: mongoose.connection.name || 'unknown',
    };

    // Simple query to ensure DB is actually responsive
    if (dbState === 1) {
      const adminDb = mongoose.connection.db.admin();
      await adminDb.ping();
      health.database.ping = 'ok';
    }
  } catch (err) {
    console.error('Health check database error:', err.message);
    health.status = 'degraded';
    health.database = {
      status: 'unhealthy',
      error: err.message,
    };
  }

  // Add response time
  health.responseTime = `${Date.now() - startTime}ms`;

  // Add memory usage (useful for monitoring)
  if (process.env.NODE_ENV === 'production') {
    const memUsage = process.memoryUsage();
    health.memory = {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    };
  }

  // Return appropriate status code based on health
  const statusCode = health.status === 'ok' ? 200 : 503;
  
  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Check': 'true',
    }
  });
}

// Also support HEAD requests for simple ping checks
export async function HEAD(req) {
  try {
    await connectDB();
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-Health-Check': 'true',
        'Cache-Control': 'no-store',
      }
    });
  } catch (err) {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'X-Health-Check': 'true',
      }
    });
  }
}
