-- CreateTable
CREATE TABLE "fornecedores" (
    "codfor" INTEGER NOT NULL,
    "nomfor" VARCHAR(100) NOT NULL,
    "apefor" VARCHAR(50) NOT NULL,
    "tipfor" VARCHAR(1) NOT NULL,
    "tipmer" VARCHAR(1) NOT NULL,
    "codram" VARCHAR(5),
    "insest" VARCHAR(25),
    "cgccpf" BIGINT,
    "endfor" VARCHAR(100),
    "cplend" VARCHAR(200),
    "cepfor" INTEGER,
    "baifor" VARCHAR(75),
    "cidfor" VARCHAR(60),
    "sigufs" VARCHAR(2),
    "codpai" VARCHAR(4),
    "sitfor" VARCHAR(1) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("codfor")
);

