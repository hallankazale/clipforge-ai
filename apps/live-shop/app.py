from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs
import html, json, os
from engine import build_queue, score
from store import Store

DB=os.environ.get("CLIPFORGE_LIVE_DB","live_shop.db")
store=Store(DB)

class Handler(BaseHTTPRequestHandler):
    def _send(self,status:int,body:bytes,content_type="text/html; charset=utf-8"):
        self.send_response(status); self.send_header("Content-Type",content_type); self.send_header("X-Content-Type-Options","nosniff"); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)
    def _redirect(self): self.send_response(303); self.send_header("Location","/"); self.end_headers()
    def do_GET(self):
        items=store.list_creatives()
        if self.path=="/api/queue":
            q=build_queue(items,20)
            body=json.dumps([{"id":c.id,"title":c.title,"product":c.product,"score":score(c)} for c in q],ensure_ascii=False).encode()
            return self._send(200,body,"application/json; charset=utf-8")
        rows="".join(f"<tr><td>{html.escape(c.title)}</td><td>{html.escape(c.product)}</td><td>{c.impressions}</td><td>{c.clicks}</td><td>{c.orders}</td><td>R$ {c.revenue:.2f}</td><td>{score(c):.3f}</td></tr>" for c in items) or '<tr><td colspan="7">Cadastre o primeiro criativo.</td></tr>'
        page=f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ClipForge Live Shop</title><style>body{{font:15px system-ui;background:#0b1020;color:#eef2ff;margin:0}}main{{max-width:1050px;margin:auto;padding:24px}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}.card{{background:#151b31;border:1px solid #29304d;border-radius:16px;padding:18px;overflow:auto}}input,button{{box-sizing:border-box;width:100%;padding:11px;margin:5px 0;border-radius:9px;border:1px solid #394363;background:#0f1630;color:#fff}}button{{cursor:pointer;background:#4d62d6}}table{{width:100%;border-collapse:collapse}}td,th{{padding:10px;text-align:left;border-bottom:1px solid #29304d}}a{{color:#b9c8ff}}@media(max-width:720px){{.grid{{grid-template-columns:1fr}}}}</style><main><h1>ClipForge · Live Shop <small>v0.2</small></h1><p>Organize criativos próprios/licenciados e acompanhe desempenho.</p><div class="grid"><section class="card"><h2>Novo criativo</h2><form method="post" action="/creative"><input name="id" maxlength="64" placeholder="ID: produto-gancho-01" required><input name="product" maxlength="120" placeholder="Produto" required><input name="title" maxlength="160" placeholder="Título do criativo" required><input name="media_path" maxlength="500" placeholder="Caminho do vídeo (opcional)"><button>Adicionar</button></form></section><section class="card"><h2>Registrar resultado</h2><form method="post" action="/metric"><input name="id" maxlength="64" placeholder="ID do criativo" required><input name="impressions" type="number" min="0" value="0"><input name="clicks" type="number" min="0" value="0"><input name="orders" type="number" min="0" value="0"><input name="revenue" type="number" min="0" step="0.01" value="0"><button>Salvar métricas</button></form></section></div><section class="card" style="margin-top:16px"><h2>Desempenho</h2><table><tr><th>Criativo</th><th>Produto</th><th>Imp.</th><th>Cliques</th><th>Pedidos</th><th>Receita</th><th>Score</th></tr>{rows}</table><p><a href="/api/queue">Fila otimizada JSON</a></p></section></main></html>'''.encode()
        self._send(200,page)
    def do_POST(self):
        try:
            length=min(int(self.headers.get("Content-Length","0")),8192)
            form={k:v[0] for k,v in parse_qs(self.rfile.read(length).decode("utf-8")).items()}
            if self.path=="/creative": store.add(form.get("id",""),form.get("product",""),form.get("title",""),form.get("media_path",""))
            elif self.path=="/metric": store.record(form.get("id",""),form.get("impressions",0),form.get("clicks",0),form.get("orders",0),form.get("revenue",0))
            else: return self._send(404,b"Not found","text/plain")
            self._redirect()
        except (ValueError,KeyError): self._send(400,"Dados inválidos".encode(),"text/plain; charset=utf-8")

if __name__=="__main__": ThreadingHTTPServer(("127.0.0.1",8787),Handler).serve_forever()
