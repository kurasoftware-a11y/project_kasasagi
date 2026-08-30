from pathlib import Path
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ARTWORKS = ASSETS / "artworks"
OG_SOURCE = ASSETS / "og-supica-kasasagi.png"


def save_webp(source: Path, destination: Path, width: int | None = None) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        if width and image.width != width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=84, method=6, optimize=True)


save_webp(ASSETS / "supica-portrait.png", ASSETS / "supica-portrait.webp")

for source in sorted(ARTWORKS.glob("*.png")):
    save_webp(source, source.with_suffix(".webp"))
    save_webp(source, source.with_name(f"{source.stem}-640.webp"), width=640)

with Image.open(ARTWORKS / "008.png") as artwork:
    artwork = artwork.convert("RGB")
    artwork.resize((32, 32), Image.Resampling.LANCZOS).save(
        ASSETS / "favicon-32.png", "PNG", optimize=True
    )
    artwork.resize((180, 180), Image.Resampling.LANCZOS).save(
        ASSETS / "apple-touch-icon.png", "PNG", optimize=True
    )

if not OG_SOURCE.exists():
    raise FileNotFoundError(f"OG image source not found: {OG_SOURCE}")

with Image.open(OG_SOURCE) as og_image:
    og_image = og_image.convert("RGB")
    og_image = ImageOps.fit(
        og_image,
        (1200, 630),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    og_image.save(ASSETS / "og-supica-kasasagi.png", "PNG", optimize=True)

print("Optimized portrait, artwork, icons, and social preview images.")
