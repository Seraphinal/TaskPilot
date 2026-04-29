import sys


def main() -> int:
    print("[fail] this script will exit with code 2", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

