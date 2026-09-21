import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]))
from remote_controls import normalize_action,action_state
class RemoteTests(unittest.TestCase):
    def test_actions(self):
        self.assertEqual(action_state("start"),"running")
        self.assertEqual(action_state("pause"),"paused")
        self.assertEqual(action_state("stop"),"stopped")
    def test_invalid(self):
        with self.assertRaises(ValueError): normalize_action("delete-all")
if __name__=="__main__": unittest.main()
