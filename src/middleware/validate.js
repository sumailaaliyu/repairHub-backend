// validate(schema) parses req.body with a zod schema. A failure becomes a 400 VALIDATION_ERROR.
const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body === undefined ? {} : req.body);
  next();
};

module.exports = validate;
