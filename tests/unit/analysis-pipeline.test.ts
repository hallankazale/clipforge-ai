import { describe, expect, it } from 'vitest';
import {
  mapStageProgress,
  parseProgressSeconds,
} from '../../apps/desktop/electron/services/analysis-pipeline';

describe('parseProgressSeconds', () => {
  it('converte out_time_us para segundos', () => {
    expect(parseProgressSeconds('out_time_us=12500000')).toBe(12.5);
  });

  it('aceita o campo legado out_time_ms do FFmpeg', () => {
    expect(parseProgressSeconds('out_time_ms=3000000')).toBe(3);
  });

  it('converte timestamp HH:MM:SS', () => {
    expect(parseProgressSeconds('out_time=01:02:03.500000')).toBe(3723.5);
  });

  it('ignora linhas que não representam tempo', () => {
    expect(parseProgressSeconds('progress=continue')).toBeNull();
  });
});

describe('mapStageProgress', () => {
  it('mapeia o progresso para a faixa da etapa', () => {
    expect(mapStageProgress(50, 100, 10, 50)).toBe(30);
  });

  it('limita o progresso ao intervalo configurado', () => {
    expect(mapStageProgress(-10, 100, 10, 50)).toBe(10);
    expect(mapStageProgress(200, 100, 10, 50)).toBe(50);
  });

  it('mantém o início da faixa quando duração é inválida', () => {
    expect(mapStageProgress(10, 0, 55, 94)).toBe(55);
  });
});
