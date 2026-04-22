'use strict';

/**
 * User routes — current user's profile management.
 *
 * GET   /users/me   Input: Bearer token                    Response: { status, data: user }
 * PATCH /users/me   Input: { fullName* }                   Response: { status, data: user }
 */

const router      = require('express').Router();
const Joi         = require('joi');
const userService = require('../service/user');
const asyncHandler = require('../lib/asyncHandler');
const { authenticate } = require('../middleware');

// GET /users/me — return the current user's profile
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const profile = await userService.getMe(req.user.id, req.orgId);
  res.status(200).json({ status: 1, data: profile });
}));

// PATCH /users/me — update the current user's display name
const updateMeSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(255).required(),
});

router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  // fullName — required
  const { error, value } = updateMeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
  }

  const updated = await userService.updateMe(req.user.id, value.fullName);
  res.status(200).json({ status: 1, data: updated });
}));

module.exports = router;
