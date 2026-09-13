# ClipForge AI Android Companion — v0.7

## Objetivo

O aplicativo Android é o painel principal do ClipForge para uso cotidiano. Ele não tenta renderizar vídeos pesados no telefone. O PC continua sendo o worker responsável por IA, FFmpeg, Quality Gate e arquivos finais.

```text
Android
  ├─ escolher nicho
  ├─ gerar agora
  ├─ programar 7 dias
  └─ acompanhar fila
        ↓ rede local autenticada
Desktop Worker
  ├─ OpenAI
  ├─ imagens / voz
  ├─ FFmpeg
  ├─ Quality Gate
  └─ fila persistente
```

## Motivo da arquitetura

Executar o pipeline completo no Android aumentaria consumo de bateria, aquecimento, tempo de render e diferenças entre aparelhos. O modelo companion mantém o telefone leve e reaproveita o motor desktop já validado.

## Pareamento

A primeira versão funciona com Android e PC na mesma rede Wi-Fi.

1. O ClipForge desktop inicia a API local na porta `43170` e o serviço de pareamento na porta `43171`.
2. O Android recebe o endereço local do PC.
3. Ao tocar em Parear, o celular solicita autorização.
4. O computador mostra uma caixa de confirmação física.
5. Somente após o usuário permitir, o Android recebe um token de controle aleatório.

A chave da OpenAI permanece criptografada no PC via `Electron.safeStorage` e nunca é transferida ao Android.

## Superfície da API

O companion expõe apenas as operações necessárias:

- consultar saúde do worker
- listar fila
- consultar estado
- criar produção imediata
- programar uma semana
- cancelar item ainda não iniciado

Não existe endpoint para executar comandos do sistema, navegar pelo disco ou recuperar a chave OpenAI.

## Segurança

Proteções atuais:

- token aleatório de 192 bits
- comparação do token em tempo constante
- aprovação física no PC para primeiro pareamento
- validação e normalização do payload de produção
- limite de tamanho do corpo HTTP
- chave OpenAI isolada no desktop
- nenhuma senha de rede social armazenada

### Limitação da v0.7

O transporte local usa HTTP para facilitar comunicação dentro da LAN e, por isso, deve ser usado somente em rede Wi-Fi confiável. Não deve ser exposto por port-forwarding, IP público ou redes públicas.

A próxima evolução para acesso fora de casa deve usar um backend autenticado com TLS, RLS e sessão por usuário, em vez de expor diretamente o PC à internet.

## UX mobile

O app possui quatro áreas principais:

- **Início:** resumo, status do PC e ações rápidas
- **Criar:** nicho, duração, plataformas e Quality Gate
- **Fila:** produções agendadas e resultados
- **Conexão:** pareamento e estado do worker

O layout é mobile-first e respeita safe areas do Android.

## Testes mínimos

Antes de mergear a versão:

- typecheck do workspace
- testes unitários de validação dos comandos mobile
- build Vite mobile
- geração do projeto Android com Capacitor
- build Gradle do APK de debug
- build desktop para confirmar que o companion não quebra o worker

## Fase seguinte

Para funcionar fora da mesma rede Wi-Fi:

- backend dedicado para ClipForge
- autenticação do usuário
- fila sincronizada na nuvem
- RLS por usuário/dispositivo
- Edge Functions para comandos
- notificações push Android
- worker desktop buscando jobs autenticados

Esse desenho elimina a necessidade de abrir portas do roteador e permite controlar o ClipForge de qualquer lugar.
