# Validação e arquitetura — piloto 0.6.0

## Problemas encontrados na 0.5.0

- `decideProductionAfterQualityGate` existia sem execução do pipeline ou publicação.
- Métricas eram entradas fornecidas pelo chamador; não havia medição do vídeo.
- Formato, narrativa e ritmo podiam ser compensados por outras notas na média.
- `minimumScore=NaN` e contadores inválidos não eram rejeitados explicitamente.
- Agenda continha somente deslocamentos/horários, sem jobs persistentes ou integração.
- Botões de contas estavam desabilitados; não existiam credenciais OAuth ou tokens.
- A UI exibia “avaliado” antes de avaliar qualquer vídeo e confiava no formato do localStorage.

## Estrutura adotada

| Caminho em `apps/desktop/electron/pilot/` | Responsabilidade |
| --- | --- |
| `contracts.ts`, `validation.ts` | Contratos compartilhados e validação de entradas |
| `quality.ts`, `production.ts`, `presets.ts` | Regras puras, limites e nichos |
| `ai.ts` | Pesquisa, roteiro, imagens, voz, transcrição e crítica editorial |
| `media.ts` | Renderização serial, legendas, análise FFmpeg e hash do MP4 |
| `engine.ts` | Produção e invalidação dos componentes dependentes em cada retry |
| `store.ts` | Persistência serializada e recuperação de interrupções |
| `vault.ts`, `oauth.ts` | Cofre do sistema, PKCE, renovação e revogação |
| `publishers.ts` | Adaptadores oficiais, upload e confirmação de processamento |
| `runtime.ts`, `ipc.ts` | Fila, limites de concorrência e operações autorizadas da UI |

`src/pilot/` reexporta o domínio puro; a implementação vive no processo principal para que a
UI não controle a aprovação. `PilotProductionPanel.tsx` apresenta produção/contas/fila sem acesso
a segredos. Mantidos Electron, React, TypeScript e FFmpeg para aproveitar o aplicativo existente;
REST nativo evita dependências adicionais para as APIs. A fila JSON atômica é adequada ao desktop
com uma instância e um worker; escalar para múltiplos workers exige banco transacional e leases.

## Fluxo verificado

Entrada validada → pesquisa/roteiro → imagens + áudio → ajuste de duração → transcrição →
renderização → inspeção técnica + crítica editorial → aprovação ou retry limitado →
MP4 identificado por hash → upload → acompanhamento do processamento remoto.

Atualizar roteiro invalida voz, legendas e imagens. Retry apenas visual também invalida voz/legendas
se o modelo inesperadamente modificar a narração. Mudanças de cenas seguem os tempos das palavras
por alinhamento proporcional; isso ainda não é alinhamento semântico quadro a quadro.

Reprovação técnica bloqueia publicação independentemente da média. Formato esperado:
1080×1920, H.264/yuv420p, 30 FPS, AAC, alvo de duração ±0,6s, loudness entre -19 e -13 LUFS,
pico ≤ -0,5 dBTP, silêncio ≤25%, transcrição com similaridade ≥85% e cobertura mínima de legendas.
Frames reais são avaliados por IA; voz recebe evidência técnica, sem alegação de escuta humana.

## Testes automatizados

Execute `pnpm test`, `pnpm typecheck`, `pnpm build` e
`pnpm --filter @clipforge/desktop verify:renderer`.

Cobertura nova:
- NaN, notas críticas, configuração adulterada, duração e timestamps inválidos.
- PKCE distinto entre plataformas, bloqueio de hosts de upload arbitrários e injeção ASS.
- Roteiro divergente da fala; invalidação de dependências de retries e tempos das cenas.
- Gravação concorrente da fila, corrupção preservada e recuperação após interrupção.
- Lote duplicado por duplo clique; aprovado despachado uma vez; reprovado nunca enviado.
- Falha do provedor pausa o lote sem gerar os outros vídeos.
- Hash alterado bloqueia publicação; sessão salva antes de bytes; retomada usa offset remoto.
- Sessão expirada não cria upload novo; privado por restrição não é sucesso de agenda pública.
- Smoke de FFmpeg real em Linux: renderização MP4, codecs, legendas e detecção de silêncio/tela preta.
  No Windows usa os binários empacotados de ffmpeg-static/ffprobe-static.

Testes de transporte e geração usam doubles controlados; não comprovam credenciais reais,
saldo, qualidade dos modelos na conta do usuário, consentimento externo ou aceitação de uploads.
Nenhuma chamada paga ou postagem real foi executada. O provisionamento da chave foi recusado.

## Checklist de homologação Windows com credenciais reais

1. Instalar, abrir e importar credenciais. Confirmar que nenhum token aparece no renderer/logs.
2. Conectar cada conta, recusar consentimento, reconectar e verificar nome do canal correto.
3. Produzir inicialmente um vídeo privado: conferir primeiros 3s, contexto, fatos/fontes,
   consistência das cenas, voz sem cortes, legendas legíveis e sincronizadas na tela do celular.
4. Elevar meta para provocar reprovação e observar limite de tentativas e ausência de upload.
5. Interromper rede, fechar app durante produção/upload e reabrir; conferir arquivos e duplicatas.
6. Testar disco sem espaço, HD removido e acesso negado. Não publicar saídas incompletas.
7. YouTube: confirmar processamento, privacidade e publishAt no Studio; testar token expirado e quota.
8. TikTok: confirmar chegada à caixa de entrada, edição final e marcação de conteúdo gerado por IA.
9. Executar lote pequeno com horários futuros e observar CPU/RAM/HD no computador alvo.

## Limitações que ainda precisam de avaliação

- Não há prova automática de originalidade universal, fact-check independente ou avaliação humana.
- Pesquisa web fornece fontes, mas alucinações ainda podem ocorrer; a crítica é outra chamada de modelo.
- Originalidade usa histórico local e comparação editorial; faltam embeddings e um acervo de referência.
- Narração pode soar artificial; faltam teste perceptual e escolha de vozes na interface.
- Não há edição manual de roteiro/cenas nem reaprovação manual de vídeos bloqueados.
- Upload TikTok é para a caixa de entrada, não publicação autônoma Direct Post.
- Sessão expirada/resultado ambíguo sem identificador exige conferência manual, por prevenção de duplicatas.
- O worker precisa do aplicativo aberto. Retenção de arquivos e agendamento em nuvem não fazem parte desta versão.
- O instalador e OAuth devem ser homologados no Windows do usuário antes de chamar esta versão de produção.

## Resultado desta sessão

46 testes passaram, incluindo a renderização real e análise com FFmpeg. Typecheck,
build Vite/Electron e verificação de assets relativos do renderer passaram.
A ferramenta agent-browser falhou ao iniciar; a alternativa Playwright não encontrou
Chromium e o download expirou. Portanto, a interface não recebeu homologação visual
nesta sessão. OAuth real, API paga, postagem real e instalador Windows também não
foram validados e devem permanecer como critérios de liberação.

O CI Desktop do PR passou no Windows. O workflow do instalador também passou a executar
no PR para gerar um artefato de teste sem exigir merge antecipado.
