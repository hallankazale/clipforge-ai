import { describe, expect, it } from 'vitest';
import { evaluateQualityGate } from '../../apps/desktop/electron/pilot/quality';
import { validateStart, validateWords, validatePlan } from '../../apps/desktop/electron/pilot/validation';
import { pkceChallenge } from '../../apps/desktop/electron/pilot/oauth';
import { assertUploadHost } from '../../apps/desktop/electron/pilot/http';
import { buildCaptions, transcriptSimilarity } from '../../apps/desktop/electron/pilot/media';
import { retryComponents, sceneTimings } from '../../apps/desktop/electron/pilot/engine';
import type { StartPilotInput, VideoPlan } from '../../apps/desktop/electron/pilot/contracts';

const metrics = { hook: 99, storytelling: 99, visualConsistency: 99, pacing: 99, voiceClarity: 99, captionReadability: 99, originality: 99, platformFit: 99 };
const input: StartPilotInput = { settings: { nicheId: 'terror-misterio', platforms: ['YouTube Shorts'], durationSeconds: 30, videosPerDay: 1, minimumQualityScore: 82, autoRetry: true, maxRetries: 3 }, outputDirectory: process.cwd(), scheduledAt: '2099-01-01T12:00:00Z', count: 1, autoPublishYouTube: false, privacy: 'private', madeForKids: false };
const plan: VideoPlan = { title: 'Original', description: 'Descrição', hashtags: ['#original'], style: 'Cinemático', fiction: true, sources: [], scenes: Array.from({ length: 4 }, () => ({ narration: 'Uma frase.', visual: 'Uma cena.' })) };
describe('limites de qualidade e entradas externas', () => {
  it('não deixa média alta ocultar formato inválido ou narrativa ausente', () => {
    expect(evaluateQualityGate({ ...metrics, platformFit: 0 }).passed).toBe(false);
    expect(evaluateQualityGate({ ...metrics, storytelling: NaN }).passed).toBe(false);
    expect(() => evaluateQualityGate(metrics, NaN)).toThrow();
  });
  it('rejeita configurações que burlam os limites do formulário', () => {
    expect(() => validateStart(input)).not.toThrow();
    expect(() => validateStart({ ...input, count: 500 })).toThrow();
    expect(() => validateStart({ ...input, scheduledAt: '2000-01-01' })).toThrow();
    expect(() => validateStart({ ...input, settings: { ...input.settings, minimumQualityScore: NaN } })).toThrow();
  });
  it('rejeita tempos fora de ordem e roteiros sem cenas suficientes', () => {
    expect(() => validateWords([{ word: 'a', start: 1, end: 2 }, { word: 'b', start: 0, end: 1 }])).toThrow();
    expect(() => validatePlan({ ...plan, scenes: [] })).toThrow();
  });
  it('escapa comandos ASS vindos da transcrição', () => {
    const ass = buildCaptions([{ word: '{\\pos(0,0)}teste', start: 0, end: 1 }]);
    expect(ass).not.toContain('{\\pos'); expect(ass).toContain('Dialogue:');
  });
  it('mede divergência real entre roteiro e fala', () => {
    expect(transcriptSimilarity('Olá mundo', 'ola, mundo!')).toBe(1);
    expect(transcriptSimilarity('Texto original completo', 'Outra fala')).toBeLessThan(0.5);
  });
  it('invalida voz, legendas e imagens quando o roteiro muda', () => {
    expect(retryComponents(['rewrite-hook'])).toEqual({ script: true, images: true, voice: true, captions: true });
    expect(retryComponents(['regenerate-captions']).voice).toBe(false);
  });
  it('distribui cenas pelas palavras faladas e conserva a duração', () => {
    const durations = sceneTimings(plan, Array.from({ length: 8 }, (_, i) => ({ word: 'palavra', start: i, end: i + 0.8 })), 8);
    expect(durations).toEqual([2, 2, 2, 2]);
  });
  it('respeita as codificações PKCE distintas do Google e TikTok', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(pkceChallenge(verifier, 'youtube')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(pkceChallenge(verifier, 'tiktok')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('bloqueia redirecionamento de upload para host arbitrário', () => {
    expect(() => assertUploadHost('https://www.googleapis.com/upload', ['www.googleapis.com'])).not.toThrow();
    for (const url of ['http://www.googleapis.com/upload', 'https://www.googleapis.com.evil.test/upload', 'https://user:pass@www.googleapis.com/upload']) expect(() => assertUploadHost(url, ['www.googleapis.com'])).toThrow();
  });
});
