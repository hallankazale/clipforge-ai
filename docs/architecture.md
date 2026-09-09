# Arquitetura — ClipForge AI

## Objetivo

Manter interface, regras de negócio, processamento pesado, IA e acesso a disco desacoplados.

## Camadas

### `apps/desktop`
Electron + React. Responsável por janela, navegação e experiência do usuário.

O renderer nunca recebe acesso irrestrito ao Node. Toda operação privilegiada passa por uma API pequena exposta pelo `preload` e IPC validado.

### `packages/core`
Entidades e casos de uso: projeto, fonte, corte, duração, plataforma, job e status.

### `packages/video-engine`
Abstração do FFmpeg/FFprobe. Responsável por metadados, extração de áudio/frames, corte, crop/reframe e encode.

### `packages/ai`
Contratos para transcrição, análise semântica, detecção/ranking de momentos e geração de título/descrição.

### `packages/storage`
Política de cache, diretórios temporários, destino final e detecção de espaço disponível. Arquivos finais devem poder apontar explicitamente para HDD.

### `packages/ui`
Componentes reutilizáveis e design tokens.

## Pipeline

1. Usuário escolhe arquivo local ou link.
2. Origem é validada.
3. Vídeo é materializado localmente quando necessário.
4. FFprobe extrai metadados.
5. Engine extrai áudio e amostras de frames.
6. ASR gera transcrição com timestamps.
7. Detector de cenas cria segmentos candidatos.
8. IA pontua relevância semântica e potencial de retenção.
9. Um agregador monta janelas de 1, 5 ou 10 minutos sem cortar frases de forma abrupta quando possível.
10. Usuário revisa os cortes sugeridos.
11. Preset de plataforma aplica orientação, resolução, legendas e bitrate.
12. FFmpeg exporta os arquivos finais diretamente para o diretório escolhido.

## Segurança

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC com allowlist de operações
- Não executar comandos de shell montados com entrada do usuário
- FFmpeg deve receber argumentos estruturados via `spawn`, nunca string concatenada
- URLs devem ser validadas por protocolo e domínio conforme a integração
- Chaves/API tokens somente em configuração local segura; nunca commitadas
- Limites de tamanho, duração e espaço livre antes de iniciar processamento

## Performance

- Processamento pesado fora do renderer
- Jobs canceláveis
- Atualizações de progresso por eventos, não polling agressivo
- Geração de proxy/thumbnail para preview quando necessário
- Cache com política de limpeza automática
- Exportação final preferencialmente para HDD configurado pelo usuário

## Distribuição

A etapa de empacotamento usará `electron-builder` para gerar instalador Windows (`.exe`). O binário do FFmpeg e eventuais modelos locais deverão ser empacotados/baixados de maneira versionada e verificável.
