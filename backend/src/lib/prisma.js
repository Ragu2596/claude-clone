import { PrismaClient } from '@prisma/client';

// Single shared instance — prevents "prepared statement already exists" error
// that occurs when multiple PrismaClient instances share the same connection pool
const prisma = new PrismaClient();

export default prisma;
