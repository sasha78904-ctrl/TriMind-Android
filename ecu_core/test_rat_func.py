import unittest
from ecu_core.rat_func import raw_to_physical
class TestRatFunc(unittest.TestCase):
 def test_scale(self):self.assertAlmostEqual(raw_to_physical(8192,[0,32768,0,0,0,1]),.25)
 def test_rpm(self):self.assertEqual(raw_to_physical(26,[0,1/32,0,0,0,1]),832)
 def test_offset(self):self.assertEqual(raw_to_physical(25,[0,2,10,0,0,1]),7.5)
 def test_ambiguous(self):self.assertIsNone(raw_to_physical(4,[1,0,0,0,0,1]))
 def test_undefined(self):self.assertIsNone(raw_to_physical(1,[0,0,0,0,0,1]))
if __name__=='__main__':unittest.main()
