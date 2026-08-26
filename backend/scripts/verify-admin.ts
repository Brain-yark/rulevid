import 'dotenv/config';
import { prisma } from '../src/db';
import { ensureSuperAdmin } from '../src/controllers/adminController';

async function main() {
  console.log('Ensuring Super Admin exists...');
  await ensureSuperAdmin();

  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@svsm.io' },
  });

  console.log('Super Admin User found:', {
    id: superAdmin?.id,
    email: superAdmin?.email,
    role: superAdmin?.role,
    name: superAdmin?.name,
    status: superAdmin?.status,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('Error verifying super admin:', err);
  process.exit(1);
});
