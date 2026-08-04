import bcrypt from "bcrypt";
import { prisma } from "../src/db/prisma";

// Seed mínimo: um papel e um usuário, só pra destravar a tela de sincronização — que é a
// única que existe hoje e fica atrás de requireRole("admin").
//
// Não traz os papéis por área do CaxHub (comercial, consultoria, suporte...): aqui não há
// domínio de projetos pra separar, e papel que ninguém usa vira lixo de cadastro.
const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL ?? "admin@caxhub.local";
const SENHA_ADMIN = process.env.SEED_ADMIN_SENHA ?? "admin123";

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin" },
  });

  const existente = await prisma.user.findUnique({ where: { email: EMAIL_ADMIN } });
  if (existente) {
    console.log(`usuário ${EMAIL_ADMIN} já existe — seed não sobrescreve senha`);
    return;
  }

  await prisma.user.create({
    data: {
      email: EMAIL_ADMIN,
      nome: "Administrador",
      passwordHash: await bcrypt.hash(SENHA_ADMIN, 10),
      roleId: adminRole.id,
      status: "ativo",
    },
  });
  console.log(`usuário ${EMAIL_ADMIN} criado`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
