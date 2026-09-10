import type { QualityAction, QualityGateResult } from './quality';

export type ProductionDecision =
  | { status: 'approved'; actions: [] }
  | { status: 'retry'; actions: QualityAction[]; nextAttempt: number }
  | { status: 'manual-review'; actions: QualityAction[]; reason: string };

export function decideProductionAfterQualityGate(input: {
  quality: QualityGateResult;
  currentAttempt: number;
  maxRetries: 1 | 2 | 3;
  autoRetry: boolean;
}): ProductionDecision {
  if (input.quality.passed) {
    return { status: 'approved', actions: [] };
  }

  if (!input.autoRetry) {
    return {
      status: 'manual-review',
      actions: input.quality.nextActions,
      reason: 'Regeneração automática desativada pelo usuário.',
    };
  }

  if (input.currentAttempt >= input.maxRetries) {
    return {
      status: 'manual-review',
      actions: input.quality.nextActions,
      reason: `O vídeo continua abaixo da meta após ${input.currentAttempt} tentativa(s).`,
    };
  }

  return {
    status: 'retry',
    actions: input.quality.nextActions,
    nextAttempt: input.currentAttempt + 1,
  };
}

export interface ScheduleSlot {
  dayOffset: number;
  time: string;
}

const timesByDailyVolume: Record<1 | 2 | 3, string[]> = {
  1: ['19:30'],
  2: ['12:30', '20:00'],
  3: ['09:30', '14:00', '20:00'],
};

export function buildSevenDaySchedule(videosPerDay: 1 | 2 | 3): ScheduleSlot[] {
  const times = timesByDailyVolume[videosPerDay];
  return Array.from({ length: 7 }, (_, dayOffset) =>
    times.map((time) => ({ dayOffset, time })),
  ).flat();
}
