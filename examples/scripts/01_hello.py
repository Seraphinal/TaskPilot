import datetime
import os
import sys


def main() -> int:
    now = datetime.datetime.now().isoformat(timespec="seconds")
    print(f"[hello] time={now}")
    print(f"[hello] cwd={os.getcwd()}")
    print(f"[hello] python={sys.executable}")
    print(f"[hello] argv={sys.argv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

