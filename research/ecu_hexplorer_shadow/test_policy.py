"""Synthetic policy regression. Does NOT execute HEXplorer."""
import unittest
from policy import compare_records, use_peer_to_upgrade_trimind

def base():
    return dict(status="STRUCTURE_VALID", address_hex="0x8E05DA",
                dimensions={"x": 2, "y": 2}, byte_length=8,
                axis_x_raw=[100, 200], axis_y_raw=[0, 100],
                values_raw_flat=[1, 2, 3, 4])

def candidate():
    return dict(base(), has_explicit_source_provenance=True,
                memory_coverage_verified=True, missing_bytes=False,
                axis_count_from_maximum=False)

class ShadowPolicyTests(unittest.TestCase):
    def test_equal_raw_does_not_mean_verified(self):
        result = compare_records(base(), candidate(), "EPK_MATCH")
        self.assertEqual(result["status"], "AGREE_RAW_ONLY")
        self.assertFalse(result["trusted"])
    def test_epk_mismatch_blocks(self):
        self.assertEqual(compare_records(base(), candidate(), "EPK_MISMATCH")["status"],
                         "BLOCKED_IDENTITY_MISMATCH")
    def test_unknown_identity_unverified(self):
        self.assertEqual(compare_records(base(), candidate(), "IDENTITY_UNKNOWN")["status"],
                         "UNVERIFIED_IDENTITY")
    def test_missing_memory_rejected(self):
        p = candidate(); p["missing_bytes"] = True; p["values_raw_flat"] = [0, 0, 0, 0]
        self.assertIn("PEER_ZERO_FILLED_OR_MISSING_BYTES",
                      compare_records(base(), p, "EPK_MATCH")["flags"])
    def test_axis_max_guess_rejected(self):
        p = candidate(); p["axis_count_from_maximum"] = True
        self.assertIn("PEER_ASSUMED_MAX_AXIS_LENGTH",
                      compare_records(base(), p, "EPK_MATCH")["flags"])
    def test_endian_difference_detected(self):
        p = candidate(); p["axis_x_raw"] = [25600, 51200]
        self.assertIn("MISMATCH_AXIS_X_RAW", compare_records(base(), p, "EPK_MATCH")["flags"])
    def test_baseline_unsupported_stays_unsupported(self):
        t = base(); t["status"] = "UNSUPPORTED"
        self.assertIn("TRIMIND_NOT_STRUCTURE_VALID",
                      compare_records(t, candidate(), "EPK_MATCH")["flags"])
    def test_source_provenance_required(self):
        p = candidate(); p.pop("has_explicit_source_provenance")
        self.assertIn("PEER_PROVENANCE_UNVERIFIED",
                      compare_records(base(), p, "EPK_MATCH")["flags"])
    def test_no_peer_is_not_a_success(self):
        self.assertEqual(compare_records(base(), None, "EPK_MATCH")["status"], "NO_PEER_RESULT")
    def test_promotion_forbidden(self):
        with self.assertRaises(PermissionError): use_peer_to_upgrade_trimind()

if __name__ == "__main__":
    unittest.main()
