import { readFile } from 'node:fs/promises';
import type { QualityAction } from '../core/quality';
import type { PilotProductionSettings } from './pilot-queue-types';

const API_BASE = 'https://api.openai.com/v1';

export interface PilotScene {
  caption: string;
  visualPrompt: string;
  durationSeconds: number;
}

export interface PilotContentPlan {
  title: string;
  description: string;
  hashtags: string[];
  hook: string;
  script: string;
  scenes: PilotScene[];
}

export interface CreativeQualityScores {
  hook: number;
  storytelling: number;
  visualConsistency: number;
  originality: number;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('PILOT_CANCELED');
}

async function requestJson<T>(
  apiKey: string,
  endpoint: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  assertNotAborted(signal);
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

function extractResponseText(payload: unknown): string {
  const root = payload as {
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  for (const item of root.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('A OpenAI não retornou texto estruturado para o plano.');
}

const planSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'hashtags', 'hook', 'script', 'scenes'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    hashtags: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
    hook: { type: 'string' },
    script: { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 5,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['caption', 'visualPrompt', 'durationSeconds'],
        properties: {
          caption: { type: 'string' },
          visualPrompt: { type: 'string' },
          durationSeconds: { type: 'number', minimum: 2, maximum: 15 },
        },
      },
    },
  },
};

export async function generatePilotContentPlan(input: {
  apiKey: string;
  settings: PilotProductionSettings;
  previousPlan?: PilotContentPlan;
  correctiveActions?: QualityAction[];
  signal?: AbortSignal;
}): Promise<PilotContentPlan> {
  const correction = input.correctiveActions?.length
    ? `Corrija especificamente: ${input.correctiveActions.join(', ')}.`
    : 'Crie um conceito original e evergreen.';
  const previous = input.previousPlan
    ? `Plano anterior para referência: ${JSON.stringify(input.previousPlan).slice(0, 6000)}`
    : '';

  const payload = await requestJson<unknown>(input.apiKey, '/responses', {
    model: 'gpt-5.6-luna',
    store: false,
    max_output_tokens: 3500,
    instructions:
      'Você é o roteirista sênior do ClipForge AI. Escreva em português do Brasil, sem clickbait enganoso, sem inventar fatos atuais e sem copiar obras protegidas. O vídeo deve começar forte nos primeiros 2 segundos e manter alta densidade de informação.',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Nicho: ${input.settings.niche.label}\nPúblico: ${input.settings.niche.audience}\nTom: ${input.settings.niche.tone}\nVisual: ${input.settings.niche.visualStyle}\nPilares: ${input.settings.niche.contentPillars.join(', ')}\nDuração alvo: ${input.settings.durationSeconds}s\n${correction}\n${previous}\nCrie título, descrição, 3 a 5 hashtags, hook, roteiro narrado e storyboard de 5 a 10 cenas. As durações das cenas devem somar aproximadamente a duração alvo.`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'clipforge_pilot_plan',
        strict: true,
        schema: planSchema,
      },
    },
  }, input.signal);

  const parsed = JSON.parse(extractResponseText(payload)) as PilotContentPlan;
  if (!parsed.script || !Array.isArray(parsed.scenes) || parsed.scenes.length < 5) {
    throw new Error('Plano de conteúdo incompleto retornado pela IA.');
  }
  parsed.hashtags = parsed.hashtags.slice(0, 5).map((tag) => tag.startsWith('#') ? tag : `#${tag}`);
  return parsed;
}

export async function generatePilotSceneImage(input: {
  apiKey: string;
  prompt: string;
  visualStyle: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const payload = await requestJson<{
    data?: Array<{ b64_json?: string; url?: string }>;
  }>(input.apiKey, '/images/generations', {
    model: 'gpt-image-2.5-flare',
    prompt: `${input.prompt}\nEstilo visual consistente: ${input.visualStyle}. Composição vertical cinematográfica, sem texto escrito na imagem, apropriada para vídeo curto.`,
    size: '1024x1536',
    quality: 'medium',
    output_format: 'png',
    n: 1,
  }, input.signal);

  const image = payload.data?.[0];
  if (image?.b64_json) return Buffer.from(image.b64_json, 'base64');
  if (image?.url) {
    const response = await fetch(image.url, { signal: input.signal });
    if (!response.ok) throw new Error('Falha ao baixar a imagem gerada.');
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error('A API de imagem não retornou conteúdo utilizável.');
}

export async function generatePilotNarration(input: {
  apiKey: string;
  text: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  assertNotAborted(input.signal);
  const response = await fetch(`${API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: input.text,
      instructions: 'Narre em português brasileiro natural, confiante e envolvente, sem pressa e sem teatralidade excessiva.',
      response_format: 'mp3',
    }),
    signal: input.signal,
  });
  if (!response.ok) throw new Error(`Falha na narração (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function transcribePilotNarration(input: {
  apiKey: string;
  audioPath: string;
  signal?: AbortSignal;
}): Promise<string> {
  assertNotAborted(input.signal);
  const audio = await readFile(input.audioPath);
  const form = new FormData();
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'narration.mp3');
  const response = await fetch(`${API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
    signal: input.signal,
  });
  if (!response.ok) throw new Error(`Falha ao validar a voz (${response.status}).`);
  const payload = await response.json() as { text?: string };
  return payload.text ?? '';
}

export async function evaluatePilotCreativeQuality(input: {
  apiKey: string;
  plan: PilotContentPlan;
  imagePaths: string[];
  signal?: AbortSignal;
}): Promise<CreativeQualityScores> {
  const images = await Promise.all(input.imagePaths.slice(0, 3).map(async (imagePath) => {
    const bytes = await readFile(imagePath);
    return { type: 'input_image', image_url: `data:image/png;base64,${bytes.toString('base64')}`, detail: 'low' };
  }));

  const payload = await requestJson<unknown>(input.apiKey, '/responses', {
    model: 'gpt-5.6-luna',
    store: false,
    max_output_tokens: 700,
    instructions: 'Avalie de 0 a 100 com rigor editorial. Não premie conteúdo genérico. Considere o hook, progressão do roteiro, consistência entre imagens e originalidade do conceito.',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: `Plano: ${JSON.stringify(input.plan)}` },
        ...images,
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'clipforge_quality',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['hook', 'storytelling', 'visualConsistency', 'originality'],
          properties: {
            hook: { type: 'number', minimum: 0, maximum: 100 },
            storytelling: { type: 'number', minimum: 0, maximum: 100 },
            visualConsistency: { type: 'number', minimum: 0, maximum: 100 },
            originality: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  }, input.signal);
  return JSON.parse(extractResponseText(payload)) as CreativeQualityScores;
}
