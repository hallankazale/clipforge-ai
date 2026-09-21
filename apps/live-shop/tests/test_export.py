import json,pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from store import Store
from export_playlist import export

class ExportTests(unittest.TestCase):
    def test_playlist_contains_media(self):
        with tempfile.TemporaryDirectory() as d:
            db=str(pathlib.Path(d)/"x.db"); out=str(pathlib.Path(d)/"playlist.json")
            s=Store(db); s.add("a","Produto","Gancho","C:/videos/a.mp4"); s.record("a",100,12,2,80)
            rows=export(db,out,3)
            self.assertEqual(len(rows),3); self.assertEqual(rows[0]["media_path"],"C:/videos/a.mp4")
            self.assertEqual(json.loads(pathlib.Path(out).read_text(encoding="utf-8"))[0]["creative_id"],"a")

if __name__=="__main__": unittest.main()
