"""Exercise the built console in a real terminal; no App Key or SDK substitute."""

import argparse
import errno
import os
from pathlib import Path
import pty
import select
import signal
import time


MENU = b"r Refresh | q Quit"


def terminal_case(dotnet, name, inputs):
    pid, master = pty.fork()
    if pid == 0:
        os.environ["TOGGLY_APP_KEY"] = ""
        os.environ["TOGGLY_SNAPSHOT_DIRECTORY"] = ""
        os.execvp(dotnet, [dotnet, "Console/bin/Release/net8.0/Console.dll"])

    output = bytearray()
    reaped = False

    def read_available(timeout):
        if select.select([master], [], [], timeout)[0]:
            try:
                output.extend(os.read(master, 65536))
            except OSError as error:
                if error.errno != errno.EIO:
                    raise

    try:
        deadline = time.monotonic() + 10
        while MENU not in output:
            read_available(0.1)
            assert time.monotonic() < deadline, f"{name}: menu did not appear: {output!r}"
        for command, expected in inputs:
            output.clear()
            os.write(master, command)
            if expected:
                deadline = time.monotonic() + 5
                while expected not in output:
                    read_available(0.1)
                    assert time.monotonic() < deadline, (
                        f"{name}: missing {expected!r}: {output!r}"
                    )

        # A clean exit proves the main async path unwound without needing Enter
        # or a forced signal. The harness kills only its owned child on failure.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            read_available(0.05)
            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited:
                reaped = True
                assert os.waitstatus_to_exitcode(status) == 0, (
                    f"{name}: exit status {status}: {output!r}"
                )
                print(f"PASS {name}")
                return
        raise AssertionError(f"{name}: still running after 5 seconds: {output!r}")
    finally:
        if not reaped:
            os.kill(pid, signal.SIGKILL)
            os.waitpid(pid, 0)
        os.close(master)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dotnet", default="dotnet")
    args = parser.parse_args()
    os.chdir(Path(__file__).resolve().parents[1])
    terminal_case(args.dotnet, "idle Ctrl+C exits without Enter", [(b"\x03", None)])
    terminal_case(
        args.dotnet,
        "menu input and quit remain usable",
        [(b"n\n", MENU), (b"1\n", b"identity=bob"), (b"q\n", None)],
    )
    terminal_case(args.dotnet, "terminal EOF exits", [(b"\x04", None)])
