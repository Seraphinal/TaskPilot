import argparse
import datetime
import json
import os
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="examples/output/artifact.json")
    args = p.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "time": datetime.datetime.now().isoformat(timespec="seconds"),
        "cwd": os.getcwd(),
        "message": "artifact written",
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[write] wrote {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

