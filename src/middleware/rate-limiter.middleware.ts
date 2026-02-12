import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: (Number(process.env.THROTTLE_TTL) || 60) * 1000,
  max: Number(process.env.THROTTLE_LIMIT) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
