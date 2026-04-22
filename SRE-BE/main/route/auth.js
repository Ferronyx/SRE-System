'use strict';

/**
 * Auth routes — register, login, token refresh, logout.
 *
 * POST /auth/register        Input: { email*, fullName*, password*, orgName* }         Response: { status, data: { accessToken, user, org, role } }
 * POST /auth/login           Input: { email*, password* }                               Response: { status, data: { accessToken, user, org, role } }
 * POST /auth/refresh         Input: refresh_token cookie                                Response: { status, data: { accessToken } }
 * POST /auth/logout          Input: refresh_token cookie                                Response: { status, message }
 * POST /auth/logout-all      Input: Bearer token                                        Response: { status, message }
 */

const router      = require('express').Router();
const Joi         = require('joi');
const authService = require('../service/auth');
const asyncHandler = require('../lib/asyncHandler');
const { authenticate, rateLimit } = require('../middleware');

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// Validation schemas
const registerSchema = Joi.object({
  email:    Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  fullName: Joi.string().trim().min(1).max(255).required(),
  orgName:  Joi.string().trim().min(1).max(255).required(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().max(255).required(),
  password: Joi.string().max(128).required(),
});

// POST /auth/register — create user + default org
router.post('/register', asyncHandler(async (req, res) => {
  // email, fullName, password, orgName — all required
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
  }

  const { user, org, accessToken, refreshToken } = await authService.register({ ...value, ip: req.ip });

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(201).json({
    status: 1,
    data: {
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      org:  { id: org.id,  name: org.name,  slug: org.slug },
    },
  });
}));

// POST /auth/login — issue JWT + refresh token (rate limited: 10 req / 15 min per IP)
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  asyncHandler(async (req, res) => {
    // email, password — both required
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
    }

    const { user, org, role, accessToken, refreshToken } = await authService.login({
      email:    value.email,
      password: value.password,
      ip:       req.ip,
    });

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      status: 1,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, fullName: user.full_name },
        org,
        role,
      },
    });
  })
);

// POST /auth/refresh — exchange refresh token cookie for a new access token
router.post('/refresh', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) {
    return res.status(401).json({ status: 0, error: 'No refresh token provided.' });
  }

  const { accessToken, refreshToken } = await authService.refreshTokens({ rawToken, ip: req.ip });

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ status: 1, data: { accessToken } });
}));

// POST /auth/logout — revoke the current refresh token
router.post('/logout', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) await authService.revokeToken(rawToken);
  res.clearCookie(REFRESH_COOKIE);
  res.status(200).json({ status: 1, message: 'Logged out.' });
}));

// POST /auth/logout-all — revoke all refresh tokens for the current user
router.post('/logout-all', authenticate, asyncHandler(async (req, res) => {
  await authService.revokeAllTokens(req.user.id);
  res.clearCookie(REFRESH_COOKIE);
  res.status(200).json({ status: 1, message: 'All sessions revoked.' });
}));

module.exports = router;
