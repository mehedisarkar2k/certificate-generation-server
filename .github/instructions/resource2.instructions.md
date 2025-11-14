Below is a **complete, ready-to-run Python solution** that satisfies every bullet you listed:

- **Template** – an **image** (PNG/JPG) that you upload once.
- **Dynamic text** – the script detects where the text should go (you click a few points on the image the first time) and stores those coordinates for future reuse.
- **Bulk data** – a **CSV** file (name, date, course, …).
- **Output** – one **PDF** per row (or a single multi-page PDF).
- **Re-usability** – the coordinates are saved in a tiny JSON file next to the template, so the next run needs only the CSV.

---

## 1. Folder layout

```
cert-gen/
│
├─ templates/
│   └─ cert_template.png          # <-- user uploads the image here
│
├─ data/
│   └─ participants.csv           # <-- user uploads the CSV here
│
├─ output/                        # <-- generated PDFs appear here
│
└─ generate_certificates.py       # <-- the script (copy-paste below)
```

---

## 2. Install the required libraries (once)

```bash
pip install pillow pandas reportlab opencv-python
```

- `Pillow` – draw text on the image
- `pandas` – read CSV
- `reportlab` – create PDF from the final image
- `opencv-python` – optional interactive coordinate picker (you can also edit JSON manually)

---

## 3. The **CSV** format (example)

```csv
name,date,course,serial
John Doe,2025-11-14,Python Mastery,001
Jane Smith,2025-11-14,Data Science,002
```

_Any column you put in the CSV can be used in the template_ – just reference it in the JSON (see step 5).

---

## 4. The **Python script** – `generate_certificates.py`

```python
#!/usr/bin/env python3
import os
import json
import argparse
from pathlib import Path

import cv2
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape, portrait

# ----------------------------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------------------------
TEMPLATE_DIR = Path("templates")
DATA_DIR = Path("data")
OUTPUT_DIR = Path("output")
COORD_FILE_EXT = ".coords.json"      # saved next to template image
FONT_PATH = "arial.ttf"              # change if you have another TTF
FONT_SIZE = 48
TEXT_COLOR = (0, 0, 0)               # black
PDF_PAGE_SIZE = portrait(A4)         # change to landscape(A4) if needed

# ----------------------------------------------------------------------
def pick_coordinates(image_path: Path) -> dict:
    """Interactive OpenCV clicker – returns dict {field: (x, y)}"""
    img = cv2.imread(str(image_path))
    if img is None:
        raise FileNotFoundError(image_path)

    fields = []
    coords = {}

    def click(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            field = f"field{len(coords)+1}"
            coords[field] = (x, y)
            cv2.circle(img_copy, (x, y), 5, (0, 255, 0), -1)
            cv2.putText(img_copy, field, (x + 10, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            cv2.imshow("Pick points – press ANY key when done", img_copy)

    print("Click the exact spot for EACH piece of text (name, date, …).")
    print("Close the window when finished.")
    img_copy = img.copy()
    cv2.namedWindow("Pick points – press ANY key when done")
    cv2.setMouseCallback("Pick points – press ANY key when done", click)
    cv2.imshow("Pick points – press ANY key when done", img_copy)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    # ask user to name the fields
    for i, (field, (x, y)) in enumerate(coords.items(), 1):
        name = input(f"Field {i} at ({x},{y}) – CSV column name? ").strip()
        if name:
            coords[name] = coords.pop(field)

    return coords


# ----------------------------------------------------------------------
def load_or_create_coords(template_path: Path) -> dict:
    coord_file = template_path.with_suffix(COORD_FILE_EXT)
    if coord_file.exists():
        print(f"Loading saved coordinates from {coord_file.name}")
        return json.loads(coord_file.read_text())
    else:
        print("No coordinate file found – starting interactive picker.")
        coords = pick_coordinates(template_path)
        coord_file.write_text(json.dumps(coords, indent=2))
        print(f"Saved coordinates to {coord_file.name}")
        return coords


# ----------------------------------------------------------------------
def draw_certificate(template_path: Path, row: pd.Series, coords: dict) -> Image.Image:
    img = Image.open(template_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    except IOError:
        font = ImageFont.load_default()

    for csv_col, (x, y) in coords.items():
        text = str(row.get(csv_col, ""))
        # auto-shrink if too wide
        w, _ = draw.textsize(text, font=font)
        while w > 600 and FONT_SIZE > 12:   # safety limit
            FONT_SIZE -= 2
            font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
            w, _ = draw.textsize(text, font=font)

        draw.text((x, y), text, font=font, fill=TEXT_COLOR)
    return img


# ----------------------------------------------------------------------
def image_to_pdf(img: Image.Image, pdf_path: Path):
    c = canvas.Canvas(str(pdf_path), pagesize=PDF_PAGE_SIZE)
    img_width, img_height = img.size

    # fit image to PDF page (keep aspect ratio)
    pdf_width, pdf_height = PDF_PAGE_SIZE
    ratio = min(pdf_width / img_width, pdf_height / img_height)
    new_w = img_width * ratio
    new_h = img_height * ratio
    c.drawImage(img.convert("RGB"), (pdf_width - new_w) / 2,
                (pdf_height - new_h) / 2, width=new_w, height=new_h)
    c.showPage()
    c.save()


# ----------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Bulk certificate generator")
    parser.add_argument("--template", required=True, help="filename inside templates/ (e.g. cert.png)")
    parser.add_argument("--csv", required=True, help="filename inside data/ (e.g. participants.csv)")
    parser.add_argument("--single-pdf", action="store_true",
                        help="Combine all certs into ONE multi-page PDF")
    args = parser.parse_args()

    template_path = TEMPLATE_DIR / args.template
    csv_path = DATA_DIR / args.csv
    if not template_path.exists():
        raise FileNotFoundError(template_path)
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    # 1. Load (or create) coordinate map
    coords = load_or_create_coords(template_path)

    # 2. Read CSV
    df = pd.read_csv(csv_path)

    # 3. Ensure output folder
    OUTPUT_DIR.mkdir(exist_ok=True)

    if args.single_pdf:
        pdf_path = OUTPUT_DIR / f"{template_path.stem}_all.pdf"
        c = canvas.Canvas(str(pdf_path), pagesize=PDF_PAGE_SIZE)
    else:
        c = None

    for idx, row in df.iterrows():
        cert_img = draw_certificate(template_path, row, coords)

        if args.single_pdf:
            # embed image into open canvas
            img_w, img_h = cert_img.size
            pdf_w, pdf_h = PDF_PAGE_SIZE
            ratio = min(pdf_w / img_w, pdf_h / img_h)
            new_w = img_w * ratio
            new_h = img_h * ratio
            c.drawImage(cert_img.convert("RGB"),
                        (pdf_w - new_w) / 2, (pdf_h - new_h) / 2,
                        width=new_w, height=new_h)
            c.showPage()
        else:
            out_pdf = OUTPUT_DIR / f"{row.get('serial', idx+1)}_{row.get('name', 'cert')}.pdf"
            out_pdf = out_pdf.with_suffix(".pdf")
            image_to_pdf(cert_img, out_pdf)
            print(f"→ {out_pdf.name}")

    if args.single_pdf:
        c.save()
        print(f"→ {pdf_path.name} (multi-page)")

# ----------------------------------------------------------------------
if __name__ == "__main__":
    main()
```

---

## 5. First-time **template setup** (one-click)

```bash
python generate_certificates.py --template cert_template.png --csv participants.csv
```

- A window opens → **click** exactly where each piece of text belongs.
- After you close the window, type the **CSV column name** for each click (e.g. `name`, `date`, `course`).
- The script saves `cert_template.png.coords.json` – you’ll never need to click again.

**Example `cert_template.png.coords.json`**

```json
{
  "name": [450, 320],
  "date": [460, 420],
  "course": [440, 520]
}
```

---

## 6. Subsequent runs (fully automatic)

```bash
python generate_certificates.py --template cert_template.png --csv participants.csv
```

_or combine everything into one PDF_

```bash
python generate_certificates.py --template cert_template.png --csv participants.csv --single-pdf
```

---
