# Web page -> LED matrix.
#
# Serves assets/index.html on port 7000. The page POSTs text to /api/text,
# we clean it up and hand it to the sketch with Bridge.call("set_text", ...).
# The sketch font (sketch/glyphs.h) is parsed here too, so the page preview
# draws exactly what the board draws.

import re

from arduino.app_utils import App, Bridge, Logger
from arduino.app_bricks.web_ui import WebUI

logger = Logger("text-matrix")

GLYPHS_H = "/app/sketch/glyphs.h"
MAX_LEN = 60  # sketch buffer is 64 bytes
DEFAULT_TEXT = "HACKTOBERFEST HACK DAY LAHORE X CNSPK IS LIVE"  # keep in sync with currentText in sketch.ino


def _rows(block: str) -> list[str]:
    return re.findall(r'"([.#]+)"', block)


def load_font() -> dict:
    """Parse BIG glyphs and both heart bitmaps out of glyphs.h."""
    try:
        with open(GLYPHS_H) as f:
            src = f.read()
    except OSError as e:
        logger.warning(f"font not loaded, preview disabled: {e}")
        return {"glyphs": {}, "heart": [], "heartSmall": []}

    big = src[src.index("BIG[]") : src.index("BIG_COUNT")]
    glyphs = {}
    for ch, block in re.findall(r"\{'(\\'|[^'])', \d+, \{([^}]*)\}", big):
        glyphs[ch.replace("\\'", "'")] = _rows(block)

    def bitmap(name: str) -> list[str]:
        start = src.index(name + "[")
        return _rows(src[start : src.index("};", start)])

    return {
        "glyphs": glyphs,
        "heart": bitmap("HEART_BIG"),
        "heartSmall": bitmap("HEART_SMALL"),
    }


FONT = load_font()
SUPPORTED = set(FONT["glyphs"]) | {" "}
current_text = DEFAULT_TEXT


def clean(text: str) -> str:
    text = text.upper()
    if FONT["glyphs"]:
        text = "".join(c for c in text if c in SUPPORTED)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_LEN]


def get_state():
    return {"text": current_text, "maxLength": MAX_LEN, **FONT}


def set_text(text: str = ""):
    global current_text
    cleaned = clean(text)
    if not cleaned:
        return {"ok": False, "error": "Type at least one letter or number."}
    try:
        Bridge.call("set_text", cleaned)
    except Exception as e:
        logger.error(f"Bridge.call(set_text) failed: {e}")
        return {"ok": False, "error": "The board did not answer. Is the sketch running?"}
    current_text = cleaned
    logger.info(f"showing: {cleaned}")
    return {"ok": True, "text": cleaned}


ui = WebUI()
ui.expose_api("GET", "/api/state", get_state)
ui.expose_api("POST", "/api/text", set_text)

App.run()
