"""Regression tests for degraded-mode detection when optional ML artifacts are absent."""
import unittest

from modules.scam_detector import predict_scam
from modules.fake_news_detector import check_news


class RuleFallbackTests(unittest.TestCase):
    def test_scam_detector_uses_explicit_rule_fallback(self):
        result = predict_scam(
            "URGENT your KYC will be blocked, share OTP to verify account",
            {},
        )
        self.assertNotEqual(result.get("label"), "ERROR")
        self.assertEqual(result.get("detection_mode"), "rule_based_fallback")
        self.assertGreaterEqual(result.get("confidence", 0), 50)
        self.assertIn("rule-based fallback", result.get("reason", ""))

    def test_fake_news_detector_uses_explicit_rule_fallback(self):
        result = check_news(
            "Free Rs 5000 for all citizens, claim now and forward this to 10 people",
            {},
        )
        self.assertNotEqual(result.get("label"), "ERROR")
        self.assertEqual(result.get("detection_mode"), "rule_based_fallback")
        self.assertGreaterEqual(result.get("confidence", 0), 50)
        self.assertIn("rule-based fallback", result.get("reason", ""))

    def test_forwarding_alone_is_not_labeled_as_proven_false(self):
        result = check_news("Please forward this message to your family group", {})
        self.assertEqual(result.get("detection_mode"), "rule_based_fallback")
        self.assertLess(result.get("confidence", 100), 40)
        self.assertIn("not proof of falsity", result.get("reason", ""))


if __name__ == "__main__":
    unittest.main()
