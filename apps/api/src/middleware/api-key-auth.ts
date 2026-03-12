import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  const expected = Buffer.from(config.apiSigningKey);
  const received = Buffer.from(apiKey);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
