import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { hasDatabase, updateDbUser } from "@/lib/server/db";

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

    // Validar avatar se fornecido (máximo 500KB, base64)
    if (avatar && typeof avatar === "string") {
      if (avatar.length > 500000) {
        return NextResponse.json(
          { error: "Foto muito grande (máximo 500KB)" },
          { status: 400 }
        );
      }
    }

    const cleanName = displayName.trim();
    const cleanAvatar = avatar && typeof avatar === "string" ? avatar.trim() : null;

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
