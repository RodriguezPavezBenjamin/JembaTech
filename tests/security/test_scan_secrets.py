"""Prueba el coordinador Bash con ejecutables simulados, sin red ni credenciales."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'scan-secrets.sh'


class SecretScanTests(unittest.TestCase):
    def run_scan(self, mode, head='a' * 40, base='b' * 40):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scratch = root / 'scratch'
            scratch.mkdir()
            (root / 'git').write_text('''#!/usr/bin/env bash
if [[ "$MOCK_MODE" == bad-ref ]]; then exit 1; fi
printf '%s\\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
''')
            (root / 'docker').write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$SCAN_TRACE"
printf '%s\\n' 'PRIVATE_SCANNER_DIAGNOSTIC' >&2
if [[ "$MOCK_MODE" == scanner-error ]]; then exit 125; fi
if [[ "$MOCK_MODE" == historical || "$MOCK_MODE" == new-finding ]]; then
  printf '%s\\n' '{"Raw":"PRIVATE_SCANNER_MARKER"}'
  exit 183
fi
exit 0
''')
            (root / 'node').write_text('''#!/usr/bin/env bash
printf 'gate-status=%s\\n' "$3" >> "$SCAN_TRACE"
if [[ "$MOCK_MODE" == scanner-error || "$MOCK_MODE" == new-finding ]]; then exit 1; fi
exit 0
''')
            for executable in ('git', 'docker', 'node'):
                (root / executable).chmod(0o755)
            trace = root / 'trace'
            result = subprocess.run(
                ['bash', str(SCRIPT)], cwd=root, capture_output=True, text=True,
                env={**os.environ, 'PATH': f'{root}:{os.environ["PATH"]}',
                     'TMPDIR': str(scratch), 'MOCK_MODE': mode, 'SCAN_TRACE': str(trace),
                     'SECRET_SCAN_HEAD': head, 'SECRET_SCAN_BASE': base}, timeout=10,
            )
            self.assertEqual(list(scratch.iterdir()), [])
            self.assertNotIn('PRIVATE_SCANNER', result.stdout + result.stderr)
            return result.returncode, trace.read_text() if trace.exists() else ''

    def test_clean_range_uses_pinned_image_and_keeps_controls(self):
        status, trace = self.run_scan('clean')
        self.assertEqual(status, 0)
        self.assertIn('@sha256:47a84bc18a0d04a165498bbbd3bacfd84176661cbc91f8e0f85467f6a771e99a', trace)
        self.assertIn('--fail-on-scan-errors', trace)
        self.assertIn('--no-ignore-tag', trace)
        self.assertIn('--results=verified,unknown', trace)
        self.assertNotIn('--exclude', trace)
        self.assertIn('--since-commit', trace)
        self.assertIn('gate-status=0', trace)

    def test_historical_candidates_reach_gate_without_raw_logs(self):
        status, trace = self.run_scan('historical')
        self.assertEqual(status, 0)
        self.assertIn('gate-status=183', trace)

    def test_new_finding_and_scanner_error_block(self):
        for mode in ('new-finding', 'scanner-error'):
            status, _ = self.run_scan(mode)
            self.assertEqual(status, 1)

    def test_bad_refs_fail_before_scanner(self):
        for mode, head in [('clean', 'not-a-sha'), ('bad-ref', 'a' * 40)]:
            status, trace = self.run_scan(mode, head=head)
            self.assertNotEqual(status, 0)
            self.assertEqual(trace, '')

    def test_initial_push_or_manual_run_can_scan_full_history(self):
        for base in ['', '0' * 40]:
            status, trace = self.run_scan('clean', base=base)
            self.assertEqual(status, 0)
            self.assertNotIn('--since-commit', trace)


if __name__ == '__main__':
    unittest.main()
