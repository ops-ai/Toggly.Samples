"""Exercise the actual live runner's fail-closed entry point without credentials."""
import os
import subprocess
import sys
import unittest


class LiveGuards(unittest.TestCase):
    def run_guard(self, opt_in):
        env = {key: value for key, value in os.environ.items() if not key.startswith("TOGGLY_")}
        if opt_in:
            env["TOGGLY_LIVE_ACCEPTANCE"] = "1"
        result = subprocess.run(sys.argv[1:], env=env, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("configuration-required", result.stdout)
        self.assertNotIn("Unhandled", result.stderr)

    def test_requires_explicit_opt_in(self):
        self.run_guard(False)

    def test_requires_real_key_after_opt_in(self):
        self.run_guard(True)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]])
