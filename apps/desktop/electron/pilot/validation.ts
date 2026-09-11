import path from 'node:path';
import { nichePresets } from './presets';
import type { StartPilotInput, VideoPlan, Word } from './contracts';

export function validateStart(value: StartPilotInput): void {
  const s = value?.settings;
  if (!s || !nichePresets.some(n => n.id === s.nicheId) ||
    ![30, 45, 60].includes(s.durationSeconds) || ![1, 2, 3].includes(s.videosPerDay) ||
    !Number.isInteger(s.minimumQualityScore) || s.minimumQualityScore < 75 || s.minimumQualityScore > 95 ||
    ![1, 2, 3].includes(s.maxRetries) || typeof s.autoRetry !== 'boolean' ||
    !Array.isArray(s.platforms) || !s.platforms.length || s.platforms.length > 2 ||
    new Set(s.platforms).size !== s.platforms.length ||
    s.platforms.some(p => !['TikTok', 'YouTube Shorts'].includes(p))) throw new Error('Configuração do piloto inválida.');
  if (typeof value.outputDirectory !== 'string' || !path.isAbsolute(value.outputDirectory)) throw new Error('Escolha uma pasta de saída.');
  if (![1, 7 * s.videosPerDay].includes(value.count)) throw new Error('Escolha um vídeo ou um lote de sete dias.');
  if (!Number.isFinite(Date.parse(value.scheduledAt)) || Date.parse(value.scheduledAt) <= Date.now()) throw new Error('Escolha um horário futuro.');
  if (!['private', 'unlisted', 'public'].includes(value.privacy) || typeof value.autoPublishYouTube !== 'boolean' || typeof value.madeForKids !== 'boolean') throw new Error('Preferências de publicação inválidas.');
}

export function validatePlan(value: VideoPlan): VideoPlan {
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!value || !text(value.title, 90) || /[<>]/.test(value.title) || !text(value.description, 3000) || !text(value.style, 2000) ||
    !Array.isArray(value.scenes) || value.scenes.length < 4 || value.scenes.length > 12 ||
    value.scenes.some(s => !text(s.narration, 700) || !text(s.visual, 2000)) ||
    !Array.isArray(value.hashtags) || value.hashtags.length > 5 || value.hashtags.some(t => typeof t !== 'string' || !/^#[\p{L}\p{N}_]{1,40}$/u.test(t)) ||
    !Array.isArray(value.sources) || value.sources.length > 10 || value.sources.some(s => typeof s !== 'string' || !/^https:\/\//.test(s) || s.length > 2048) ||
    typeof value.fiction !== 'boolean') throw new Error('A IA retornou um roteiro inválido.');
  return value;
}

export function validateWords(words: Word[]): Word[] {
  if (!Array.isArray(words) || words.length === 0 || words.length > 1000) throw new Error('Transcrição vazia ou excessiva.');
  let previous = 0;
  for (const word of words) {
    if (!word || typeof word.word !== 'string' || !word.word.trim() || word.word.length > 100 ||
      !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < previous - 0.02 || word.end <= word.start) throw new Error('Tempos de legenda inválidos.');
    previous = word.end;
  }
  return words;
}
