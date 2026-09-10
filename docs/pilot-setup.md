# Piloto IA 0.6.0 — configuração

## O que esta versão produz

Vídeos verticais de 30, 45 ou 60 segundos: roteiro, 4–10 cenas originais geradas por IA,
movimento de câmera, narração e legendas com timestamps extraídos do áudio ajustado.
Não é filmagem com personagens animados; é uma montagem audiovisual de imagens narradas.
A qualidade criativa continua variável. A avaliação automatizada é uma estimativa, não
uma garantia de veracidade, originalidade universal, qualidade subjetiva ou viralização.

## Credenciais no desktop

No Piloto IA, use **Importar credenciais com segurança** para selecionar um JSON local.
Os únicos campos aceitos são os abaixo; inclua apenas os serviços que irá configurar.
Nunca comite esse arquivo. Não compartilhe chaves no chat ou em capturas de tela.

| Campo | Uso |
| --- | --- |
| `openaiApiKey` | Chave de projeto da OpenAI com saldo e acesso aos modelos |
| `textModel` | Opcional; padrão `gpt-4.1`, com visão, Responses e pesquisa web |
| `imageModel` | Opcional; padrão `gpt-image-2.5-sunburst` |
| `youtubeClientId` | Cliente OAuth do Google, tipo aplicativo para computador |
| `youtubeClientSecret` | Segredo associado ao cliente, se emitido pelo Google |
| `tiktokClientKey` | Client key do aplicativo TikTok registrado |
| `tiktokClientSecret` | Client secret do seu aplicativo TikTok |

O JSON é lido pelo processo principal e salvo usando Electron safeStorage (DPAPI no Windows).
O renderer recebe somente indicadores de configuração e nomes das contas, nunca tokens.
Em Linux, o backend `basic_text` é recusado. As credenciais pertencem ao usuário que as importou;
não embuta credenciais de produção de um serviço público em um instalador distribuído.
A importação não valida saldo; erros de permissão ou cobrança serão exibidos ao produzir.

A tentativa de provisionar uma nova chave pelo conector OpenAI Platform nesta sessão foi
recusada pelo serviço. Nenhuma chave foi criada ou escrita pelo assistente.

## YouTube

1. Habilite YouTube Data API v3 em seu projeto Google Cloud.
2. Configure a tela de consentimento e crie cliente OAuth **Desktop app**.
3. Importe o cliente e clique em Conectar. Autorize upload e leitura da conta.
4. Confirme o nome do canal. Esta versão exige no máximo uma conta por plataforma.
5. Escolha visibilidade e se o conteúdo é feito para crianças.
6. Para publicar automaticamente, marque a opção correspondente ao criar o lote.

O callback usa `http://127.0.0.1:<porta>/callback/`, PKCE S256 e state aleatório.
Uploads públicos são enviados antecipadamente como privados com `publishAt`. Uploads privados
ou não listados são iniciados no horário selecionado e precisam do aplicativo aberto.
Projetos não verificados podem ter uploads restritos a privado. A interface não considera essa
restrição uma publicação pública bem-sucedida. Um horário que já passou antes de iniciar um
upload público é bloqueado. Escolha o primeiro horário com folga para concluir a produção.

Em falhas ambíguas, o ID remoto/sessão é preservado. Sessões YouTube existentes têm até três
retomadas com espera crescente; uma sessão expirada não inicia automaticamente um segundo vídeo.
Confira o YouTube Studio em casos de envio não confirmado. Revogar a conexão não remove uploads
ou agendamentos que já estão no YouTube; cancele-os também no Studio se necessário.

## TikTok

Registre Login Kit Desktop e Content Posting API com `video.upload` e `user.info.basic`.
Configure o redirect URI `http://127.0.0.1:*/callback/`. O PKCE do TikTok usa SHA256 em hexadecimal,
conforme a documentação específica da plataforma. Importe client key/secret e conecte.

Após aprovação de qualidade, assista ao vídeo e clique **Enviar ao TikTok**. A confirmação informa
o vídeo e o nome da conta. O upload vai para a caixa de entrada do TikTok; a postagem é finalizada
lá, com edição de legenda, privacidade e indicação de conteúdo gerado por IA.

**Não há Direct Post sem intervenção nesta versão.** O fluxo oficial exige controle e consentimento
do criador por conteúdo e pode exigir auditoria. Não usamos automação de navegador para contornar
isso. O limite deste adaptador é 64 MB por vídeo. O pacote `publicacao.txt` traz título, descrição,
até cinco hashtags e indicação de geração por IA para copiar ao TikTok.

## Operação e arquivos

Deixe o aplicativo aberto durante a produção e uploads pendentes. Não há servidor em nuvem,
execução com o computador desligado ou tarefa recorrente fora do app. Um lote possui no máximo
sete dias. Os horários são calculados no fuso do computador e persistidos como instantes ISO/UTC.
A frequência distribui vídeos ao longo do dia a partir do primeiro horário escolhido.

Os vídeos ficam na pasta escolhida: `Piloto/<job-id>/attempt-<n>/`, com storyboard, imagens,
narração, legendas ASS, vídeo MP4, relatório de qualidade e texto de publicação. Tentativas anteriores
ficam preservadas, inclusive quando reprovadas. Reserve espaço e remova arquivos antigos depois de
conferir seus envios. O estado da fila fica no diretório de dados do aplicativo, em `pilot/jobs.json`.
Se esse arquivo estiver corrompido, o aplicativo bloqueia a operação em vez de apagá-lo.

A API cobra por geração, pesquisa e avaliação, inclusive tentativas reprovadas. O formulário solicita
autorização para o lote e mostra o número máximo de tentativas. Há teto de 60 chamadas por vídeo,
e uma falha de provedor pausa o restante do lote. Isto limita chamadas, mas não é um teto monetário.

## Fontes oficiais consultadas

- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.google.com/youtube/v3/guides/auth/installed-apps
- https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.tiktok.com/doc/login-kit-desktop/
- https://developers.tiktok.com/docs/en/oauth-user-access-token-management
- https://developers.tiktok.com/docs/en/content-sharing-guidelines
- https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video
