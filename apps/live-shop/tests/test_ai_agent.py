import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from ai_agent import classify,draft_reply
class AgentTests(unittest.TestCase):
 def test_price(self): self.assertEqual(classify("qual o preço?")[0],"price")
 def test_buy(self): self.assertEqual(classify("como compro?")[0],"buy")
 def test_gift(self): self.assertIn("mimo",draft_reply("mandou um mimo","Ana").reply.lower())
 def test_uncertain_review(self): self.assertTrue(draft_reply("xyz estranho").needs_review)
 def test_sensitive_review(self): self.assertTrue(draft_reply("quero reembolso").needs_review)
if __name__=="__main__": unittest.main()
