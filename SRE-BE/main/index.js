'use strict';

require('dotenv').config();

// New Relic APM must be the very first require for full instrumentation coverage
require('newrelic');

const Sentry = require('@sentry/node');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const db = require('./db');
const { registerProcessors } = require('../workers');

// Sentry — initialise before any other middleware
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Sample 10 % of transactions in production to control cost
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Redact sensitive fields from breadcrumbs / payloads
  beforeSend(event) {
    if (event.request && event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});

// Structured logger (writes JSON lines so log-aggregators can parse easily)
const logger = {
  _write(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    (level === 'error' ? process.stderr : process.stdout).write(
      JSON.stringify(entry) + '\n'
    );
  },
  info: (msg, meta) => logger._write('info', msg, meta),
  warn: (msg, meta) => logger._write('warn', msg, meta),
  error: (msg, meta) => logger._write('error', msg, meta),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') logger._write('debug', msg, meta);
  },
};

// Express application
const app = express();

// Informs Express it sits behind a reverse proxy — required for accurate
// client IP extraction and secure cookie behaviour in production.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS — allow localhost origins in non-production environments
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });
}

// Cookie parsing
app.use(cookieParser());

// Body parsing — cap payload size to prevent denial-of-service via large bodies
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Middleware — request ID & structured access logging
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();

  res.on('finish', () => {
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});


app.use('/api/v1', require('./route'));

const asyncHandler = require('./lib/asyncHandler');

// Routes — health & readiness probes (no auth — used by load balancers)
app.get('/health', asyncHandler(async (req, res) => {
  await db.raw('SELECT 1');
  res.status(200).json({
    status: 'ok',
    db: 'connected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}));

app.get('/ready', (_req, res) => {
  res.status(200).json({ status: 'ready' });
});


// Sentry — error handler (must be registered before custom error handler)
Sentry.setupExpressErrorHandler(app);

// 404 — catch-all for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ status: 0, error: 'Resource not found.' });
});

// Global error handler — always returns { status: 0, error }
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProd     = process.env.NODE_ENV === 'production';

  logger.error('unhandled_error', {
    requestId: req.id,
    status:    statusCode,
    message:   err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });

  res.status(statusCode).json({
    status: 0,
    error:  isProd && statusCode === 500 ? 'An unexpected error occurred.' : err.message,
    requestId: req.id,
  });
});

// Server startup
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Register Bull queue processors
registerProcessors();

const server = app.listen(PORT, HOST, () => {
  logger.info('server_started', {
    host: HOST,
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });
});

// Emit an error if the port is already in use
server.on('error', (err) => {
  logger.error('server_error', { message: err.message });
  process.exit(1);
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('shutdown_initiated', { signal });

  // Stop accepting new connections; wait for in-flight requests to finish
  server.close(async () => {
    try {
      await db.destroy();
      logger.info('shutdown_complete');
      process.exit(0);
    } catch (err) {
      logger.error('shutdown_db_error', { message: err.message });
      process.exit(1);
    }
  });

  // Forced exit if graceful shutdown exceeds 30 s
  setTimeout(() => {
    logger.error('shutdown_timeout', { message: 'Forced exit after 30 s.' });
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety nets — log, report to Sentry, then exit
process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { message: err.message, stack: err.stack });
  Sentry.captureException(err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('unhandled_rejection', { message: err.message, stack: err.stack });
  Sentry.captureException(err);
  shutdown('unhandledRejection');
});

// Exports — useful for integration testing
module.exports = { app, db };
