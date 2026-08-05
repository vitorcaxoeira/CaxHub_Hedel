-- CreateTable
CREATE TABLE "preferencias_fluxo_caixa" (
    "userId" INTEGER NOT NULL,
    "limiarCaixaMin" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferencias_fluxo_caixa_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "preferencias_fluxo_caixa" ADD CONSTRAINT "preferencias_fluxo_caixa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

