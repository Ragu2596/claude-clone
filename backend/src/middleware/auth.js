// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { userId } = jwt.verify(header.split(' ')[1], config.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};