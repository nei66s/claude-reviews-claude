import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client && apiKey) {
    client = new OpenAI({ apiKey });
  }
  return client!;
}

export async function callOpenAI(
  prompt: string,
  temperature: number = 0.7,
): Promise<string> {
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not configured, skipping OpenAI analysis");
    return "";
  }

  try {
    const openai = getClient();
    
    const message = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      temperature,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.choices[0]?.message?.content;
    if (content && typeof content === "string") {
      return content;
    }

    return "";
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw error;
  }
}

/**
 * Chamada simples para análise de texto
 */
export async function analyzeText(text: string): Promise<string> {
  const prompt = `Você é um assistente analítico. Analise o seguinte texto e forneça insights:

"${text}"

Retorne uma análise concisa em português.`;

  return callOpenAI(prompt, 0.5);
}
