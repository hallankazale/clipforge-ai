import sys, pathlib, unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from engine import Creative, score, build_queue

class EngineTests(unittest.TestCase):
 def test_orders_improve_score(self):
  a=Creative("a","p","a",100,10,1,40)
  b=Creative("b","p","b",100,10,3,120)
  self.assertGreater(score(b),score(a))
 def test_empty_queue(self): self.assertEqual(build_queue([]),[])
 def test_queue_length(self):
  self.assertEqual(len(build_queue([Creative("a","p","a"),Creative("b","p","b")],7)),7)

if __name__=="__main__": unittest.main()
