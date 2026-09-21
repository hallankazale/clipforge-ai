import argparse,json
from pathlib import Path
from engine import build_queue,score
from store import Store

def export(db:str, output:str, limit:int=30):
    store=Store(db); items=store.list_creatives(); media=store.list_media()
    queue=build_queue(items,limit)
    payload=[{"position":i+1,"creative_id":c.id,"product":c.product,"title":c.title,"media_path":media.get(c.id,""),"score":score(c)} for i,c in enumerate(queue)]
    Path(output).write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    return payload

if __name__=="__main__":
    p=argparse.ArgumentParser(description="Exporta fila otimizada do ClipForge Live Shop")
    p.add_argument("--db",default="live_shop.db"); p.add_argument("--output",default="playlist.json"); p.add_argument("--limit",type=int,default=30)
    a=p.parse_args(); rows=export(a.db,a.output,a.limit); print(f"{len(rows)} itens exportados para {a.output}")
