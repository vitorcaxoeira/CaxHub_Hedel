# CaxHub_Hedel

Espelho local da **estrutura padrão** do Senior ERP. Busca dados por SOAP, popula as tabelas
locais e disponibiliza uma tela para acompanhar e disparar as sincronizações. Os dashboards
vêm depois — hoje só existe a camada de ingestão.

## O recorte

Só tabela **padrão** do Senior. Nada que venha de tabela ou view `USU_` (as customizações
que a Soeltech construiu por cima do Sapiens), nem campo `usu_` dentro de tabela padrão.

Isso deixa de fora todo o domínio de Gestão de Projetos (propostas, RATs, atividades,
consultores, departamentos), que continua no CaxHub. O que sobra é o espelho **financeiro e
comercial**, em 17 tabelas:

| | |
|---|---|
| Cadastros | `e070emp` Empresas · `e070fil` Filiais · `e085cli` Clientes · `e090rep` Representantes · `e044ccu` Centros de Custo · `e091plf` Naturezas Financeiras |
| Financeiro | `e002tpt` Tipos de Título · `e301tcr` Títulos a Receber · `e301mcr` Movimentos de Título · `e600mcc` Movimentos de Conta · `E600CCO` Contas Correntes · `e039por` Portadores · `e031moe` Moedas · `e001tns` Transações |
| Comercial | `E120PED` Pedidos · `E028CPG` Condições de Pagamento · `E066FPG` Formas de Pagamento |

Um caso a lembrar: `E120PED` é padrão, mas tinha a coluna customizada `usu_numrat` no SELECT
do CaxHub. Ela **não** foi trazida.

## Banco

Mesmo Postgres do CaxHub, **schema separado** (`hedel`) — a separação vive na
`DATABASE_URL`. O schema `public` continua sendo só do CaxHub.

Consequência assumida: um `pg_dump`/restore de um arrasta o outro. A rotina de backup
precisa dumpar os dois schemas.

## Ordem dos syncs

A ordem em [`src/sync/registry.ts`](backend/src/sync/registry.ts) é de **dependência**, não
temática. As arestas de hoje:

```
Filial                 -> Empresa
TituloReceber          -> Cliente, TipoTitulo, Portador
MovimentoTituloReceber -> TituloReceber, Transacao
```

Portador e Transação vêm antes dos Títulos por isso. No CaxHub eles vinham depois e ninguém
percebia — lá as tabelas já estavam populadas de cargas antigas, então o upsert achava o
alvo de qualquer jeito. Num banco vazio a carga de Títulos a Receber falha inteira por FK.

## Rodar local

```bash
cd backend && npm install
cp .env.example .env      # preencher SOAP_USER, SOAP_PASSWORD, JWT_SECRET e DATABASE_URL
npx prisma generate
npx prisma migrate deploy
npx ts-node prisma/seed.ts   # cria admin@caxhub.local / admin123
npm run dev                  # porta 3002

cd ../frontend && npm install && npm run dev   # porta 5173, proxy /api -> 3002
```

O shadow database do Prisma não funciona neste Postgres (usuário sem permissão de criar
banco), então migration nova se escreve com
`prisma migrate diff --from-empty --to-schema-datamodel` e se aplica com `migrate deploy` —
nunca `migrate dev`.

## Deploy

`docker-compose.yml` sobe só backend e frontend, entrando na rede que o compose do CaxHub já
criou (`caxhub_default`) para alcançar o Postgres pelo hostname `db`. O frontend publica na
porta **8081** (a 8080 é do CaxHub).

## O que não veio do CaxHub

Canal de **escrita** no Senior (`registrarAtividades`/outbox), trilha de auditoria, domínio
de projetos e os outros 22 routers. Este projeto só lê do ERP.
