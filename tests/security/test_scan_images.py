"""Prueba el script Bash sin Docker real, red ni imágenes."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'scan-images.sh'


class ImageGateTests(unittest.TestCase):
    def run_gate(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / 'docker'
            docker.write_text('''#!/usr/bin/env bash
service="${@: -1}"
if [[ "$MOCK_MODE" == missing && "$service" == backend ]]; then exit 0; fi
printf 'sha256:qa-%s\n' "$service"
''')
            trivy = root / 'trivy'
            trivy.write_text('''#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SCAN_TRACE"
if [[ "$MOCK_MODE" == scanner-error && "$*" == *"--format json"* && "$*" == *qa-backend ]]; then exit 2; fi
if [[ "$MOCK_MODE" == high && "$*" == *"--severity HIGH "* && "$*" == *qa-backend ]]; then exit 1; fi
if [[ "$MOCK_MODE" == critical-unfixed && "$*" == *"--severity CRITICAL "* && "$*" != *"--ignore-unfixed"* && "$*" == *qa-backend ]]; then exit 1; fi
exit 0
''')
            for executable in (docker, trivy):
                executable.chmod(0o755)
            trace = root / 'trace'
            result = subprocess.run(
                ['bash', str(SCRIPT)], cwd=root, capture_output=True, text=True,
                env={**os.environ, 'PATH': f'{root}:{os.environ["PATH"]}',
                     'MOCK_MODE': mode, 'SCAN_TRACE': str(trace)}, timeout=10,
            )
            return result.returncode, trace.read_text() if trace.exists() else ''

    def test_clean_images_pass_and_full_report_precedes_gate(self):
        status, trace = self.run_gate('clean')
        self.assertEqual(status, 0)
        self.assertEqual(len(trace.splitlines()), 15)
        self.assertNotIn('--ignore-unfixed', trace.splitlines()[0])
        self.assertIn('--severity CRITICAL ', trace.splitlines()[1])
        self.assertNotIn('--ignore-unfixed', trace.splitlines()[1])
        self.assertIn('--severity HIGH ', trace.splitlines()[2])
        self.assertIn('--ignore-unfixed', trace.splitlines()[2])

    def test_high_blocks_but_still_scans_other_services(self):
        status, trace = self.run_gate('high')
        self.assertEqual(status, 1)
        self.assertIn('qa-database', trace)

    def test_critical_without_patch_blocks_and_scan_continues(self):
        status, trace = self.run_gate('critical-unfixed')
        self.assertEqual(status, 1)
        self.assertIn('qa-database', trace)
        self.assertEqual(len(trace.splitlines()), 15)

    def test_scanner_failure_is_not_clean(self):
        status, trace = self.run_gate('scanner-error')
        self.assertEqual(status, 1)
        self.assertIn('qa-database', trace)
        self.assertEqual(len(trace.splitlines()), 13)

    def test_missing_image_blocks(self):
        status, trace = self.run_gate('missing')
        self.assertEqual(status, 1)
        self.assertNotIn('qa-backend', trace)


if __name__ == '__main__':
    unittest.main()
