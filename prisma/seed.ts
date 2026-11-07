import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse en .env para ejecutar el seed.');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // El usuario admin se crea solo desde seed; el registro público no acepta ADMIN.
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.trim().toLowerCase() },
    update: { name: 'Admin', passwordHash, role: Role.ADMIN, isActive: true },
    create: {
      email: ADMIN_EMAIL.trim().toLowerCase(),
      passwordHash,
      name: 'Admin',
      role: Role.ADMIN,
    },
  });

  console.log(`Usuario admin listo: ${user.email}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
