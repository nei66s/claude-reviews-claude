import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { hasDatabase, updateDbUser } from "@/lib/server/db";

const AVATAR_MAX_BYTES = 500 * 1024;

function getBase64ImageByteSize(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return Buffer.byteLength(base64Payload, "base64");
}

export async function PUT(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName, avatar } = body;

    // Validações
    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    const cleanName = displayName.trim();
    const cleanAvatar = avatar && typeof avatar === "string" ? avatar.trim() : null;

    // Validar avatar se fornecido (máximo 500KB em bytes reais da imagem)
    if (cleanAvatar && cleanAvatar.startsWith("data:")) {
      if (!cleanAvatar.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Arquivo deve ser uma imagem" },
          { status: 400 }
        );
      }

      if (getBase64ImageByteSize(cleanAvatar) > AVATAR_MAX_BYTES) {
        return NextResponse.json(
          { error: "Foto muito grande (máximo 500KB)" },
          { status: 400 }
        );
      }
    }

    // Se houver banco de dados, atualizar lá também
    let updatedDbUser = null;
    if (hasDatabase()) {
      try {
        updatedDbUser = await updateDbUser(user.id, cleanName, cleanAvatar);
      } catch (dbError) {
        console.error("Erro ao atualizar BD:", dbError);
        // Continua mesmo com erro de BD, retorna o usuário em memória
      }
    }

    // Retornar usuário atualizado
    const updatedUser = {
      ...user,
      displayName: cleanName,
      avatar: cleanAvatar,
    };

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Perfil atualizado com sucesso",
      persistedInDb: !!updatedDbUser,
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 }
    );
  }
}
