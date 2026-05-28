import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@amdox.com' },
    include: { role: true, tenant: true },
  });

  console.log('User found:', JSON.stringify(user, null, 2));
  process.exit(0);
}

checkUser().catch(e => {
  console.error(e);
  process.exit(1);
});
