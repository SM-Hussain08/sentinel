from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

VERSION_FILE = ROOT / "VERSION"
BACKEND_VERSION_FILE = ROOT / "backend" / "app" / "version.py"
FRONTEND_PACKAGE_FILE = ROOT / "frontend" / "package.json"
FRONTEND_LOCK_FILE = ROOT / "frontend" / "package-lock.json"

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)\."
    r"(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z.-]+)?"
    r"(?:\+[0-9A-Za-z.-]+)?$"
)


def fail(message: str) -> None:
    print(f"Release version validation: FAIL - {message}")
    raise SystemExit(1)


def read_repository_version() -> str:
    if not VERSION_FILE.is_file():
        fail("VERSION file is missing")

    version = VERSION_FILE.read_text().strip()

    if not version:
        fail("VERSION file is empty")

    if not SEMVER_PATTERN.fullmatch(version):
        fail(
            f"VERSION is not valid Semantic Versioning: {version!r}"
        )

    return version


def read_backend_version() -> str:
    if not BACKEND_VERSION_FILE.is_file():
        fail("backend/app/version.py is missing")

    text = BACKEND_VERSION_FILE.read_text()

    match = re.search(
        r'^SENTINEL_VERSION\s*=\s*"([^"]+)"\s*$',
        text,
        flags=re.MULTILINE,
    )

    if match is None:
        fail(
            "SENTINEL_VERSION assignment not found in "
            "backend/app/version.py"
        )

    return match.group(1)


def read_frontend_versions() -> tuple[str, str, str]:
    try:
        package = json.loads(
            FRONTEND_PACKAGE_FILE.read_text()
        )
        lock = json.loads(
            FRONTEND_LOCK_FILE.read_text()
        )
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"could not read frontend package metadata: {exc}")

    package_version = package.get("version")
    lock_version = lock.get("version")

    packages = lock.get("packages")
    if not isinstance(packages, dict):
        fail("package-lock.json is missing packages metadata")

    root_package = packages.get("")
    if not isinstance(root_package, dict):
        fail(
            "package-lock.json is missing root package metadata"
        )

    lock_root_version = root_package.get("version")

    for name, value in (
        ("frontend/package.json", package_version),
        ("frontend/package-lock.json root", lock_version),
        (
            "frontend/package-lock.json packages['']",
            lock_root_version,
        ),
    ):
        if not isinstance(value, str) or not value:
            fail(f"{name} does not contain a valid version string")

    return (
        package_version,
        lock_version,
        lock_root_version,
    )


def main() -> int:
    repository_version = read_repository_version()
    backend_version = read_backend_version()

    (
        frontend_version,
        lock_version,
        lock_root_version,
    ) = read_frontend_versions()

    versions = {
        "VERSION": repository_version,
        "backend/app/version.py": backend_version,
        "frontend/package.json": frontend_version,
        "frontend/package-lock.json": lock_version,
        "frontend/package-lock.json packages['']": (
            lock_root_version
        ),
    }

    mismatches = {
        name: value
        for name, value in versions.items()
        if value != repository_version
    }

    if mismatches:
        print("Release version validation: FAIL")
        print(
            f"Canonical repository version: "
            f"{repository_version}"
        )

        for name, value in mismatches.items():
            print(
                f"Mismatch: {name} = {value}"
            )

        return 1

    print("Release version validation: PASS")
    print(
        f"Canonical SENTINEL version: "
        f"{repository_version}"
    )

    for name, value in versions.items():
        print(f"  {name}: {value}")

    print(
        f"Expected Git release tag: "
        f"v{repository_version}"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
