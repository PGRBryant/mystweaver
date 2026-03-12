import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  ...(config.nodeEnv === 'development'
    ? { transport: { target: 'pino/file', options: { destination: 1 } } }
    : {}),
  formatters: {
    level(label) {
      // Cloud Logging expects "severity" instead of "level"
      return { severity: label.toUpperCase() };
    },
  },
  // Cloud Logging expects "message" instead of "msg"
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
});
