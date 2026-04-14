"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { requestJson } from "../lib/api";

interface ProfileData {
  displayName: string;
  email: string;
  avatar?: string;
}

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
  width: "min(560px, 100%)",
  padding: "40px",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(24,24,27,0.96), rgba(17,24,39,0.94))",
  boxShadow: "0 32px 80px rgba(0,0,0,0.42)",
  backdropFilter: "blur(18px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
  marginBottom: "32px",
  paddingBottom: "24px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const avatarStyle: React.CSSProperties = {
  width: "80px",
  height: "80px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #10b981, #059669)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "32px",
  fontWeight: "700",
  color: "white",
  flexShrink: 0,
  boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)",
};

const avatarContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "80px",
  height: "80px",
  cursor: "pointer",
};

const avatarOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "24px",
  opacity: 0,
  transition: "opacity 0.2s ease",
};

const userInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const userName: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "600",
  color: "#fafafa",
};

const userEmail: React.CSSProperties = {
  fontSize: "13px",
  color: "rgba(255,255,255,0.6)",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: "rgba(255,255,255,0.7)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.2)",
  color: "#fafafa",
  fontSize: "14px",
  transition: "all 0.2s ease",
  boxSizing: "border-box",
};

const buttonsStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "24px",
};

const buttonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 20px",
  borderRadius: "10px",
  border: "none",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, #10b981, #059669)",
  color: "white",
  boxShadow: "0 8px 16px rgba(16,185,129,0.3)",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fafafa",
};

const backButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "24px",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.6)",
  cursor: "pointer",
  fontSize: "14px",
  transition: "all 0.2s ease",
};

const statusMessageStyle: (type: "success" | "error") => React.CSSProperties = (type) => ({
  padding: "12px 14px",
  borderRadius: "8px",
  fontSize: "13px",
  marginBottom: "16px",
  backgroundColor: type === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
  color: type === "success" ? "#86efac" : "#fca5a5",
  border: `1px solid ${type === "success" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
});

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    email: "",
    avatar: undefined,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      setProfile({
        displayName: user.displayName || "",
        email: user.email || "",
        avatar: user.avatar || undefined,
      });
    }
  }, [user, isLoading, router]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máximo 500KB)
    if (file.size > 500000) {
      setMessage({ type: "error", text: "Foto muito grande (máximo 500KB)" });
      return;
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Arquivo deve ser uma imagem" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setProfile((prev) => ({
        ...prev,
        avatar: base64,
      }));
      setMessage(null);

      // Fazer upload imediato
      await uploadAvatar(base64);
    };
    reader.onerror = () => {
      setMessage({ type: "error", text: "Erro ao ler arquivo" });
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (base64: string) => {
    setIsSaving(true);

    try {
      const response = await requestJson("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: profile.displayName,
          avatar: base64,
        }),
      });

      if (response?.user) {
        setMessage({ type: "success", text: "Foto atualizada com sucesso!" });
        localStorage.setItem("chocks_user", JSON.stringify(response.user));
        
        // Reload após 1.5s para refletir mudanças
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao atualizar foto",
      });
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!profile.displayName.trim()) {
      setMessage({ type: "error", text: "Nome é obrigatório" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await requestJson("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: profile.displayName,
          avatar: profile.avatar || null,
        }),
      });

      if (response?.user) {
        setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
        // Update localStorage
        localStorage.setItem("chocks_user", JSON.stringify(response.user));
        // Reload page after 1 second to reflect changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao atualizar perfil",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setProfile({
        displayName: user.displayName || "",
        email: user.email || "",
        avatar: user.avatar || undefined,
      });
    }
    router.back();
  };

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <button style={backButtonStyle} onClick={() => router.back()}>
          <span>←</span>
          <span>Voltar</span>
        </button>

        <div style={headerStyle}>
          <div
            style={avatarContainerStyle}
            onMouseEnter={(e) => {
              const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              const overlay = e.currentTarget.querySelector('.avatar-overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = "0";
            }}
            onClick={() => {
              const fileInput = document.getElementById('avatar-input') as HTMLInputElement;
              fileInput?.click();
            }}
          >
            <div style={{
              ...avatarStyle,
              backgroundImage: profile.avatar && profile.avatar.startsWith("data:") ? `url(${profile.avatar})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: profile.avatar ? "transparent" : undefined,
            }}>
              {!profile.avatar || !profile.avatar.startsWith("data:") ? getInitials(profile.displayName) : ""}
            </div>
            <div
              className="avatar-overlay"
              style={avatarOverlayStyle}
            >
              📷
            </div>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
              disabled={isSaving}
            />
          </div>
          <div style={userInfoStyle}>
            <div style={userName}>{profile.displayName || "Usuário"}</div>
            <div style={userEmail}>{profile.email}</div>
          </div>
        </div>

        {message && <div style={statusMessageStyle(message.type)}>{message.text}</div>}

        <div style={formStyle}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              name="displayName"
              value={profile.displayName}
              onChange={handleInputChange}
              placeholder="Seu nome"
              style={inputStyle}
              disabled={isSaving}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleInputChange}
              placeholder="seu@email.com"
              style={inputStyle}
              disabled={true}
            />
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
              Email não pode ser alterado. Entre em contato com suporte se precisar mudar.
            </div>
          </div>

          <div style={buttonsStyle}>
            <button
              style={secondaryButtonStyle}
              onClick={handleCancel}
              disabled={isSaving}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
            >
              Cancelar
            </button>
            <button
              style={primaryButtonStyle}
              onClick={handleSave}
              disabled={isSaving}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(16,185,129,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 16px rgba(16,185,129,0.3)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
