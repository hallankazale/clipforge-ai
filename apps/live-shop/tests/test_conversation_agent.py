import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from conversation_agent import ConversationAgent
from moderation import assess
class ConversationTests(unittest.TestCase):
 def test_keeps_product_context(self):
  a=ConversationAgent(); a.set_product("Ana",{"name":"Garrafa","price":"79,90"})
  self.assertIn("79,90",a.reply("Ana","qual o preço?").reply)
 def test_keeps_recent_messages(self):
  a=ConversationAgent(max_messages=2)
  for x in ["a","b","c"]: a.reply("U",x)
  self.assertEqual(a.snapshot("U")["last_messages"],["b","c"])
 def test_personal_data_review(self): self.assertEqual(assess("me chama no whatsapp")["action"],"review")
 def test_abuse_ignore(self): self.assertEqual(assess("seu idiota")["action"],"ignore")
if __name__=="__main__": unittest.main()
