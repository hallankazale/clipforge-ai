from dataclasses import dataclass
import re

@dataclass
class LiveReply:
    intent:str
    reply:str
    confidence:float
    needs_review:bool=False

RULES=[
 ("price",re.compile(r"\b(preço|preco|valor|quanto custa|quanto)\b",re.I)),
 ("shipping",re.compile(r"\b(frete|entrega|chega|prazo)\b",re.I)),
 ("buy",re.compile(r"\b(como compro|comprar|onde compro|link|carrinho)\b",re.I)),
 ("size",re.compile(r"\b(tamanho|tam\.?|pp|gg|g1|g2| tamanho g | tamanho m | tamanho p )\b",re.I)),
 ("greeting",re.compile(r"\b(oi|olá|ola|boa noite|bom dia|boa tarde)\b",re.I)),
 ("gift",re.compile(r"\b(mimo|presente|gift)\b",re.I)),
]
def classify(text:str)->tuple[str,float]:
    clean=" ".join((text or "").split())
    for intent,rx in RULES:
        if rx.search(" "+clean+" "): return intent,.88
    return "general",.45

def draft_reply(text:str,user:str="pessoal",product:dict|None=None)->LiveReply:
    intent,conf=classify(text); p=product or {}; name=p.get("name","esse produto")
    if intent=="price":
        value=p.get("price"); reply=f"Claro 😊 {name} está por R$ {value}." if value else f"Boa pergunta 😊 Vou confirmar o valor de {name} pra você."
    elif intent=="shipping": reply="O prazo e o frete podem variar conforme o CEP. Dá uma olhadinha no carrinho que ele mostra certinho pra você 😊"
    elif intent=="buy": reply="É só tocar no produto destacado na LIVE e conferir os detalhes no carrinho 😊"
    elif intent=="size": reply="Posso te ajudar 😊 Confira as opções de tamanho no produto destacado; se me disser qual você procura, eu te oriento."
    elif intent=="greeting": reply=f"Oi, {user}! Seja muito bem-vindo(a) 😊 Fica à vontade pra perguntar sobre o produto."
    elif intent=="gift": reply=f"Ahh, {user}, muito obrigado pelo carinho e pelo mimo! 💜"
    else: reply="Entendi 😊 Quero te responder certinho. Pode me dar só mais um detalhe da sua dúvida?"
    risky=bool(re.search(r"\b(reembolso|processo|golpe|remédio|doença|garantia|cancelar|cancelamento)\b",text or "",re.I))
    return LiveReply(intent,reply,conf, risky or conf<.60)
