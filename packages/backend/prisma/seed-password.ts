import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating admin password...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.updateMany({
    where: { email: 'admin@amdox.com' },
    data: { passwordHash },
  });

  console.log('✅ Password updated!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });