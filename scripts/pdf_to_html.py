from __future__ import annotations

from pathlib import Path

from pdfminer.converter import HTMLConverter
from pdfminer.layout import LAParams
from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
from pdfminer.pdfpage import PDFPage


def pdf_to_html(pdf_path: Path, out_html: Path) -> None:
    rsrcmgr = PDFResourceManager()
    laparams = LAParams()

    out_html.parent.mkdir(parents=True, exist_ok=True)
    with out_html.open("wb") as out_fp:
        device = HTMLConverter(
            rsrcmgr,
            out_fp,
            laparams=laparams,
            codec="utf-8",
            scale=1.0,
            layoutmode="exact",
        )
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        with pdf_path.open("rb") as in_fp:
            for page in PDFPage.get_pages(in_fp):
                interpreter.process_page(page)
        device.close()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    pdf_path = root / "Propforma ATS Orchid Life.pdf"
    out_html = root / "tmp_propforma_ats_orchid_life.html"

    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    pdf_to_html(pdf_path, out_html)
    print(f"Wrote: {out_html}")
    print(f"Bytes: {out_html.stat().st_size}")


if __name__ == "__main__":
    main()

