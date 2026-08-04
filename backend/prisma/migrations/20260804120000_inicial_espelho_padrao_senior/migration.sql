-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nome" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "varreduraModo" TEXT,
    "varreduraDetectados" INTEGER,
    "varreduraInicio" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa" (
    "codemp" INTEGER NOT NULL,
    "nomemp" TEXT NOT NULL,
    "sigemp" VARCHAR(30) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("codemp")
);

-- CreateTable
CREATE TABLE "filial" (
    "codemp" INTEGER NOT NULL,
    "codfil" INTEGER NOT NULL,
    "nomfil" TEXT NOT NULL,
    "sigfil" TEXT NOT NULL,

    CONSTRAINT "filial_pkey" PRIMARY KEY ("codemp","codfil")
);

-- CreateTable
CREATE TABLE "clientes" (
    "codcli" INTEGER NOT NULL,
    "nomcli" TEXT NOT NULL,
    "apecli" TEXT NOT NULL,
    "sencli" TEXT NOT NULL,
    "tipcli" TEXT NOT NULL,
    "tipmer" TEXT NOT NULL,
    "tipemc" INTEGER NOT NULL,
    "codram" TEXT NOT NULL,
    "insest" TEXT NOT NULL,
    "cgccpf" BIGINT NOT NULL,
    "endcli" TEXT NOT NULL,
    "cplend" TEXT NOT NULL,
    "cepcli" INTEGER NOT NULL,
    "baicli" TEXT NOT NULL,
    "cidcli" TEXT NOT NULL,
    "sigufs" TEXT NOT NULL,
    "codpai" TEXT NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("codcli")
);

-- CreateTable
CREATE TABLE "tipos_titulo" (
    "codtpt" VARCHAR(3) NOT NULL,
    "destpt" VARCHAR(40) NOT NULL,
    "abrtpt" VARCHAR(5) NOT NULL,
    "recsom" VARCHAR(1) NOT NULL,
    "pagsom" VARCHAR(1) NOT NULL,
    "apltpt" VARCHAR(1),
    "sittpt" VARCHAR(1),

    CONSTRAINT "tipos_titulo_pkey" PRIMARY KEY ("codtpt")
);

-- CreateTable
CREATE TABLE "titulos_receber" (
    "codemp" INTEGER NOT NULL,
    "codfil" INTEGER NOT NULL,
    "numtit" VARCHAR(15) NOT NULL,
    "codtpt" VARCHAR(3) NOT NULL,
    "codcli" INTEGER NOT NULL,
    "sittit" VARCHAR(2) NOT NULL,
    "datemi" DATE NOT NULL,
    "vctori" DATE NOT NULL,
    "vctpro" DATE NOT NULL,
    "vlrori" DECIMAL(15,2) NOT NULL,
    "vlrabe" DECIMAL(15,2),
    "codpor" VARCHAR(4),

    CONSTRAINT "titulos_receber_pkey" PRIMARY KEY ("codemp","codfil","numtit","codtpt")
);

-- CreateTable
CREATE TABLE "movimentos_receber" (
    "codemp" INTEGER NOT NULL,
    "codfil" INTEGER NOT NULL,
    "numtit" VARCHAR(15) NOT NULL,
    "codtpt" VARCHAR(3) NOT NULL,
    "seqmov" INTEGER NOT NULL,
    "codtns" VARCHAR(5) NOT NULL,
    "datmov" DATE NOT NULL,
    "datpgt" DATE,
    "codfpg" INTEGER,
    "vlrmov" DECIMAL(15,2) NOT NULL,
    "vlrliq" DECIMAL(15,2),
    "vlrjrs" DECIMAL(15,2),
    "vlrmul" DECIMAL(15,2),
    "vlrdsc" DECIMAL(15,2),
    "diaatr" INTEGER,
    "codpor" VARCHAR(4),
    "codcrt" VARCHAR(2),
    "codccu" VARCHAR(9),
    "numcco" VARCHAR(14),

    CONSTRAINT "movimentos_receber_pkey" PRIMARY KEY ("codemp","codfil","numtit","codtpt","seqmov")
);

-- CreateTable
CREATE TABLE "representantes" (
    "codrep" INTEGER NOT NULL,
    "nomrep" VARCHAR(100) NOT NULL,
    "aperep" VARCHAR(50) NOT NULL,
    "tiprep" VARCHAR(1) NOT NULL,
    "cgccpf" BIGINT,
    "sitrep" VARCHAR(1) NOT NULL,
    "cidrep" VARCHAR(60),
    "sigufs" VARCHAR(2),

    CONSTRAINT "representantes_pkey" PRIMARY KEY ("codrep")
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "codemp" INTEGER NOT NULL,
    "codccu" VARCHAR(9) NOT NULL,
    "desccu" VARCHAR(80) NOT NULL,
    "abrccu" VARCHAR(20) NOT NULL,
    "tipccu" INTEGER NOT NULL,
    "ccupai" VARCHAR(9),
    "anasin" VARCHAR(1),

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("codemp","codccu")
);

-- CreateTable
CREATE TABLE "movimentos_conta" (
    "codemp" INTEGER NOT NULL,
    "numcco" VARCHAR(14) NOT NULL,
    "datmov" DATE NOT NULL,
    "seqmov" INTEGER NOT NULL,
    "codfil" INTEGER,
    "vlrmov" DECIMAL(15,2) NOT NULL,
    "debcre" VARCHAR(1) NOT NULL,
    "hismov" VARCHAR(100),
    "sitmcc" VARCHAR(1),
    "filmcr" INTEGER,
    "nummcr" VARCHAR(15),
    "tptmcr" VARCHAR(3),
    "seqmcr" INTEGER,
    "codpor" VARCHAR(4),

    CONSTRAINT "movimentos_conta_pkey" PRIMARY KEY ("codemp","numcco","datmov","seqmov")
);

-- CreateTable
CREATE TABLE "naturezas_financeiras" (
    "codemp" INTEGER NOT NULL,
    "ctafin" INTEGER NOT NULL,
    "descta" VARCHAR(80) NOT NULL,
    "abrcta" VARCHAR(20) NOT NULL,
    "defgru" VARCHAR(1) NOT NULL,
    "anasin" VARCHAR(1) NOT NULL,
    "natfin" VARCHAR(1) NOT NULL,
    "sitfin" VARCHAR(1) NOT NULL,

    CONSTRAINT "naturezas_financeiras_pkey" PRIMARY KEY ("codemp","ctafin")
);

-- CreateTable
CREATE TABLE "portadores" (
    "codemp" INTEGER NOT NULL,
    "codpor" VARCHAR(4) NOT NULL,
    "despor" VARCHAR(30) NOT NULL,
    "abrpor" VARCHAR(10) NOT NULL,
    "codban" VARCHAR(3),
    "codage" VARCHAR(7),
    "numcco" VARCHAR(14),

    CONSTRAINT "portadores_pkey" PRIMARY KEY ("codemp","codpor")
);

-- CreateTable
CREATE TABLE "moedas" (
    "codmoe" VARCHAR(3) NOT NULL,
    "desmoe" VARCHAR(30) NOT NULL,
    "sigmoe" VARCHAR(5) NOT NULL,
    "tipmoe" VARCHAR(1) NOT NULL,

    CONSTRAINT "moedas_pkey" PRIMARY KEY ("codmoe")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "codemp" INTEGER NOT NULL,
    "codtns" VARCHAR(5) NOT NULL,
    "destns" VARCHAR(60) NOT NULL,
    "rectpb" VARCHAR(2),

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("codemp","codtns")
);

-- CreateTable
CREATE TABLE "contas_correntes" (
    "codemp" INTEGER NOT NULL,
    "numcco" VARCHAR(14) NOT NULL,
    "descco" VARCHAR(30) NOT NULL,
    "abrcco" VARCHAR(10) NOT NULL,
    "sitcco" VARCHAR(1) NOT NULL,

    CONSTRAINT "contas_correntes_pkey" PRIMARY KEY ("codemp","numcco")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "codemp" INTEGER NOT NULL,
    "codfil" INTEGER NOT NULL,
    "numped" INTEGER NOT NULL,
    "tipped" INTEGER,
    "prcped" INTEGER,
    "tnspro" VARCHAR(5),
    "tnsser" VARCHAR(5),
    "datemi" DATE NOT NULL,
    "horemi" INTEGER,
    "datprv" DATE,
    "obsped" VARCHAR(999),
    "vlrliq" DECIMAL(15,2),
    "obsmot" VARCHAR(250),
    "codcli" INTEGER NOT NULL,
    "pedcli" VARCHAR(20),
    "codcpg" VARCHAR(6) NOT NULL,
    "codfpg" INTEGER,
    "sitped" INTEGER NOT NULL,
    "visto_em_sync" TIMESTAMPTZ(6),
    "removido_em_senior" TIMESTAMPTZ(6),

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("codemp","codfil","numped")
);

-- CreateTable
CREATE TABLE "formas_pagamento" (
    "codemp" INTEGER NOT NULL,
    "codfpg" INTEGER NOT NULL,
    "desfpg" VARCHAR(30) NOT NULL,
    "abrfpg" VARCHAR(10) NOT NULL,
    "sitfpg" VARCHAR(1) NOT NULL,

    CONSTRAINT "formas_pagamento_pkey" PRIMARY KEY ("codemp","codfpg")
);

-- CreateTable
CREATE TABLE "condicoes_pagamento" (
    "codemp" INTEGER NOT NULL,
    "codcpg" VARCHAR(6) NOT NULL,
    "descpg" VARCHAR(50) NOT NULL,
    "abrcpg" VARCHAR(10) NOT NULL,
    "aplcpg" VARCHAR(1) NOT NULL,
    "sitcpg" VARCHAR(1) NOT NULL,

    CONSTRAINT "condicoes_pagamento_pkey" PRIMARY KEY ("codemp","codcpg")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filial" ADD CONSTRAINT "filial_codemp_fkey" FOREIGN KEY ("codemp") REFERENCES "empresa"("codemp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_receber" ADD CONSTRAINT "titulos_receber_codcli_fkey" FOREIGN KEY ("codcli") REFERENCES "clientes"("codcli") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_receber" ADD CONSTRAINT "titulos_receber_codtpt_fkey" FOREIGN KEY ("codtpt") REFERENCES "tipos_titulo"("codtpt") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titulos_receber" ADD CONSTRAINT "titulos_receber_codemp_codpor_fkey" FOREIGN KEY ("codemp", "codpor") REFERENCES "portadores"("codemp", "codpor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_receber" ADD CONSTRAINT "movimentos_receber_codemp_codfil_numtit_codtpt_fkey" FOREIGN KEY ("codemp", "codfil", "numtit", "codtpt") REFERENCES "titulos_receber"("codemp", "codfil", "numtit", "codtpt") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_receber" ADD CONSTRAINT "movimentos_receber_codemp_codtns_fkey" FOREIGN KEY ("codemp", "codtns") REFERENCES "transacoes"("codemp", "codtns") ON DELETE RESTRICT ON UPDATE CASCADE;

