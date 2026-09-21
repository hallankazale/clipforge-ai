from dataclasses import dataclass
from math import log1p
from typing import Iterable

@dataclass(frozen=True)
class Creative:
    id: str
    product: str
    title: str
    impressions: int = 0
    clicks: int = 0
    orders: int = 0
    revenue: float = 0.0

def score(c: Creative) -> float:
    """Balanceia conversão e exploração sem favorecer apenas volume bruto."""
    imp=max(c.impressions,1)
    ctr=c.clicks/imp
    cvr=c.orders/max(c.clicks,1)
    rpm=(c.revenue/imp)*1000
    confidence=min(1.0, log1p(c.impressions)/log1p(500))
    return round((ctr*35+cvr*45+min(rpm/100,1)*20)*(0.35+0.65*confidence),6)

def build_queue(items: Iterable[Creative], limit: int=20) -> list[Creative]:
    pool=list(items)
    if not pool: return []
    ranked=sorted(pool,key=lambda c:(score(c),c.orders,c.clicks),reverse=True)
    out=[]
    while len(out)<limit:
        for c in ranked:
            if len(out)>=limit: break
            if len(out)>=2 and out[-1].id==c.id and out[-2].id==c.id: continue
            out.append(c)
    return out
