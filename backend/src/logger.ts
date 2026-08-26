import pino from 'pino';

const IS_PROD = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: IS_PROD ? 'info' : 'debug',
});
