"""Real-PTY regressions for the terminal harness, independent of the SDK."""

import contextlib
import io
import os
import signal
import sys
import termios
import unittest
from unittest import mock

import console_terminal as harness


class TerminalReadinessTests(unittest.TestCase):
    def test_eof_waits_for_delayed_reader_input_mode(self):
        # A menu is output readiness, not input readiness. This child deliberately
        # leaves its real PTY canonical before enabling byte-at-a-time reading.
        child = """
import os, time, tty
print("r Refresh | q Quit", flush=True)
time.sleep(0.2)
tty.setraw(0)
assert os.read(0, 1) == b"\\x04"
"""
        real_execvp, real_write = os.execvp, os.write
        sent = []

        def exec_child(_file, _args):
            real_execvp(sys.executable, [sys.executable, "-c", child])

        def require_ready(master, command):
            self.assertFalse(
                termios.tcgetattr(master)[3] & termios.ICANON,
                "EOF was sent while the delayed reader was still canonical",
            )
            sent.append(command)
            return real_write(master, command)

        with mock.patch.object(harness.os, "execvp", exec_child), mock.patch.object(
            harness.os, "write", require_ready
        ), contextlib.redirect_stdout(io.StringIO()):
            harness.terminal_case(sys.executable, "delayed EOF", [(b"\x04", None)])
        self.assertEqual(sent, [b"\x04"])

    def test_reader_readiness_timeout_kills_and_reaps_only_owned_child(self):
        child = """
import time
print("r Refresh | q Quit", flush=True)
time.sleep(30)
"""
        real_execvp, real_kill = os.execvp, os.kill
        killed = []

        def exec_child(_file, _args):
            real_execvp(sys.executable, [sys.executable, "-c", child])

        def record_kill(pid, sig):
            killed.append((pid, sig))
            return real_kill(pid, sig)

        with mock.patch.object(harness.os, "execvp", exec_child), mock.patch.object(
            harness.os, "kill", record_kill
        ), mock.patch.object(harness, "INPUT_READY_TIMEOUT", 0.05):
            with self.assertRaisesRegex(AssertionError, "terminal input mode not ready"):
                harness.terminal_case(sys.executable, "stalled reader", [(b"\x04", None)])
        self.assertEqual(len(killed), 1)
        self.assertEqual(killed[0][1], signal.SIGKILL)
        with self.assertRaises(ChildProcessError):
            os.waitpid(killed[0][0], os.WNOHANG)


if __name__ == "__main__":
    unittest.main()
