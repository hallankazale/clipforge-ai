# ClipForge AI

Aplicativo desktop para Windows que transforma vídeos longos em cortes preparados para Instagram, TikTok, Reels e YouTube.

## Estado atual

O ClipForge já processa arquivos locais de verdade com FFmpeg/FFprobe, cria cortes de 1, 5 ou 10 minutos, adapta o formato por plataforma, salva tudo no HDD escolhido e gera um pacote de publicação para cada corte.

A compreensão semântica do que foi falado e as legendas automáticas ainda dependem do próximo módulo local de transcrição. O produto não inventa uma transcrição quando ela não existe.

## Princípios

- Desktop-first para Windows
- Interface moderna com feedback em tempo real
- Processamento desacoplado da interface
- Arquivos pesados e vídeos finais no HDD escolhido
- Segurança por padrão: preload/IPC restrito, Node isolado da UI e processos externos sem shell
- IA/transcrição desacopladas para permitir trocar o modelo sem quebrar o aplicativo
- Testes unitários e CI para Windows

## Stack

- Electron
- React
- TypeScript
- Vite
- pnpm workspaces
- Vitest
- FFmpeg static 5.3.0
- FFprobe static 3.1.0
- electron-builder + NSIS para o instalador Windows
- Whisper/ASR local: próxima camada

## O que já funciona

- Seleção nativa de vídeo no Windows
- FFprobe: duração, resolução, FPS, codecs e tamanho
- Cortes de 1, 5 e 10 minutos
- Instagram, TikTok, Reels e YouTube
- Ranking local por atividade de áudio e variação visual
- Redução de sobreposição entre cortes sugeridos
- TikTok/Reels/Instagram em 1080x1920
- Fundo desfocado para adaptar vídeo horizontal ao formato vertical
- YouTube em 1920x1080
- Normalização de áudio para publicação
- Renderização MP4 real com FFmpeg
- Barra de progresso e log em tempo real
- Cancelamento de processamento
- Pasta final no HDD escolhido
- Botão para abrir a pasta dos vídeos
- Nota de potencial viral de 0 a 100
- Título e descrição com emojis
- Até 5 hashtags por pacote, inclusive TikTok
- Arquivos `.json` e `.txt` de publicação ao lado de cada vídeo
- Botão para copiar título + descrição + hashtags
- Instalador Windows `.exe` gerado automaticamente pelo GitHub Actions

## Estrutura de saída

```text
<PASTA_ESCOLHIDA>\Cortes\<nome-do-video>\<JOB_ID>\
├── tiktok\
│   ├── corte-01.mp4
│   ├── corte-01-publicacao.json
│   └── corte-01-publicacao.txt
├── reels\
├── instagram\
└── youtube\
```

Exemplo do pacote de publicação:

```text
NOTA VIRAL: 88/100 — Muito alto

TÍTULO
🔥 Corte #1 — momento com forte potencial de retenção

DESCRIÇÃO
🔥 Um dos momentos mais fortes deste vídeo.
📊 Potencial de viralização: 88/100.
👀 Assista até o final e conte o que achou.

#paravoce #tiktokbrasil #viral #cortes #video
```

A nota é uma estimativa local baseada nos sinais que o sistema consegue medir. Ela não garante viralização.

## Pipeline atual

```text
Arquivo local
   ↓
FFprobe
   ↓
Áudio + frames no HDD
   ↓
Detecção de silêncio / atividade
   ↓
Variação visual
   ↓
Ranking dos trechos
   ↓
Cortes de 1 / 5 / 10 min
   ↓
Adaptação por plataforma + normalização de áudio
   ↓
MP4 final
   ↓
Nota viral + título + descrição + hashtags
```

## Rodar para desenvolvimento

Requer Node.js 20+.

```powershell
git clone https://github.com/hallankazale/clipforge-ai.git
cd clipforge-ai
npm.cmd install -g pnpm@9.15.4
pnpm.cmd install
pnpm.cmd dev
```

Atualizar uma cópia existente:

```powershell
cd clipforge-ai
git pull
pnpm.cmd install
pnpm.cmd dev
```

## Gerar o instalador localmente

```powershell
pnpm.cmd install
pnpm.cmd dist:win
```

O instalador é gerado em:

```text
apps\desktop\release\ClipForge-AI-Setup-0.4.0.exe
```

## Validação

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

## Próxima camada

Adicionar transcrição local para que o ClipForge possa:

- entender o assunto de cada trecho;
- gerar títulos ligados ao conteúdo real;
- criar descrições específicas;
- gerar hashtags específicas ao nicho;
- produzir legendas sincronizadas e opcionais para queimar no vídeo;
- melhorar a nota de potencial viral usando gancho inicial, densidade de fala e conteúdo semântico.
