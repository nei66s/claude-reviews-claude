"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.16), transparent 28%), radial-gradient(circle at 85% 18%, rgba(244,63,94,0.14), transparent 26%), linear-gradient(180deg, #09090b 0%, #111827 100%)",
  color: "#fafafa",
};

const cardStyle: React.CSSProperties = {
  width: "min(460px, 100%)",
  padding: "32px",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(24,24,27,0.96), rgba(17,24,39,0.94))",
  boxShadow: "0 32px 80px rgba(0,0,0,0.42)",
  backdropFilter: "blur(18px)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#fafafa",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#e4e4e7",
};

const fieldStyle: React.CSSProperties = {
  marginBottom: "18px",
};

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
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "22px", fontSize: "24px", fontWeight: 700 }}>
          <span style={{ color: "#10b981", fontSize: "28px" }}>*</span>
          <span>Chocks</span>
        </div>

        <h1 style={{ margin: 0, fontSize: "34px", lineHeight: 1, letterSpacing: "-0.04em" }}>Bem-vindo de volta</h1>
        <p style={{ margin: "14px 0 26px", color: "#a1a1aa", lineHeight: 1.6 }}>
          Entre com sua conta admin para continuar.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle}>Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          {error ? (
            <div
              style={{
                marginBottom: "18px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.24)",
                color: "#fecaca",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              minHeight: "50px",
              border: 0,
              borderRadius: "14px",
              background: "linear-gradient(135deg, #10b981, #34d399)",
              color: "#04130e",
              fontWeight: 700,
              fontSize: "15px",
              cursor: isSubmitting ? "wait" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div
          style={{
            marginTop: "22px",
            paddingTop: "18px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            color: "#71717a",
            fontSize: "12px",
          }}
        >
          Use as credenciais configuradas no ambiente do servidor.
        </div>
      </div>
    </div>
  );
}
