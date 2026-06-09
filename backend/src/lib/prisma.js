// backend/src/lib/prisma.js
// Singleton Prisma client — import this everywhere instead of
// creating new PrismaClient() in every file (causes connection pool exhaustion).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;