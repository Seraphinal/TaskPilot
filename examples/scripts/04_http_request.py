import argparse
import sys

import httpx


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="https://httpbin.org/get")
    args = p.parse_args()

    with httpx.Client(timeout=10) as client:
        r = client.get(args.url)
        print(f"[http] status={r.status_code}")
        print(r.text[:500])
        return 0 if r.status_code < 400 else 1


if __name__ == "__main__":
    raise SystemExit(main())

