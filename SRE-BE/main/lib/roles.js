'use strict';

// RBAC role hierarchy — higher number = more permissions
const roleLevel = { viewer: 1, member: 2, admin: 3, owner: 4 };

module.exports = roleLevel;
