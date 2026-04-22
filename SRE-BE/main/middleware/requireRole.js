'use strict';

const roleLevel = require('../lib/roles');

// Middleware factory that enforces a minimum RBAC role level.
// Must run after authenticate() which sets req.user.role.
function requireRole(minRole) {
  return (req, res, next) => {
    const userLevel     = roleLevel[req.user?.role];
    const requiredLevel = roleLevel[minRole];

    if (!userLevel || userLevel < requiredLevel) {
      return res.status(403).json({ status: 0, error: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = requireRole;
