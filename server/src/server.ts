/**
 * Express Application Server
 * Express应用主文件
 * 
 * Main server file that configures Express middleware, routes, error handling,
 * logging, and starts the HTTP/HTTPS server.
 * 
 * Requirements: 17.2, 20.4
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import winston from 'winston';
import { Database, createDatabaseFromEnv } from './db';
import {
  createAccessRoutes,
  createAuthRoutes,
  createCardRoutes,
  createDeviceRoutes,
  createLogRoutes,
  createHeartbeatRoutes,
} from './routes';

// Load environment variables
dotenv.config();

// Configure Winston logger
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'nfc-access-control' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
          }
        )
      ),
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Create and configure Express application
 */
function createApp(db: Database): Application {
  const app = express();

  // Security middleware - helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS middleware
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:8080'];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Device-ID'],
    })
  );

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // API routes
  const logRoutes = createLogRoutes(db);
  
  app.use('/api/access', createAccessRoutes(db));
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/cards', createCardRoutes(db));
  app.use('/api/devices', createDeviceRoutes(db));
  app.use('/api/logs', logRoutes);
  app.use('/api', createHeartbeatRoutes(db));  // 心跳端点
  
  // Mount status endpoint at /api/status (from logRoutes)
  // This allows both /api/logs/status and /api/status to work
  app.use('/api', logRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    logger.warn('404 Not Found', {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.url}`,
    });
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Log error with stack trace
    logger.error('Unhandled Error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      ...(isDevelopment && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize database
    logger.info('Initializing database connection...');
    const db = createDatabaseFromEnv();
    logger.info('Database connection established');

    // Create Express app
    const app = createApp(db);

    // Get port from environment
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    // Check if HTTPS is enabled
    const sslCertPath = process.env.SSL_CERT_PATH;
    const sslKeyPath = process.env.SSL_KEY_PATH;
    const useHttps = sslCertPath && sslKeyPath && fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath);

    let server: http.Server | https.Server;

    if (useHttps) {
      // HTTPS server for production
      logger.info('Starting HTTPS server...');
      const httpsOptions = {
        cert: fs.readFileSync(sslCertPath),
        key: fs.readFileSync(sslKeyPath),
      };
      server = https.createServer(httpsOptions, app);
      logger.info(`HTTPS server configured with certificates from ${sslCertPath}`);
    } else {
      // HTTP server for development
      logger.info('Starting HTTP server...');
      server = http.createServer(app);
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Running in production mode without HTTPS. This is not recommended!');
      }
    }

    // Start listening
    server.listen(port, host, () => {
      const protocol = useHttps ? 'https' : 'http';
      logger.info(`Server started successfully`, {
        protocol,
        host,
        port,
        environment: process.env.NODE_ENV || 'development',
        databaseType: process.env.DATABASE_TYPE || 'sqlite',
      });
      logger.info(`Server is running at ${protocol}://${host}:${port}`);
      logger.info(`Health check available at ${protocol}://${host}:${port}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await db.close();
          logger.info('Database connection closed');
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
export { createApp, logger };
