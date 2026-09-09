# Estratégia de Testes — ClipForge AI

## Unitários

- Validação de duração de cortes (1, 5, 10 min)
- Seleção de presets por plataforma
- Regras de nomenclatura de arquivos
- Validação de URLs
- Cálculo de espaço necessário
- Ranking/agregação de segmentos da IA

## Integração

- FFprobe → leitura de metadados
- FFmpeg → corte de um fixture pequeno
- Transcrição → timestamps coerentes
- Pipeline → progresso e cancelamento
- Armazenamento → gravação no diretório selecionado

## E2E

1. Abrir aplicativo.
2. Selecionar vídeo.
3. Escolher 1 minuto.
4. Selecionar TikTok/Reels.
5. Selecionar pasta em HDD.
6. Iniciar análise.
7. Confirmar atualização de progresso.
8. Revisar corte sugerido.
9. Exportar.
10. Confirmar arquivo reproduzível no diretório final.

## Casos de borda

- Arquivo corrompido
- Link inválido ou indisponível
- Vídeo sem áudio
- Vídeo menor que a duração solicitada
- HDD desconectado durante processamento
- Espaço insuficiente
- FFmpeg ausente/corrompido
- Modelo de IA indisponível
- Queda de conexão durante download de origem
- Usuário cancela o job durante encode

## Critérios mínimos para instalador público

- Build limpo em Windows
- Nenhuma chave ou segredo no bundle
- Crash recovery básico
- Cancelamento não deixa processos FFmpeg órfãos
- Arquivos temporários são limpos
- Exportações não sobrescrevem arquivos sem confirmação/regra segura
- Teste com vídeos 720p, 1080p e 4K
