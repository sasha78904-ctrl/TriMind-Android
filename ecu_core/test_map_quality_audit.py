import unittest,sys
sys.path.insert(0,".")
from ecu_core.map_quality_audit import audit
def map_item(axis,z):
 return {"name":"fixture","address":"0x20","dimensions":[len(axis),1],"axes":[{"raw":axis,"count":len(axis)}],"z_raw":z}
class TestQuality(unittest.TestCase):
 def test_constant_axis_is_flagged(self):
  r=audit({"examples":[map_item([0,0,0],[1,2,3])]})
  self.assertEqual(r["maps_flagged"],1)
  self.assertIn("axis_0_constant",r["rows"][0]["issues"])
 def test_increasing_axis_passes(self):
  r=audit({"examples":[map_item([0,10,20],[1,2,3])]})
  self.assertEqual(r["maps_flagged"],0)
 def test_decreasing_axis_is_flagged(self):
  r=audit({"examples":[map_item([20,10,0],[1,2,3])]})
  self.assertIn("axis_0_decreasing",r["rows"][0]["issues"])
if __name__=="__main__":unittest.main()
