'use strict';

// Wraps an async route handler to forward any rejected promise to Express next()
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
