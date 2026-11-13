import subprocess
import sys
from pathlib import Path
from django.test import SimpleTestCase


class ProcessLimitTests(SimpleTestCase):
    def test_parser_memory_ceiling_rejects_large_allocation(self):
        code = "from cvbuilder.process_limits import limit_memory\nlimit_memory(96)\ntry:\n data=bytearray(256*1024*1024)\nexcept MemoryError:\n print('limited')\n"
        result = subprocess.run([sys.executable, '-c', code], capture_output=True, timeout=10,
                                cwd=Path(__file__).resolve().parent.parent)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertEqual(result.stdout.strip(), b'limited')
