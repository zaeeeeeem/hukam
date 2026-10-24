# Hukam thumbnails

Final PNGs are in the parent directory. Each HTML file is a fixed-size source for its matching PNG. Typography uses the landing page's local General Sans fonts; keep these HTML files in the repository so the relative font paths resolve.

## Render

From the repository root, run the following for each matching name and size:

```sh
name=hukam-cover-1600x900
size=1600,900
# Other pairs: hukam-og-1200x630 / 1200,630; hukam-square-1080 / 1080,1080
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --user-data-dir=/tmp/hukam-chrome-thumb --window-size="$size" \
  --force-device-scale-factor=1 --allow-file-access-from-files \
  --run-all-compositor-stages-before-draw --virtual-time-budget=2000 \
  --screenshot="$PWD/landing/public/thumbnails/$name.png" \
  "file://$PWD/landing/public/thumbnails/src/$name.html"
```

## Artwork

Tool: built-in image_gen. Style reference: `landing/public/generated/hero.webp`. Both original PNGs are under 1.5 MB and are retained in `../raw/`. All three layouts use `hukam-flow.png`. Text is real HTML, separate from the artwork.

Prompt set:

1. **hukam-flow.png:** Text-free wide 16:9 cinematic 3D illustration for Hukam. Preserve the reference's glossy black glass, near-black negative space, precise violet-indigo and warm orange/rust rim light, and restrained luxury product-render aesthetic. Left 45% quiet near-black; objects in the right 55%. A floating obsidian smartphone in three-quarter perspective contains translucent chat bubbles, a simple jade chat/handset silhouette and a tiny voice waveform, with no letters or numbers. Fine orange and violet light filaments connect the phone to a faceted translucent crystal intelligence node, then branch into three small obsidian-glass agent cubes. Phone-to-crystal-to-three-cubes composition. Beautiful bevels, restrained glows, optical caustics, subtle ground reflections, black void. Palette #ff8a3d, #a8390a, #7b6cff, #3a2f9e. No text, code, labels, watermarks or humans; fully contained objects and generous breathing room.
2. **hukam-orbit.png:** A second distinct text-free premium product-cover background for Hukam, matching the same reference. Wide 16:9, empty black left 48%, sculptural composition on right 52%. A large glossy obsidian smartphone floats diagonally toward the viewer, with a translucent jade WhatsApp-inspired chat/handset symbol and a small voice waveform. Orange ribbon and violet fiber-optic strands emanate from the phone, spiral around a smaller faceted glass intelligence crystal, and end in three obsidian translucent cubes in an ascending arc. The phone is the hero object. Real physical glass, beveled edges, subtle iridescence, luxe studio lighting and black ground reflections. No text, letters, numbers, labels, watermarks, humans, grid, star field or clutter.
