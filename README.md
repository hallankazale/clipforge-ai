# ClipForge AI

Aplicativo desktop para transformar vídeos longos em cortes inteligentes prontos para Instagram, TikTok, Reels e YouTube.

## Objetivo

O ClipForge AI recebe um arquivo de vídeo ou link, analisa conteúdo, áudio, fala e mudanças de cena, identifica trechos relevantes e gera cortes configuráveis de 1, 5 ou 10 minutos.

## Princípios do projeto

- Desktop-first para Windows
- Interface moderna, responsiva e orientada a feedback em tempo real
- Processamento de vídeo desacoplado da interface
- Exportação final preferencialmente para HDD
- IA isolada por contratos para permitir troca de modelo sem quebrar o app
- Segurança por padrão: sem chaves embutidas no código, validação de entradas e IPC restrito
- Testes unitários, integração e E2E

## Stack inicial

- Electron
- React
- TypeScript
- Vite
- pnpm workspaces
- Vitest
- FFmpeg (engine de vídeo, próxima etapa)
- Whisper/ASR via serviço local desacoplado (próxima etapa)

## Estrutura

```text
clipforge-ai/
├── apps/
│   └── desktop/
├── packages/
│   ├── core/
│   ├── ui/
│   ├── video-engine/
│   ├── ai/
│   ├── storage/
│   └── shared/
├── docs/
├── tests/
└── scripts/
```

## Fluxo principal

```text
Arquivo ou link
   ↓
Validação da origem
   ↓
Leitura de metadados
   ↓
Extração de áudio e frames
   ↓
Transcrição + análise de cenas
   ↓
Ranking de momentos relevantes
   ↓
Cortes de 1 / 5 / 10 minutos
   ↓
Revisão pelo usuário
   ↓
Preset Instagram / TikTok / Reels / YouTube
   ↓
Exportação para HDD
```

## Desenvolvimento

Requer Node.js 20+ e pnpm 9+.

```bash
pnpm install
pnpm dev
```

## Status

Fundação arquitetural em implementação. A primeira tela funcional seguirá os mockups aprovados do ClipForge AI.
