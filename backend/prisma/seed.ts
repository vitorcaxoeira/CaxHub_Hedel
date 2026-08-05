import bcrypt from "bcrypt";
import { prisma } from "../src/db/prisma";

// Papéis do CaxHub_Hedel. NÃO são os do CaxHub — lá são nomes de times de uma consultoria de
// software (administrativo, consultoria, suporte, desenvolvimento), que não descrevem um grupo
// de máquinas, importação e cobranças.
//
// Quem abre o quê, hoje:
//
//   admin       tudo, incluindo Usuários e Sincronização ERP
//   diretoria   as 6 telas financeiras
//   financeiro  as 6 telas financeiras
//   comercial   nada ainda — existe pro cadastro já refletir a organização
//   consulta    nada ainda — a autorização é all-or-nothing por rota, não há modo
//               somente-leitura dentro da tela; o nome promete mais do que a estrutura entrega
//   system      sem tela; existe pro token de serviço de 365 dias de routes/users.ts
//
// Ao mudar esta lista, conferir os três lugares que precisam concordar: o `requireRole(...)`
// do router, o `RequireRole` de App.tsx e o `roles` do grupo em layout/Sidebar.tsx.
const PAPEIS = ["admin", "diretoria", "financeiro", "comercial", "consulta", "system"];

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL ?? "admin@caxhub.local";
const SENHA_ADMIN = process.env.SEED_ADMIN_SENHA ?? "admin123";

async function main() {
  for (const nome of PAPEIS) {
    await prisma.role.upsert({ where: { name: nome }, update: {}, create: { name: nome } });
  }
  console.log(`papéis garantidos: ${PAPEIS.join(", ")}`);

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });

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
