// ── V1 audio flags (preservados) ──────────────────────────────────────────
export function isAudioInputEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUDIO_INPUT !== 'false';
}

export function isAudioOutputEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUDIO_OUTPUT !== 'false';
}

export function isAudioTranscriptionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUDIO_TRANSCRIPTION !== 'false';
}

export function isAudioReplyTtsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUDIO_REPLY_TTS !== 'false';
}

// ── V2 Realtime flags ─────────────────────────────────────────────────────
/**
 * Habilita o modo V2 de voz via OpenAI Realtime API (WebRTC).
 * Quando false, somente a V1 (record → transcription → chat → TTS) está disponível.
 */
export function isRealtimeVoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_REALTIME_VOICE === 'true';
}

/**
 * Se a sessão Realtime falhar, cai automaticamente para a V1.
 * Desative apenas para testes isolados do Realtime.
 */
export function isRealtimeFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REALTIME_FALLBACK_TO_V1 !== 'false';
}
