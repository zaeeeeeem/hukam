// "ZAEEM GOAT" + heart on the Arduino UNO Q 8x13 LED matrix.
//
// Loop:
//   1. "ZAEEM GOAT" scrolls left with a motion-blur trail
//   2. a heart follows the text in and stops in the centre
//   3. the heart beats (lub-dub) with a ripple on each beat
//   4. the heart sparkles away, then the name starts again
//
// Older scenes (sparkle, helm, drop, badge) are kept below but not looped.
//
// No ArduinoGraphics: the font is our own and every frame is a 104-byte
// grayscale buffer passed to matrix.draw().

#include <Arduino_LED_Matrix.h>
#include <math.h>
#include <string.h>

#include "glyphs.h"

static const int W = 13;
static const int H = 8;
static const uint8_t MAX_B = 7;  // 3-bit grayscale: 0..7

Arduino_LED_Matrix matrix;
uint8_t fb[W * H];

// ---------- framebuffer helpers ----------

void show(uint16_t ms) {
  matrix.draw(fb);
  delay(ms);
}

void clearFb() { memset(fb, 0, sizeof(fb)); }

// Brightest value wins, so overlapping layers do not darken each other.
void px(int x, int y, int v) {
  if (x < 0 || x >= W || y < 0 || y >= H || v <= 0) return;
  if (v > MAX_B) v = MAX_B;
  uint8_t &p = fb[y * W + x];
  if (v > p) p = v;
}

void fade(uint8_t step) {
  for (uint8_t &p : fb) p = p > step ? p - step : 0;
}

// ---------- fonts ----------

const Glyph *findGlyph(const Glyph *font, size_t n, char c) {
  for (size_t i = 0; i < n; i++)
    if (font[i].c == c) return &font[i];
  return nullptr;
}

int drawGlyph(const Glyph *g, int rows, int x, int y, int v) {
  if (!g) return 3;  // unknown char: blank space
  for (int r = 0; r < rows; r++)
    for (int c = 0; c < g->w; c++)
      if (g->rows[r][c] == '#') px(x + c, y + r, v);
  return g->w;
}

// Returns the pixel width of the drawn text.
int drawBig(const char *s, int x, int y, int v) {
  int x0 = x;
  for (; *s; s++) x += drawGlyph(findGlyph(BIG, BIG_COUNT, *s), 7, x, y, v) + 1;
  return x - x0 - 1;
}

int drawSmall(const char *s, int x, int y, int v) {
  int x0 = x;
  for (; *s; s++) x += drawGlyph(findGlyph(SMALL, SMALL_COUNT, *s), 4, x, y, v) + 1;
  return x - x0 - 1;
}

void drawRows(const char *const *rows, int n, int x, int y, int v) {
  for (int r = 0; r < n; r++)
    for (int c = 0; rows[r][c]; c++)
      if (rows[r][c] == '#') px(x + c, y + r, v);
}

// ---------- scenes ----------

void sceneSparkle(int frames) {
  clearFb();
  for (int f = 0; f < frames; f++) {
    fade(1);
    for (int i = 0; i < 3; i++) px(random(W), random(H), random(4, MAX_B + 1));
    show(45);
  }
}

// Kubernetes-style helm: outer ring, hub, 7 spokes. Pixels are shaded
// by distance from the ideal shape, which gives soft anti-aliased edges.
void sceneHelm(int frames) {
  const float cx = 6.0f, cy = 3.5f;
  const float seg = 2.0f * PI / 7.0f;
  float angle = 0;
  for (int f = 0; f < frames; f++) {
    // ease in: spin speeds up over the first 40 frames
    float speed = f < 40 ? 0.02f + 0.004f * f : 0.18f;
    angle += speed;
    float level = f < 10 ? f / 10.0f : 1.0f;  // fade in
    if (frames - f < 10) level = (frames - f) / 10.0f;  // fade out

    clearFb();
    for (int y = 0; y < H; y++) {
      for (int x = 0; x < W; x++) {
        float dx = x - cx, dy = y - cy;
        float r = sqrtf(dx * dx + dy * dy);
        float v = 0;

        float ring = MAX_B - fabsf(r - 3.4f) * 9.0f;
        if (ring > v) v = ring;

        if (r < 1.1f) v = MAX_B;

        if (r > 0.8f && r < 3.2f) {
          float a = atan2f(dy, dx) - angle;
          float d = a - seg * (int)(a / seg);  // fmodf is not exported either
          if (d < 0) d += seg;
          if (d > seg / 2) d -= seg;
          float spoke = MAX_B - fabsf(d) * r * 8.0f;
          if (spoke > v) v = spoke;
        }
        px(x, y, (int)(v * level + 0.5f));
      }
    }
    show(35);
  }
}

// Wheel bursts outward as a ring, clearing the screen.
void sceneBurst() {
  for (float rad = 0; rad < 8.5f; rad += 0.6f) {
    fade(3);
    for (int y = 0; y < H; y++)
      for (int x = 0; x < W; x++) {
        float dx = x - 6.0f, dy = y - 3.5f;
        float d = fabsf(sqrtf(dx * dx + dy * dy) - rad);
        if (d < 0.8f) px(x, y, MAX_B - (int)(d * 6));
      }
    show(30);
  }
  for (int i = 0; i < 4; i++) { fade(2); show(30); }
}

void sceneScroll(const char *text, int passes) {
  clearFb();
  int width = drawBig(text, 0, 0, 0);  // measure only
  for (int p = 0; p < passes; p++) {
    for (int x = W; x >= -width; x--) {
      fade(4);  // 7 -> 3 -> 0: two-frame trail behind each letter
      drawBig(text, x, 1, MAX_B);
      show(70);
    }
  }
  for (int i = 0; i < 3; i++) { fade(3); show(40); }
}

void sceneDrop(const char *text) {
  static const int8_t path[] = {-7, -6, -4, -1, 1, -1, 0, 1, 1};
  const int x = (W - 5) / 2;
  for (const char *s = text; *s; s++) {
    if (*s == ' ') {  // word gap: short blank pause
      clearFb();
      show(300);
      continue;
    }
    const Glyph *g = findGlyph(BIG, BIG_COUNT, *s);
    for (size_t i = 0; i < sizeof(path); i++) {
      clearFb();
      drawGlyph(g, 7, x, path[i], MAX_B);
      show(i < 5 ? 45 : 70);
    }
    show(450);
    // dissolve: random pixels drop out
    for (int f = 0; f < 10; f++) {
      for (int i = 0; i < 8; i++) fb[random(W * H)] = 0;
      fade(1);
      show(35);
    }
    clearFb();
    show(80);
  }
}

void drawBadge(int v) {
  // "CNS" = 3+1+4+1+3 = 12 wide, "PK" = 3+1+3 = 7 wide, centred on 13 columns
  drawSmall("CNS", 0, 0, v);
  drawSmall("PK", 3, 4, v);
}

void sceneBadge() {
  // build up line by line
  for (int y = 0; y < H; y++) {
    clearFb();
    drawBadge(MAX_B);
    for (int r = y + 1; r < H; r++) memset(&fb[r * W], 0, W);
    show(60);
  }
  show(500);

  // diagonal light sweep over a dimmed badge
  for (int pass = 0; pass < 2; pass++) {
    for (int t = -6; t < W + H + 2; t++) {
      clearFb();
      drawBadge(2);
      for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
          int d = abs((x + y) - t);
          if (fb[y * W + x] && d < 3) fb[y * W + x] = MAX_B - d * 2;
        }
      show(45);
    }
  }

  // breathing pulse
  for (int f = 0; f < 60; f++) {
    // triangle wave through smoothstep; cosf is not exported by the Zephyr loader
    float t = (f % 30) / 15.0f;
    if (t > 1.0f) t = 2.0f - t;
    float s = t * t * (3.0f - 2.0f * t);
    clearFb();
    drawBadge(1 + (int)(s * (MAX_B - 1) + 0.5f));
    show(40);
  }

  clearFb();
  drawBadge(MAX_B);
  show(800);
  for (int i = 0; i < 7; i++) { fade(1); show(50); }
}

// Text scrolls in, the heart rides behind it and parks in the centre.
void sceneNameHeart(const char *text) {
  const int heartX = (W - HEART_W) / 2;
  const int gap = 4;
  int width = drawBig(text, 0, 0, 0);  // measure only

  clearFb();
  for (int x = W; x + width + gap >= heartX; x--) {
    fade(4);  // two-frame trail
    drawBig(text, x, 1, MAX_B);
    drawRows(HEART_BIG, HEART_H, x + width + gap, 0, MAX_B);
    show(70);
  }
  clearFb();
  drawRows(HEART_BIG, HEART_H, heartX, 0, MAX_B);
  show(400);

  // heartbeat: big-small-big, rest; a faint ring spreads on each "lub"
  for (int beat = 0; beat < 5; beat++) {
    for (float rad = 4.0f; rad < 8.5f; rad += 1.5f) {
      clearFb();
      for (int y = 0; y < H; y++)
        for (int x = 0; x < W; x++) {
          float dx = x - 6.0f, dy = (y - 3.5f) * 1.4f;
          float d = fabsf(sqrtf(dx * dx + dy * dy) - rad);
          if (d < 0.7f) px(x, y, 3 - (int)(d * 4));
        }
      drawRows(HEART_BIG, HEART_H, heartX, 0, MAX_B);
      show(50);
    }
    clearFb();
    drawRows(HEART_SMALL, HEART_SMALL_H, heartX + 1, 1, 5);
    show(110);
    clearFb();
    drawRows(HEART_BIG, HEART_H, heartX, 0, MAX_B);
    show(150);
    clearFb();
    drawRows(HEART_SMALL, HEART_SMALL_H, heartX + 1, 1, 5);
    show(450);
  }

  // sparkle away: pixels drop out while stray stars twinkle
  clearFb();
  drawRows(HEART_BIG, HEART_H, heartX, 0, MAX_B);
  show(300);
  for (int f = 0; f < 25; f++) {
    for (int i = 0; i < 5; i++) fb[random(W * H)] = 0;
    fade(f < 15 ? 0 : 1);
    if (f < 15) px(random(W), random(H), random(3, MAX_B + 1));
    show(50);
  }
  for (int i = 0; i < 6; i++) { fade(2); show(40); }
  clearFb();
  show(300);
}

// ---------- main ----------

void setup() {
  matrix.begin();
  matrix.setGrayscaleBits(3);
  randomSeed(analogRead(A0));
  clearFb();
  show(10);
}

void loop() {
  sceneNameHeart("ZAEEM GOAT");
}
