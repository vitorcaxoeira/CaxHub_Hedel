-- CreateTable
CREATE TABLE "notas_fiscais_entrada" (
    "codemp" INTEGER NOT NULL,
    "codfil" INTEGER NOT NULL,
    "codfor" INTEGER NOT NULL,
    "numnfc" INTEGER NOT NULL,
    "codsnf" VARCHAR(3) NOT NULL,
    "tipnfe" INTEGER,
    "datent" DATE,
    "datemi" DATE NOT NULL,
    "datger" DATE,
    "codcpg" VARCHAR(6) NOT NULL,
    "codfpg" INTEGER,
    "codmoe" VARCHAR(3),
    "vlrliq" DECIMAL(15,2),
    "sitnfc" VARCHAR(1) NOT NULL,
    "codmot" INTEGER,
    "chvnel" VARCHAR(50),

    CONSTRAINT "notas_fiscais_entrada_pkey" PRIMARY KEY ("codemp","codfil","codfor","numnfc","codsnf")
);

-- AddForeignKey
ALTER TABLE "notas_fiscais_entrada" ADD CONSTRAINT "notas_fiscais_entrada_codfor_fkey" FOREIGN KEY ("codfor") REFERENCES "fornecedores"("codfor") ON DELETE RESTRICT ON UPDATE CASCADE;

