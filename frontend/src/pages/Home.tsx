import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Esta tela existe por dois motivos, e o segundo não é cosmético.
//
// 1. É a porta de entrada depois do login.
// 2. É o destino do `RequireRole` quando o papel não bate. Se "/" apontasse para uma tela
//    financeira, `comercial` e `consulta` seriam mandados de volta para uma rota que também
//    lhes é negada — loop de redirecionamento. Por isso "/" fica FORA de qualquer RequireRole
//    e precisa funcionar para todo papel, inclusive os que ainda não abrem módulo nenhum.
//
// A Home do CaxHub não servia: ela lista departamentos gerenciados via /api/dashboard/meu-perfil,
// que resolve a view USU_VBI00Cons — customização que este espelho não tem.

interface Atalho {
  to: string;
  titulo: string;
  descricao: string;
  roles: string[];
}

const ATALHOS: Atalho[] = [
  {
    to: "/financeiro/contas-a-receber",
    titulo: "Contas a Receber",
    descricao: "Carteira em aberto, aging e a lista de títulos.",
    roles: ["admin", "diretoria", "financeiro"],
  },
  {
    to: "/financeiro/fluxo-caixa",
    titulo: "Fluxo de Caixa",
    descricao: "Previsto contra realizado, risco da carteira e o operacional do dia.",
    roles: ["admin", "diretoria", "financeiro"],
  },
  {
    to: "/financeiro/inadimplencia",
    titulo: "Inadimplência",
    descricao: "Carteira vencida, ranking de devedores e curva ABC.",
    roles: ["admin", "diretoria", "financeiro"],
  },
  {
    to: "/financeiro/recebimentos",
    titulo: "Recebimentos",
    descricao: "Baixas efetivas por dia, portador e conta corrente.",
    roles: ["admin", "diretoria", "financeiro"],
  },
  {
    to: "/mercado/pedidos",
    titulo: "Listar Pedidos",
    descricao: "Carteira de pedidos do grupo, por lista, por cliente ou em resumo.",
    roles: ["admin", "diretoria", "comercial"],
  },
  {
    to: "/admin/usuarios",
    titulo: "Usuários",
    descricao: "Convites, papéis e acessos.",
    roles: ["admin"],
  },
  {
    to: "/admin/sincronizacao-erp",
    titulo: "Importados do Senior",
    descricao: "Estado dos jobs que trazem os dados do ERP.",
    roles: ["admin"],
  },
];

export function Home() {
  const { user } = useAuth();
  const atalhos = ATALHOS.filter((a) => user && a.roles.includes(user.role));

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">CaxHub Hedel</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
        Olá, {user?.nome?.split(" ")[0] ?? "bem-vindo"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Espelho da estrutura padrão do Senior — grupo Hedel.
      </p>

      {atalhos.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-lg border border-border bg-surface p-5 transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-display text-base font-semibold text-foreground">{a.titulo}</p>
              <p className="mt-1.5 text-[12.5px] text-muted">{a.descricao}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-foreground">Nenhum módulo liberado para o seu papel ainda.</p>
          <p className="mt-1.5 text-[12.5px] text-muted">
            O papel <span className="font-mono">{user?.role}</span> já existe no cadastro, mas as
            telas correspondentes ainda não foram construídas. Fale com um administrador se
            precisar de acesso ao financeiro.
          </p>
        </div>
      )}
    </div>
  );
}
