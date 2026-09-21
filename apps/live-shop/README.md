# ClipForge Live Shop

MVP local para organizar criativos próprios/licenciados de TikTok Shop LIVE, pontuar desempenho e gerar uma fila de reprodução para operação supervisionada.

## Escopo v0.1
- catálogo de produtos e criativos
- métricas por criativo (impressões, cliques, pedidos, receita)
- score de desempenho
- fila ponderada com limite de repetição
- painel local simples

## Segurança e plataforma
Não armazene cookies, senhas ou chaves do TikTok no repositório. O MVP não tenta burlar controles da plataforma nem simular engajamento. Publicação/transmissão deve usar os meios autorizados pela plataforma e conteúdo próprio/licenciado.

## Rodar
```bash
cd apps/live-shop
python -m unittest discover -s tests -v
python app.py
```
Abra http://127.0.0.1:8787
