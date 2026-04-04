"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="spark">*</span> Chocks
        </div>
        <h1>Bem-vindo de volta</h1>
        <p>Entre com sua conta admin para continuar.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className={`login-button ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="login-footer">
          <p>Use as credenciais configuradas no ambiente do servidor.</p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #09090b;
          color: #fafafa;
          font-family: var(--font-inter);
          background-image:
            radial-gradient(circle at 20% 30%, rgba(120, 119, 198, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.1) 0%, transparent 40%);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 2.5rem;
          background: rgba(24, 24, 27, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-logo {
          font-weight: 700;
          font-size: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .spark {
          color: #3b82f6;
          font-size: 1.8rem;
        }

        h1 {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          letter-spacing: -0.025em;
        }

        p {
          color: #a1a1aa;
          font-size: 0.95rem;
          margin-bottom: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: #e4e4e7;
        }

        input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 0.75rem;
          color: white;
          font-size: 0.95rem;
          transition: all 0.2s;
          outline: none;
        }

        input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .login-error {
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 0.75rem;
          color: #ef4444;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        .login-button {
          width: 100%;
          padding: 0.75rem;
          background: #fafafa;
          color: #09090b;
          border: none;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .login-button:hover {
          background: #e4e4e7;
          transform: translateY(-1px);
        }

        .login-button:active {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          margin-top: 2rem;
          text-align: center;
          border-top: 1px solid #27272a;
          padding-top: 1.5rem;
        }

        .login-footer p {
          font-size: 0.75rem;
          color: #52525b;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
