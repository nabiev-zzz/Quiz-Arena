from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import sys

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "index.html"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.local_assets = []
        self.title = False
        self.h1 = 0
        self.description = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta" and attrs.get("name") == "description" and attrs.get("content"):
            self.description = True
        for key in ("src", "href"):
            value = attrs.get(key, "")
            if not value or value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
                continue
            parsed = urlparse(value)
            if parsed.scheme or parsed.netloc or value.startswith("/"):
                continue
            if key == "src" or value.startswith("./"):
                self.local_assets.append(value.split("#", 1)[0].split("?", 1)[0])

parser = PageParser()
parser.feed(HTML.read_text(encoding="utf-8"))
errors = []
if not parser.title:
    errors.append("Missing page title")
if parser.h1 != 1:
    errors.append(f"Expected exactly one h1, found {parser.h1}")
if not parser.description:
    errors.append("Missing meta description")
for asset in parser.local_assets:
    target = (ROOT / asset).resolve()
    if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
        errors.append(f"Missing or unsafe local asset: {asset}")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"Landing page validation passed: title, description, one h1, {len(parser.local_assets)} local assets.")
