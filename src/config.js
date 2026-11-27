require('dotenv').config();

const env = process.env;

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}. See .env.example`);
  return value;
}

const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT) || 5000,
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  appUrl: (env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  resendApiKey: env.RESEND_API_KEY || '',
  emailFrom: env.EMAIL_FROM || 'RepairHub <onboarding@resend.dev>',
  authRateLimit: Number(env.AUTH_RATE_LIMIT) || 20,
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

module.exports = config;
