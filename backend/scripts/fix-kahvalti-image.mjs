import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IMAGES = {
  kahvalti: 'https://images.unsplash.com/photo-1533089860890-a1c960265a9c?w=800&q=80',
  serbet: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80',
  tavuk: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
};

function groupName(g) {
  const i18n = g.i18n && typeof g.i18n === 'object' ? g.i18n : {};
  return (
    i18n.tr?.name ||
    i18n.en?.name ||
    Object.values(i18n).find((v) => v?.name)?.name ||
    `Group ${g.id}`
  );
}

function pickImage(name) {
  const n = name.toLocaleLowerCase('tr-TR');
  if (n.includes('kahvalt') || n.includes('breakfast')) return IMAGES.kahvalti;
  if (n.includes('şerbet') || n.includes('serbet') || n.includes('icecek') || n.includes('içecek'))
    return IMAGES.serbet;
  if (n.includes('tavuk') || n.includes('chicken')) return IMAGES.tavuk;
  return IMAGES.kahvalti;
}

async function main() {
  const groups = await prisma.group.findMany({
    select: { id: true, imageUrl: true, i18n: true },
  });

  for (const g of groups) {
    const name = groupName(g);
    const needs =
      !g.imageUrl ||
      name.toLocaleLowerCase('tr-TR').includes('kahvalt') ||
      name.toLocaleLowerCase('tr-TR').includes('breakfast');

    if (!needs && g.imageUrl) continue;

    const imageUrl = pickImage(name);
    await prisma.group.update({ where: { id: g.id }, data: { imageUrl } });
    console.log('set', g.id, name, '->', imageUrl);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
