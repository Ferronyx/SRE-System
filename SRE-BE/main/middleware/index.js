'use strict';

const jwt    = require('jsonwebtoken');
const Sentry = require('@sentry/node');

// Validates Bearer JWT and attaches user id, role, orgId to req
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 0, error: 'Missing or malformed token.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user  = { id: payload.sub, role: payload.role };
    req.orgId = payload.org;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 0, error: 'Token has expired.' });
    }
    // Unexpected JWT error — capture for visibility
    Sentry.captureException(err);
    return res.status(401).json({ status: 0, error: 'Invalid token.' });
  }
}

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter (per IP).
// NOTE: Replace with Redis-backed solution for multi-instance deployments.
// ---------------------------------------------------------------------------
const rateLimitStore = new Map();

// Prune expired rate-limit entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// Enforces a request-per-window cap per IP; responds 429 when exceeded
function rateLimit({ windowMs = 60_000, max = 100 } = {}) {
  return (req, res, next) => {
    const key    = req.ip;
    const now    = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count   = 0;
      record.resetAt = now + windowMs;
    }

    record.count += 1;
    rateLimitStore.set(key, record);

    res.setHeader('X-RateLimit-Limit',     max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset',     Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      return res.status(429).json({ status: 0, error: 'Too many requests. Please try again later.' });
    }

    next();
  };
}

module.exports = { authenticate, rateLimit };
