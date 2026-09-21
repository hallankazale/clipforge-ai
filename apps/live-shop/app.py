from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from engine import Creative, build_queue, score

CREATIVES=[
 Creative("demo-a","Produto demo","Gancho benefício",100,12,2,79.8),
 Creative("demo-b","Produto demo","Demonstração",100,8,1,39.9),
 Creative("demo-c","Produto demo","Problema e solução",100,15,3,119.7),
]

class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path=="/api/queue":
   q=build_queue(CREATIVES,12)
   body=json.dumps([{"id":c.id,"title":c.title,"product":c.product,"score":score(c)} for c in q]).encode()
   self.send_response(200); self.send_header("Content-Type","application/json; charset=utf-8"); self.end_headers(); self.wfile.write(body); return
  rows="".join(f"<tr><td>{c.title}</td><td>{c.impressions}</td><td>{c.clicks}</td><td>{c.orders}</td><td>R$ {c.revenue:.2f}</td><td>{score(c):.3f}</td></tr>" for c in CREATIVES)
  html=f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ClipForge Live Shop</title><style>body{{font:16px system-ui;background:#0b1020;color:#eef2ff;margin:0}}main{{max-width:980px;margin:auto;padding:28px}}.card{{background:#151b31;border:1px solid #29304d;border-radius:16px;padding:20px;overflow:auto}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #29304d}}.pill{{display:inline-block;padding:6px 10px;border-radius:999px;background:#25305a}}a{{color:#a9c1ff}}</style><main><span class="pill">MVP v0.1</span><h1>ClipForge · Live Shop</h1><p>Painel local de criativos e performance. Operação supervisionada, usando conteúdo próprio/licenciado.</p><div class="card"><table><thead><tr><th>Criativo</th><th>Impressões</th><th>Cliques</th><th>Pedidos</th><th>Receita</th><th>Score</th></tr></thead><tbody>{rows}</tbody></table></div><p><a href="/api/queue">Ver fila otimizada (JSON)</a></p></main>'''.encode()
  self.send_response(200); self.send_header("Content-Type","text/html; charset=utf-8"); self.end_headers(); self.wfile.write(html)

if __name__=="__main__": HTTPServer(("127.0.0.1",8787),Handler).serve_forever()
