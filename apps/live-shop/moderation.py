import re
BLOCK=re.compile(r"\b(whatsapp|telefone|cpf|pix|senha|endereço|endereco)\b",re.I)
ABUSE=re.compile(r"\b(idiota|burro|otário|otario)\b",re.I)
def assess(text:str)->dict:
    text=text or ""
    if BLOCK.search(text): return {"action":"review","reason":"possível dado pessoal ou contato"}
    if ABUSE.search(text): return {"action":"ignore","reason":"mensagem hostil"}
    return {"action":"reply","reason":"ok"}
