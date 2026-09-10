import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CutPlatform, SmartCutCandidate } from './smart-cut-engine';

export type ViralLabel = 'Baixo' | 'Médio' | 'Alto' | 'Muito alto';

export interface PublicationPackage {
  viralScore: number;
  viralLabel: ViralLabel;
  title: string;
  description: string;
  hashtags: string[];
  metadataFilePath: string;
  textFilePath: string;
  captionsStatus: 'pending-local-transcription';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function labelForScore(score: number): ViralLabel {
  if (score >= 86) return 'Muito alto';
  if (score >= 72) return 'Alto';
  if (score >= 55) return 'Médio';
  return 'Baixo';
}

export function calculateViralScore(candidate: SmartCutCandidate, platform: CutPlatform): number {
  const baseSignal = clamp(candidate.score, 0, 1);
  const audio = clamp(candidate.audioActivity, 0, 1);
  const visual = clamp(candidate.visualActivity, 0, 1);
  const verticalBonus = platform === 'TikTok' || platform === 'Reels' || platform === 'Instagram' ? 3 : 0;

  return Math.round(clamp(35 + baseSignal * 45 + audio * 12 + visual * 5 + verticalBonus, 0, 100));
}

function hashtagsForPlatform(platform: CutPlatform): string[] {
  switch (platform) {
    case 'TikTok':
      // TikTok: produto exige no máximo cinco hashtags por pacote.
      return ['#paravoce', '#tiktokbrasil', '#viral', '#cortes', '#video'];
    case 'Reels':
      return ['#reelsbrasil', '#reels', '#cortes', '#video', '#conteudo'];
    case 'Instagram':
      return ['#instagrambrasil', '#video', '#cortes', '#conteudo', '#criadores'];
    case 'YouTube':
      return ['#youtube', '#video', '#cortes', '#conteudo', '#brasil'];
  }
}

function titleForScore(rank: number, score: number): string {
  if (score >= 86) return `🔥 Corte #${rank} — momento com forte potencial de retenção`;
  if (score >= 72) return `🚀 Corte #${rank} — trecho de alto engajamento`;
  if (score >= 55) return `✨ Corte #${rank} — trecho recomendado`;
  return `🎬 Corte #${rank} — momento selecionado`;
}

function descriptionForScore(score: number, hashtags: string[]): string {
  const hook = score >= 86
    ? '🔥 Um dos momentos mais fortes deste vídeo.'
    : score >= 72
      ? '🚀 Trecho selecionado por sinais de boa retenção.'
      : '✨ Trecho selecionado automaticamente pelo ClipForge.';

  return [
    hook,
    `📊 Potencial de viralização: ${score}/100.`,
    '👀 Assista até o final e conte o que achou.',
    '',
    hashtags.join(' '),
  ].join('\n');
}

export async function createPublicationPackage(input: {
  candidate: SmartCutCandidate;
  rank: number;
  platform: CutPlatform;
  videoFilePath: string;
}): Promise<PublicationPackage> {
  const viralScore = calculateViralScore(input.candidate, input.platform);
  const hashtags = hashtagsForPlatform(input.platform).slice(0, 5);
  const title = titleForScore(input.rank, viralScore);
  const description = descriptionForScore(viralScore, hashtags);
  const basePath = input.videoFilePath.replace(/\.mp4$/i, '');
  const metadataFilePath = `${basePath}-publicacao.json`;
  const textFilePath = `${basePath}-publicacao.txt`;

  const payload = {
    viralScore,
    viralLabel: labelForScore(viralScore),
    title,
    description,
    hashtags,
    captionsStatus: 'pending-local-transcription' as const,
    note: 'Título e descrição atuais usam sinais locais de retenção. Conteúdo semântico e legendas serão enriquecidos pelo módulo local de transcrição.',
    videoFilePath: path.resolve(input.videoFilePath),
  };

  await Promise.all([
    writeFile(metadataFilePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    writeFile(
      textFilePath,
      [
        `NOTA VIRAL: ${viralScore}/100 — ${payload.viralLabel}`,
        '',
        'TÍTULO',
        title,
        '',
        'DESCRIÇÃO',
        description,
        '',
        'LEGENDAS',
        'Aguardando módulo local de transcrição para gerar legendas fiéis ao áudio.',
      ].join('\n'),
      'utf8',
    ),
  ]);

  return {
    viralScore,
    viralLabel: payload.viralLabel,
    title,
    description,
    hashtags,
    metadataFilePath,
    textFilePath,
    captionsStatus: payload.captionsStatus,
  };
}
