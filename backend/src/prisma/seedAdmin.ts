import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const plain = process.env.ADMIN_PASSWORD;
  const approvedEnv = (process.env.ADMIN_APPROVED ?? 'true').toLowerCase();
  const completedEnv = (process.env.ADMIN_PROFILE_COMPLETED ?? 'true').toLowerCase();

  if (!email || !plain) {
    console.error('[SEED] Faltan ADMIN_EMAIL o ADMIN_PASSWORD en variables de entorno');
    process.exit(1);
  }

  const isApproved = approvedEnv === 'true';
  const profileCompleted = completedEnv === 'true';
  const passwordHash = await bcrypt.hash(plain, 12);

  // Idempotente: si existe por email, actualiza; si no, crea
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      passwordHash,
      role: 'ADMIN',
      isApproved,
      profileCompleted,
    },
    create: {
      email,
      username,
      passwordHash,
      role: 'ADMIN',
      isApproved,
      profileCompleted,
    },
    select: { id: true, email: true, username: true, role: true, isApproved: true, profileCompleted: true }
  });

  console.log('[SEED] Admin creado/actualizado:', admin);
}

main()
  .catch((e) => {
    console.error('[SEED] Error:', e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
