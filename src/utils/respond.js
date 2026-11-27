// Every success response is { success: true, data }. Every error is { success: false, error: { code, message } }.

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

// Express 4 does not catch errors from async handlers by itself.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, ok, asyncHandler };
