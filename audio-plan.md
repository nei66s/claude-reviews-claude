# Plano de Integração de Áudio (V1)

## Arquitetura Final da V1
A integração de voz será estritamente de Interface (I/O), mantendo o **Memory Orchestrator** intacto e evitando arquiteturas paralelas de agentes em Realtime nesta primeira versão. 

1. **Write Path (Input de Áudio)**:
   - O usuário clica num botão (Microfone) adicionado ao Composer (`AppShell` e `WelcomeScreen`).
   - A captura é feita em lote reduzido via `MediaRecorder` no modo frontend.
   - Ao finalizar a fala, o arquivo/blob é enviado via `POST` para nossa nova rota `/api/audio/transcription`.
   - O backend se conecta à API `whisper-1` da OpenAI, obtém a transcrição, loga a persistência da interação por áudio, e devolve o texto ao frontend.
   - O frontend injeta esse texto `no próprio chat atual` como se o usuário tivesse digitado e apertado enter, disparando o fluxo padrão com memória e extração nativa que já existe no `useChat`. O Memory Orchestrator continuará agindo somente sobre o texto final.

2. **Read Path (Output de Áudio / TTS)**:
   - Após o Assistente responder o texto em streaming até o fim, verificamos a *feature flag* de TTS.
   - O frontend encaminha o trecho de texto final para `/api/audio/speech`.
   - A API backend retransmite a chamada para a OpenAI (`tts-1`), devolvendo um buffer stream do MP3 de saída com rastreamentos de logs para auditoria de falhas.
   - Nós usamos o objeto `new Audio()` para tocar essa voz no final, com UI indicativa de "Tocando áudio...".

## Pontos de Integração e Arquivos Mapeados

- `app/lib/audio-flags.ts`: Feature flags (`NEXT_PUBLIC_ENABLE_AUDIO_INPUT`, `NEXT_PUBLIC_ENABLE_AUDIO_REPLY_TTS`).
- `app/api/audio/transcription/route.ts`: Rota para processar WebM com Whisper.
- `app/api/audio/speech/route.ts`: Rota para TTS (Text-to-Speech).
- `app/hooks/useAudioRecord.ts`: Custom hook no frontend responsável por pedir permissão e gerir MediaRecorder.
- `app/components/AppShell.tsx` e `app/components/WelcomeScreen.tsx`: Inserir botão de mic, estado visual e cancelamento.
- `app/hooks/useChat.ts` ou componentes afins: Conectar o pipeline de quando finaliza o "streaming" textual para começar a falar o áudio se configurado na flag e via microfone.

## Fallbacks e Decisões de API
- **Fallbacks**: 
  - Erro 403 / Permissão de mic: Botão muda para erro visível (texto: "Mic bloqueado").
  - Falha de transcrição: Exibe toast/barra vermelha e força fallback para teclado.
  - Rede Lenta: Interface clara de "Processando Áudio..." e bloqueia o botão de send.
- **Tipagem Forte e Logs**: Preservaremos dados e sessões usando o logger de persistência recém verificado (`appendLog` no backend).
- **Decisão Técnica**: Por mais fluida que seja a web socket (Responses API), a estabilidade desta V1 depende de ser 1-turn sync request para simplificar o path atual do modelo principal `gpt-4o`.
