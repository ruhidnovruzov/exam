require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('./prismaClient');

async function main() {
  const username = 'admin';
  const parol = 'parol123';
  const ad = 'Admin';
  const soyad = 'User';
  const rol = 'ADMIN';

  const existing = await prisma.istifadeci.findUnique({ where: { username } });
  if (existing) {
    console.log('Admin istifadəçi artıq mövcuddur:', existing.username);
    return;
  }

  const hash = await bcrypt.hash(parol, 10);
  const user = await prisma.istifadeci.create({
    data: {
      username,
      parol: hash,
      ad,
      soyad,
      rol,
    },
  });

  console.log('Admin istifadəçi yaradıldı:', user.username);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
