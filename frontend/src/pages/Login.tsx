import axios from "axios";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      // O AuthContext guarda o que já veio autenticado — quem fala com /auth/login é a
      // tela, como no CaxHub.
      const { data } = await axios.post("/api/auth/login", { email, password: senha });
      login(data.token, data.user);
    } catch (err: any) {
      setErro(err.response?.data?.error ?? "Falha ao entrar");
    } finally {
      setEntrando(false);
    }
  }

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">CaxHub</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground">Hedel</h1>
        <p className="mt-1 text-sm text-muted">Espelho da base do Senior.</p>

        <label className="mt-5 block text-[12.5px] font-medium text-muted">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="mt-3 block text-[12.5px] font-medium text-muted">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {erro && <p className="mt-3 text-[12.5px] text-destructive">{erro}</p>}

        <button
          type="submit"
          disabled={entrando}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
