import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: {},
    create: { name: 'SuperAdmin', permissions: JSON.stringify(['*']) },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', permissions: JSON.stringify(['all']) },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: { name: 'Manager', permissions: JSON.stringify(['create', 'read', 'update']) },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: { name: 'User', permissions: JSON.stringify(['read', 'own_update']) },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: { name: 'Viewer', permissions: JSON.stringify(['read']) },
  });

  console.log('Created roles:', superAdminRole.name, adminRole.name, managerRole.name, userRole.name, viewerRole.name);

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'amdox.com' },
    update: {},
    create: {
      name: 'Amdox Technologies',
      domain: 'amdox.com',
      isActive: true,
    },
  });

  console.log('Created tenant:', tenant.name);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  // Check if user exists, if not create
  const existingUser = await prisma.user.findFirst({
    where: { email: 'admin@amdox.com', tenantId: tenant.id },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: 'admin@amdox.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        tenantId: tenant.id,
        roleId: adminRole.id,
        isActive: true,
      },
    });
  }

  console.log('Created admin user: admin@amdox.com');
  console.log('\n✅ Seed complete!');
  console.log('Login: admin@amdox.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });