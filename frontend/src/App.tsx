import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { RequireRole } from "./auth/RequireRole";
import { ThemeProvider } from "./theme/ThemeContext";
import { ToastProvider } from "./components/ui/Toast";
import { AppShell } from "./layout/AppShell";
import { Login } from "./pages/Login";
import { AceitarConvite } from "./pages/AceitarConvite";
import { Home } from "./pages/Home";
import { Perfil } from "./pages/Perfil";
import { ContasReceber } from "./pages/financeiro/ContasReceber";
import { Recebimentos } from "./pages/financeiro/Recebimentos";
import { Inadimplencia } from "./pages/financeiro/Inadimplencia";
import { Clientes } from "./pages/financeiro/Clientes";
import { FluxoCaixa } from "./pages/financeiro/FluxoCaixa";
import { Historico } from "./pages/financeiro/Historico";
import { NotasEntrada } from "./pages/suprimentos/NotasEntrada";
import { ListarPedidos } from "./pages/mercado/ListarPedidos";
import { PedidoVisualizacao } from "./pages/mercado/PedidoVisualizacao";
import { Usuarios } from "./pages/admin/Usuarios";
import { SincronizacaoErp } from "./pages/admin/SincronizacaoErp";

// Os papéis abaixo têm que bater com o `requireRole(...)` do router correspondente no backend
// e com o `roles` do grupo em layout/Sidebar.tsx. Os três juntos são a regra de acesso; se
// divergirem, o menu mostra link que o servidor recusa.
const PAPEIS_FINANCEIRO = ["admin", "diretoria", "financeiro"];
const PAPEIS_MERCADO = ["admin", "diretoria", "comercial"];

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/aceitar-convite" element={<AceitarConvite />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                {/* Fica FORA de RequireRole de propósito: é para cá que o RequireRole manda
                    quem não tem o papel, então precisa abrir para todo mundo — senão vira
                    loop de redirecionamento para `comercial` e `consulta`. */}
                <Route path="/" element={<Home />} />

                {/* Também fora de RequireRole: todo usuário autenticado edita o próprio
                    perfil e a própria foto, independente do papel. */}
                <Route path="/perfil" element={<Perfil />} />

                <Route element={<RequireRole roles={PAPEIS_FINANCEIRO} />}>
                  <Route path="/financeiro/contas-a-receber" element={<ContasReceber />} />
                  <Route path="/financeiro/recebimentos" element={<Recebimentos />} />
                  <Route path="/financeiro/inadimplencia" element={<Inadimplencia />} />
                  <Route path="/financeiro/clientes" element={<Clientes />} />
                  <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixa />} />
                  <Route path="/financeiro/historico" element={<Historico />} />
                  <Route path="/suprimentos/notas-entrada" element={<NotasEntrada />} />
                </Route>

                <Route element={<RequireRole roles={PAPEIS_MERCADO} />}>
                  <Route path="/mercado/pedidos" element={<ListarPedidos />} />
                  <Route path="/mercado/pedido/:codemp/:codfil/:numped" element={<PedidoVisualizacao />} />
                </Route>

                <Route element={<RequireRole roles={["admin"]} />}>
                  <Route path="/admin/usuarios" element={<Usuarios />} />
                  <Route path="/admin/sincronizacao-erp" element={<SincronizacaoErp />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
