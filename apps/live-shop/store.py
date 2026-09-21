import sqlite3
from pathlib import Path
from typing import Iterable
from engine import Creative

SCHEMA="""
CREATE TABLE IF NOT EXISTS creatives(id TEXT PRIMARY KEY, product TEXT NOT NULL, title TEXT NOT NULL, media_path TEXT NOT NULL DEFAULT '', impressions INTEGER NOT NULL DEFAULT 0 CHECK(impressions>=0), clicks INTEGER NOT NULL DEFAULT 0 CHECK(clicks>=0), orders INTEGER NOT NULL DEFAULT 0 CHECK(orders>=0), revenue REAL NOT NULL DEFAULT 0 CHECK(revenue>=0));
"""

class Store:
    def __init__(self, path: str = "live_shop.db"):
        self.path = Path(path)
        self._init()
    def connect(self):
        con=sqlite3.connect(self.path)
        con.row_factory=sqlite3.Row
        return con
    def _init(self):
        with self.connect() as con: con.executescript(SCHEMA)
    def list_creatives(self) -> list[Creative]:
        with self.connect() as con: rows=con.execute("SELECT id,product,title,impressions,clicks,orders,revenue FROM creatives ORDER BY title").fetchall()
        return [Creative(**dict(r)) for r in rows]
    def add(self, creative_id:str, product:str, title:str, media_path:str=""):
        clean=(creative_id.strip(),product.strip(),title.strip(),media_path.strip())
        if not all(clean[:3]): raise ValueError("id, produto e título são obrigatórios")
        with self.connect() as con: con.execute("INSERT INTO creatives(id,product,title,media_path) VALUES(?,?,?,?)",clean)
    def record(self, creative_id:str, impressions:int=0, clicks:int=0, orders:int=0, revenue:float=0):
        vals=(int(impressions),int(clicks),int(orders),float(revenue))
        if any(v<0 for v in vals): raise ValueError("métricas não podem ser negativas")
        with self.connect() as con:
            cur=con.execute("UPDATE creatives SET impressions=impressions+?, clicks=clicks+?, orders=orders+?, revenue=revenue+? WHERE id=?",(*vals,creative_id))
            if cur.rowcount!=1: raise KeyError(creative_id)
