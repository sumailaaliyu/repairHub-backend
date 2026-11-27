const { ZodError } = require('zod');
const { AppError } = require('../utils/respond');

const send = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error: { code, message, ...extra } });

function notFound(req, res) {
  send(res, 404, 'NOT_FOUND', 'Route not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) return send(res, err.status, err.code, err.message);

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = details[0];
    const message = first && first.field ? `${first.field}: ${first.message}` : (first && first.message) || 'Invalid request';
    return send(res, 400, 'VALIDATION_ERROR', message, { details });
  }

  if (err.type === 'entity.parse.failed') return send(res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON');
  if (err.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');

  // A unique constraint that a route did not translate itself
  if (err.code === '23505') return send(res, 409, 'CONFLICT', 'That record already exists');

  console.error(err);
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
}

module.exports = { notFound, errorHandler };
