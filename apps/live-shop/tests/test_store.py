import pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from store import Store

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.store=Store(str(pathlib.Path(self.tmp.name)/"test.db"))
    def tearDown(self): self.tmp.cleanup()
    def test_add_and_record(self):
        self.store.add("a","Produto","Gancho","video.mp4")
        self.store.record("a",100,10,2,59.9)
        c=self.store.list_creatives()[0]
        self.assertEqual((c.impressions,c.clicks,c.orders),(100,10,2)); self.assertAlmostEqual(c.revenue,59.9)
    def test_reject_negative_metric(self):
        self.store.add("a","P","T")
        with self.assertRaises(ValueError): self.store.record("a",-1)
    def test_unknown_creative(self):
        with self.assertRaises(KeyError): self.store.record("missing",1)

if __name__=="__main__": unittest.main()
