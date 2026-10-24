# Arduino UNO Q — LED matrix reference

Board on our USB: Arduino UNO Q 4GB (`2341:0078`, serial `2101334233`, Debian 13, App Lab CLI v0.6.6).

## Hardware

- 8 rows x 13 columns = 104 blue LEDs, single colour.
- Driven by the STM32 microcontroller (MCU side), not the Linux side.
- Charlieplexed on GPIO `PF0`–`PF10` (11 lines for 104 LEDs), so the pins are not in the normal Arduino pin map.
- 8 hardware brightness levels (3-bit grayscale, done with PWM in an interrupt).

## Library: `Arduino_LED_Matrix`

Ships with the Zephyr core on the board:
`~/.arduino15/packages/arduino/hardware/zephyr/0.51.0/libraries/Arduino_LED_Matrix/src/Arduino_LED_Matrix.h`

| Call | What it does |
|---|---|
| `matrix.begin()` / `matrix.end()` | Start / stop the matrix driver |
| `matrix.setGrayscaleBits(n)` | Input range is `2^n` levels (1 = on/off, 3 = 0..7, 8 = 0..255; mapped to 8 hardware levels) |
| `matrix.draw(uint8_t buf[104])` | Show one frame, row-major, one byte per LED |
| `matrix.loadFrame(const uint32_t f[4])` | Show one packed 1-bit frame (format used by the App Lab examples) |
| `matrix.playVideo(buf, len)` | Play a grayscale frame sequence (see `examples/Video`) |
| `matrix.clear()` | All off |

Static picture:

```cpp
#include <Arduino_LED_Matrix.h>

uint8_t logo[104] = {
  0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,1,1,1,0,0,0,1,1,1,0,0,
  0,1,0,0,0,1,0,1,0,0,0,1,0,
  1,0,0,0,0,0,1,0,0,1,0,0,1,
  1,0,1,1,1,0,1,0,1,1,1,0,1,
  1,0,0,0,0,0,1,0,0,1,0,0,1,
  0,1,0,0,0,1,0,1,0,0,0,1,0,
  0,0,1,1,1,0,0,0,1,1,1,0,0
};

Arduino_LED_Matrix matrix;

void setup() {
  matrix.begin();
  matrix.setGrayscaleBits(1);
  matrix.draw(logo);
}

void loop() {}
```

## Text and scrolling

Text needs the separate **ArduinoGraphics** library. When `ArduinoGraphics.h` is included *before* `Arduino_LED_Matrix.h`, the matrix class inherits from `ArduinoGraphics` and gains `text()`, `print()`, fonts and scrolling.

**ArduinoGraphics is NOT installed on our board** (checked the core's `libraries/` folder). Installing it from App Lab has known problems (forum thread below). Options:

1. Copy the library onto the board over adb (it is plain source: <https://github.com/arduino-libraries/ArduinoGraphics>).
2. Skip it: render text to 104-byte frames ourselves (a small 5x7 font in the sketch, or rendered in Python on the Linux side and sent over `Bridge`).

Scrolling a name with ArduinoGraphics:

```cpp
#include <ArduinoGraphics.h>   // must come first
#include <Arduino_LED_Matrix.h>

Arduino_LED_Matrix matrix;

void setup() {
  matrix.begin();
  matrix.textFont(Font_5x7);
  matrix.textScrollSpeed(80);   // ms per pixel step
  matrix.clear();
}

void loop() {
  matrix.beginText(0, 1, 127, 0, 0);   // x, y, colour (any non-zero = on)
  matrix.print("  HUKAM  ");
  matrix.endText(SCROLL_LEFT);         // blocks until the scroll finishes
  delay(300);
}
```

Fonts: `Font_4x6`, `Font_5x7`. A 5x7 font fits about 2 characters at once on 13 columns, so anything longer must scroll. `endText(SCROLL_LEFT)` blocks `loop()`. If the sketch must also serve `Bridge` calls, run the scroll on a Zephyr thread (see KurtE's sketch in the forum thread).

## Driving it from Linux (Python side)

App Lab apps pair `python/main.py` (Linux) with `sketch/sketch.ino` (MCU). The sketch exposes or calls functions over `Arduino_RouterBridge`. Pattern from `examples:air-quality-monitoring`:

```cpp
#include <Arduino_RouterBridge.h>
// ...
String value;
bool ok = Bridge.call("get_air_quality").result(value);
```

So a WhatsApp/Gemma message can reach Python, then go over Bridge to the sketch, which scrolls the text.

On-board examples that use the matrix: `blink`, `air-quality-monitoring`, `weather-forecast`, `keyword-spotting`
(`~/.local/share/arduino-app-cli/examples/<name>/sketch/`).

## Sources

- UNO Q user manual, LED Matrix section: <https://docs.arduino.cc/tutorials/uno-q/user-manual/>
- Text on the UNO Q LED matrix (Harry Fairhead, wiring and grayscale detail): <https://www.i-programmer.info/programming/148-hardware/18620-uno-q-in-c-text-on-the-led-matrix.html>
- Forum, scrolling text and ArduinoGraphics install issue: <https://forum.arduino.cc/t/i-would-like-to-display-a-text-on-arduino-uno-q-led-matrix/1422847>
- KurtE's UNO Q apps (scrolling weather): <https://github.com/KurtE/Arduino_UNO_Q>
