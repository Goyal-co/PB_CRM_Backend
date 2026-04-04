import json
import re
from pathlib import Path


def main() -> None:
    transcript_path = Path(
        r"C:\Users\chait\.cursor\projects\f-forgemanargerx-main-PB-CRM-Backend\agent-transcripts"
        r"\f38255c0-1994-4313-b2e4-8f3a029dd077\f38255c0-1994-4313-b2e4-8f3a029dd077.jsonl"
    )
    out_path = Path(__file__).resolve().parents[1] / "tmp_agreement_template_update.sql"

    pattern = re.compile(r"update\s+public\.agreement_templates", re.IGNORECASE)

    found_text: str | None = None
    found_line: int | None = None

    with transcript_path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            try:
                obj = json.loads(line)
            except Exception:
                continue

            for block in obj.get("message", {}).get("content", []) or []:
                if block.get("type") != "text":
                    continue
                text = block.get("text") or ""
                if pattern.search(text):
                    found_text = text
                    found_line = line_no
                    break

            if found_text is not None:
                break

    if found_text is None:
        raise SystemExit("No agreement_templates update SQL found in transcript.")

    out_path.write_text(found_text, encoding="utf-8")
    print(f"Extracted transcript line: {found_line}")
    print(f"Wrote: {out_path}")
    print(f"Chars: {len(found_text)}")


if __name__ == "__main__":
    main()

