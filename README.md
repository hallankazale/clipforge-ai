# ClipForge AI

Aplicativo desktop para transformar vídeos longos em cortes inteligentes prontos para Instagram, TikTok, Reels e YouTube.

## Objetivo

O ClipForge AI recebe um arquivo de vídeo ou link, analisa conteúdo, áudio, fala e mudanças de cena, identifica trechos relevantes e gera cortes configuráveis de 1, 5 ou 10 minutos.

## Princípios do projeto

- Desktop-first para Windows
- Interface moderna e orientada a feedback em tempo real
- Processamento de vídeo desacoplado da interface
- Exportação final preferencialmente para HDD
- IA isolada por contratos para permitir troca de modelo sem quebrar o app
- Segurança por padrão: sem chaves embutidas, validação de entradas e IPC restrito
- Testes unitários, integração e E2E

## Stack

- Electron
- React
- TypeScript
- Vite
- pnpm workspaces
- Vitest
- FFmpeg static 5.3.0
- FFprobe static 3.1.0
- Whisper/ASR via serviço local desacoplado (próxima fase)

## O que já funciona

- Interface inicial baseada nos mockups aprovados
- Escolha de cortes de 1, 5 e 10 minutos
- Seleção de Instagram, TikTok, Reels e YouTube
- Seleção nativa da pasta de destino no Windows
- Seleção nativa de um vídeo local
- Validação de extensões de vídeo suportadas
- Leitura real do arquivo com FFprobe
- Exibição de duração, resolução, FPS, codec e tamanho
- Comunicação segura entre React e Electron via preload/IPC
- Testes unitários do parser de metadados
- Workflow de CI para Windows

## Estrutura

```text
clipforge-ai/
├── apps/
│   └── desktop/
│       ├── electron/
│       │   ├── services/
│       │   │   └── video-engine.ts
│       │   ├── main.ts
│       │   └── preload.ts
│       └── src/
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
FFprobe: metadados
   ↓
FFmpeg: extração de áudio e frames
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

## Rodar no Windows

Requer Node.js 20+.

```powershell
git clone https://github.com/hallankazale/clipforge-ai.git
cd clipforge-ai
npm install -g pnpm@9.15.4
pnpm install
pnpm dev
```

Se o repositório já estiver no computador:

```powershell
cd clipforge-ai
git pull
pnpm install
pnpm dev
```

## Validação

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## Próxima fase

Implementar o pipeline real do botão **Iniciar análise**: fila de processamento, extração de áudio/frames com FFmpeg, progresso em tempo real, transcrição e detecção de cenas.
