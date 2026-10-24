# Hukam landing: design notes

Baseline: the Vite + React handoff from another engineer (commit "add Vite + React landing handoff as baseline"). Kept its section order, headline ("You don't need a laptop anymore."), "Why Hukam", "Your workflow. Three simple steps.", FAQ and the H mark. Rebuilt the visuals on top of it.

Direction: pure black, violet (from the H mark) + warm amber counter-light, General Sans display + Inter body. Feel taken from the Graphi landing (Framer "Fusion AI" style): blur-in headline words, gradient-rim badge, glow button with rolling label, cards with a slowly rotating conic rim.

Images: generated with Codex image generation (one art direction: black, violet key light, amber rim, frosted glass, no text), optimised to webp in `public/generated/` (all under 70 KB).

## What each section takes from where
- Hero: Graphi hero layout (left headline, light-streak art on the right, glow bands). Composer card types real Hukam commands (English, Roman Urdu, Urdu, voice note) and shows the route Gemma picked.
- Why Hukam: Graphi FeatureGrid bento + conic rim; each card has a live micro-UI (voice note playing, Gemma decision JSON, agents progressing, owner approval).
- See Hukam in action: WhatsApp iOS dark replica (Mobbin WhatsApp screens for layout, WhatsApp dark tokens for colour) + n8n-style node canvas (Gemma 4 -> Superset -> agent) with packets on the wires and the result flying back into the chat. Messages mirror what `src/router.mjs` sends. Reduced motion shows the final storyboard frame. `?story=<scenario>-<step>` freezes a frame.
- Steps: three cards with mini visuals and a drawn connector line.
- FAQ: Linear/Giga two-column hairline accordion, two-tone headline, one-line answers.
- Footer: Kaleidly dithered footer logo technique applied to "Your AI. Anywhere." with the H mark; dots assemble as the footer is revealed, ripple with scroll speed, repel from the cursor, ring on tap. Footer sits sticky under `<main>`.

## References
## 1. Mobbin (verified, screenshots reviewed)

1. **Giga: FAQ (dark)**: https://mobbin.com/sites/sections/2d1ea869-c2c4-4d67-ba52-34a76fd84ebd
   - Borrow: 2-column FAQ. Left side has a small pill eyebrow ("FAQS" with a dot), a light-weight
     two-line H2, and a "Still have questions? Talk to our team" line. Right side has a hairline-divided
     accordion with a chevron. The first item is open by default so the pattern is clear.
2. **Linear: FAQ "Questions and answers"**: https://mobbin.com/sites/sections/1d6082b2-fd08-479c-9367-cccd1b14e62c
   - Borrow: H2 in two tones ("Questions" white, "and answers" ~50% grey). Small chevron on the
     LEFT of each question, 1px rows at ~8% white, 13-14px question text. Very quiet, very premium.
3. **Zellerfeld: footer wordmark (dark)**: https://mobbin.com/sites/sections/18df6730-6569-49da-9c23-3bee32fbe638
   - Borrow: 4 small mono-caps link columns at the top. Under them, a logo mark plus a wordmark that
     spans the full width and nearly touches the bottom edge. For Hukam: make "hukam" ~22vw and let
     the bottom edge clip it.
4. **BAGGU / MOUTHWASH: edge-to-edge wordmarks**:
   https://mobbin.com/sites/sections/ddfad441-10db-4949-9baa-299e7e0edeee ,
   https://mobbin.com/sites/sections/082f5fac-4648-4314-aa7d-a06fe0235b77
   - Borrow: the wordmark is cropped by the viewport bottom (BAGGU), and there is a thin legal row
     under a giant mark (MW.S). Do it in a dark version: wordmark fill is a vertical gradient from
     #1a1a1a to #000, with a violet/amber radial glow behind it.
5. **WhatsApp iOS: chat conversation**: https://mobbin.com/screens/ff7ec209-6c71-4eef-9df6-c5667fd27a49
   (also https://mobbin.com/screens/f95b630a-93ca-437f-825e-86235a109257)
   - Borrow: centered pill date chips ("Today"), system notices as centered pills, voice-call
     bubbles with an icon tile, and the timestamp plus ticks placed inline at the bottom-right of
     the bubble. These are light-mode captures. Use them for layout only and take colors from the
     spec section below.

## 2. Dribbble / Behance / Framer

6. **Fusion AI (Framer template, Amani)**: https://www.framer.com/marketplace/templates/fusion-ai/
   - The style target. Borrow: "appear effects" (fade + 12px rise + blur(6px) to 0, stagger 80ms),
     3D glossy hero objects, and dashboard cards with an inner top highlight
     (inset 0 1px 0 rgba(255,255,255,.08)). Sibling templates by the same author: AgentFlow, AuraFlowX.
7. **Dark Bento Grid Feature Section, AI SaaS (Dribbble, Jun 2026)**:
   https://dribbble.com/shots/27453309-Dark-Bento-Grid-Feature-Section-AI-SaaS-Landing-Page-UI-with-G
   - Borrow: 4 modular cards, each with one live mini-visual (metric, chart, chip list). For Hukam:
     cards for "Voice note in", "Gemma routes", "Claude Code / Codex work", "Screenshot back". Use a
     rotating conic-gradient 1px border (violet to amber, 6s linear) on hover only.
8. **AI Video Creation Canvas: nodal workflow UI (Dribbble)**:
   https://dribbble.com/shots/27245004-AI-Video-Creation-Canvas-Workflow-UI-design
   - Borrow: node cards on a dotted canvas joined by curved bezier wires with ports. Animate a
     glowing "packet" dot along each wire (SVG stroke-dashoffset or offset-path, ~1.2s per hop).
9. **Dark Framer roundup (Verity, Conductor)**: https://saaslandingpage.com/articles/12-dark-framer-templates-for-saas-ai-startups/
   - Verity: use-case tabs that swap glowing product screens. Conductor: "restrained glow + gradient".
     Borrow both: a tabbed "what you can ask" section that swaps WhatsApp threads.
10. Search hubs for more shots: https://dribbble.com/tags/ai-agents-landing-page ,
    https://dribbble.com/search/agent-workflow , https://dribbble.com/search/bento-grid-dark ,
    https://www.behance.net/search/projects/ascii%20animation (dot-matrix / ASCII wordmark ideas).

## 3. Live sites

11. **n8n**: https://n8n.io/
    - Its hero is a live workflow ("Refund requested -> Lookup order -> Ask for approval on Slack ->
      Approved? -> ..."), with an agent node that shows its model ("Claude Sonnet 4.6") and its tools.
      Borrow this literally: "WhatsApp voice note -> Gemma 4 router -> Claude Code | Codex -> reply".
      Steps light up in order, and one branch is a decision diamond.
12. **Linear**: https://linear.app
    - Hairline 1px borders at rgba(255,255,255,.08), a two-tone headline, and a glass pill navbar
      with a "Log in [L]" keyboard hint. A spotlight radial gradient follows the cursor on cards.
13. **Raycast**: https://www.raycast.com
    - Feature cards on black with a 1px gradient top border and a soft colored under-glow.
      Use this for the violet/amber blobs: filter blur(120px), opacity .35, slow 20s drift.
14. **footer.design "Large Type"**: https://www.footer.design/styles/large-type (Heron AI, Outway, Nothin')
    - Collected large-type footers. Borrow from Heron AI: an AI brand footer where the wordmark is
      the main graphic. For a dot-matrix version, sample the wordmark onto a canvas grid of 3px
      dots that brighten near the cursor.

