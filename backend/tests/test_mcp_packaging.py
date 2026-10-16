"""Offline wheel regression check; requires the pyproject build dependencies.

Build from fresh sources so backend/build or egg-info cannot hide an omitted
module. Inspect the artifact and import its secret helper in an isolated Python
process without importing the backend, database, or production configuration.
"""

import configparser
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile


BACKEND = Path(__file__).resolve().parents[1]
REQUIRED_MODULES = {
    "planetary_agents_mcp_server.py",
    "alchm_mcp.py",
    "mcp_invocation_log.py",
    "database.py",
    "models.py",
    "secure_compare.py",
}


class MCPPackagingTests(unittest.TestCase):
    def test_clean_wheel_contains_required_server_modules(self):
        with tempfile.TemporaryDirectory(prefix="pa-mcp-wheel-") as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            source.mkdir()
            for path in [
                BACKEND / "pyproject.toml",
                BACKEND / "pa-mcp-README.md",
                *(BACKEND / name for name in sorted(REQUIRED_MODULES)),
            ]:
                shutil.copy2(path, source / path.name)

            built = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "from setuptools.build_meta import build_wheel; "
                    "build_wheel('dist')",
                ],
                cwd=source,
                text=True,
                capture_output=True,
                timeout=60,
            )
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            wheels = list((source / "dist").glob("*.whl"))
            self.assertEqual(len(wheels), 1, built.stdout)
            wheel = wheels[0]
            with ZipFile(wheel) as archive:
                modules = {name for name in archive.namelist() if name.endswith(".py")}
                self.assertEqual(modules, REQUIRED_MODULES)
                entry_points_path = next(
                    name for name in archive.namelist()
                    if name.endswith(".dist-info/entry_points.txt")
                )
                entry_points = configparser.ConfigParser()
                entry_points.read_string(archive.read(entry_points_path).decode("utf-8"))
                self.assertEqual(
                    entry_points["console_scripts"]["planetary-agents-mcp"],
                    "planetary_agents_mcp_server:run",
                )

            # -I ignores PYTHONPATH and the checkout. Loading directly from the
            # wheel proves secure_compare is shipped and works independently.
            imported = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "import sys; sys.path.insert(0, sys.argv[1]); "
                    "import secure_compare; "
                    "assert secure_compare.__loader__.archive == sys.argv[1]; "
                    "assert secure_compare.secret_matches('wheel-test', 'wheel-test'); "
                    "assert not secure_compare.secret_matches('wrong', 'wheel-test'); "
                    "assert not secure_compare.secret_matches('', ''); "
                    "assert 'database' not in sys.modules; "
                    "assert 'main' not in sys.modules",
                    str(wheel),
                ],
                cwd=root,
                text=True,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(imported.returncode, 0, imported.stdout + imported.stderr)


if __name__ == "__main__":
    unittest.main()
