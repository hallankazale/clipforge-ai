from dataclasses import dataclass,field
from time import time
from ai_agent import draft_reply,LiveReply

@dataclass
class ViewerContext:
    user:str
    product:dict=field(default_factory=dict)
    last_messages:list[str]=field(default_factory=list)
    updated_at:float=field(default_factory=time)

class ConversationAgent:
    def __init__(self,max_messages:int=6):
        self.max_messages=max_messages; self.viewers={}
    def context(self,user:str)->ViewerContext:
        return self.viewers.setdefault(user,ViewerContext(user=user))
    def set_product(self,user:str,product:dict):
        c=self.context(user); c.product=dict(product); c.updated_at=time()
    def reply(self,user:str,message:str,product:dict|None=None)->LiveReply:
        c=self.context(user)
        if product: c.product=dict(product)
        c.last_messages.append(message); c.last_messages=c.last_messages[-self.max_messages:]; c.updated_at=time()
        return draft_reply(message,user,c.product)
    def snapshot(self,user:str)->dict:
        c=self.context(user)
        return {"user":c.user,"product":c.product,"last_messages":list(c.last_messages),"updated_at":c.updated_at}
