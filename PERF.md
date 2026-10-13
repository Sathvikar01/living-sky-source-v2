# Performance verification — 8 October 2026

The source and generated `index.html` now batch animation geometry reads, avoid
shading opaque scenery that later layers replace, and reuse per-stroke jitter and
directions from RGBA32F textures. Stroke metadata is regenerated every rendered
frame from the current flow field; it cannot become stale during weather, scroll,
or cursor changes. GPUs without the required float render targets use the
original per-pixel stroke calculation.

Resolution, device-pixel-ratio limits, adaptive quality levels, filtering radii,
shader sample counts, glass filters, animation timing, cursor effects and assets
retain their existing settings. No effect was removed or simplified.

## Measurements

Chrome, Windows, Intel Iris Xe (ANGLE D3D11). Both versions were forced to quality
level 0. Measurements compare the original saved build against the new renderer.

| Measurement | Original | Optimized | Method |
|---|---:|---:|---|
| Full GPU pipeline, median | 38.60 ms | 27.45 ms | Five alternating batches, six draws each, 1280 × 720 render pixels, CSS viewport 640 × 360 at DPR 2 |
| Scroll/cursor p95 frame interval, median of runs | 233.5 ms | 116.6 ms | Three runs, same 24 pointer movements and 12 wheel inputs at 1280 × 720, DPR 1 |
| Style recalculations, median per interaction run | 761 | 172 | Same interaction scenario |

The GPU change is roughly 29% faster at the same settings. Frame intervals still
vary with browser scheduling and the device; these numbers do not establish a
60 FPS guarantee. Interaction runs use a fixed input sequence, not a fixed
duration, so faster input processing also shortens the run.

## Visual and behavior checks

- Full-pipeline comparisons across 36 cases: landscape, portrait, DPR 1 and 2,
  quality levels 0, 2 and 4, and the encoded/no-float fallback. The six states
  cover scroll endpoints, moving grass, rain/lightning, night/moon and snow/fog.
- No render resolution or precision reduction. Float shader compilation causes
  sparse numerical rounding differences: comparisons are not bit-identical.
  The final comparison's largest mean channel difference was 0.00028 on a
  0–255 scale. Earlier comparisons with different sky colors remained below
  0.00040. The visual check rejects mean differences above 0.002 or differences
  in more than 0.2% of channels; the GPU check requires at least 10% improvement.
- Desktop and mobile screenshots inspected; navigation, hover/cursor, project
  dialog, Escape close, night/rain switching, resizing and reduced motion passed.
- No application JavaScript errors or WebGL errors in the checks. API responses
  are mocked in interaction tests. Existing Chrome pixel-readback performance
  warnings remain; pixel probes are unchanged.
- All source JavaScript passes `node --check`; `python build.py` regenerates the
  standalone build. Production JavaScript/CSS grew by about 5.6 KB uncompressed.

## Experiment ledger

| Attempt | Result | Decision |
|---|---|---|
| Batch frame geometry reads | Median style recalculations 761 → 181 in isolation | Kept |
| Cull fully overwritten landscape layers | Scene GPU median 3.81 → 2.16 ms in isolation | Kept |
| Register non-inherited glass lighting properties | No consistent improvement; style time increased | Reverted |
| Full-precision per-stroke metadata | Full GPU pipeline approximately 38.6 → 27.4 ms with landscape optimization | Kept |
| Skip stroke layers at exact blend endpoints | Full GPU timings within run variance; extra branching | Reverted |

## Repeating the checks

Serve this directory on port 4173 (`python -m http.server 4173 --bind 127.0.0.1`).
Open an isolated Chrome session with Playwright CLI, then use `run-code --filename`
with these files under `output/playwright/`:

- `profile.cjs`: original build interaction measurements.
- `profile-final.cjs`: optimized build interaction measurements.
- `pipeline-check.cjs`: visual comparisons, no-float fallback, GPU measurements
  and regression thresholds. Run after loading the app so `window.SKY` exists.
- `flows.cjs`: navigation/dialog/weather/mobile/reduced-motion behavior.

`baseline.html` is the original build used for comparisons. The `cpu.html` and
`profile-cpu.cjs` files preserve the intermediate geometry-only measurement.
The screenshot artifacts are `desktop.png` and `mobile.png`.

## Follow-up: fixed dark liquid glass

Glass surfaces now use the education card's dark tint and light text throughout
the UI, as requested. Background-based ink sampling applies only to standalone
text. Browser verification confirmed that all 42 existing glass surfaces retain
the same material variables across About/Projects scrolling and midday, night
and sunset. Preview: `output/playwright/glass-fixed-about.png`.

## Vercel interaction follow-up (2026-10-08)

The previous deployment and local build returned byte-identical HTML. Under
the same 1280 x 720 Chrome scenario, both stuttered (median frame intervals
approximately 67-83 ms). No extra application scripts were injected into the
public deployment. Hosting did not change the rendering code. Larger browser
viewports/DPR can increase GPU cost; the user's reported browser is Windows
Chrome/Edge.

The CPU profile identified repeated inherited glass-lighting style invalidation
and blocking time in `getBufferSubData`. The previous fixed, translated page
also made scrolling depend on JavaScript animation frames.

Changes:

- Use native document scrolling, with native smooth section navigation. The
  landscape still follows scroll progress and the 1.8-second card wipes remain.
- Place each pane's lighting variables on an empty, aria-hidden decoration,
  preserving the same rim/glare gradients and direct shadow values. Card text
  and chips no longer inherit continuously changing lighting properties.
- Gather exact scene texels into a 128 x 1 RGBA8 target and read the batch once,
  rather than reading each contrast point separately. Oversized batches or an
  unavailable target retain the original path. No landscape shader, resolution,
  sampling, glass refraction/blur/saturation or quality level was reduced.

Three alternating runs at forced quality level 0, same 24 pointer moves and
12 wheel inputs, produced these median results:

| Metric | Deployed version | Fixed version |
|---|---:|---:|
| Style recalculations | 178 | 114 |
| Style recalculation time | 843 ms | 532 ms |
| Main-thread task time | 1,941 ms | 1,530 ms |
| p95 animation-frame interval | 183 ms | 167 ms |

Style work fell approximately 37%, and main-thread task time 21%. Frame p95 is
noisy and still overlaps between runs; median frame intervals remained about
67 ms on this setup. This improves the identified bottlenecks and decouples
native scrolling, but does not establish 60 FPS for the full painted background
on an integrated GPU. Existing ANGLE readback warnings can still occur.

Checks and artifacts: `vercel-diagnose.cjs`, `lag-isolate.cjs`, `lag-final.cjs`,
`glass-parity.cjs`, and `probe-parity.cjs` under `output/playwright`. Contrast
samples were exactly equal for batches of 4, 32, 128, 129 (fallback), and 8
points, including coordinates outside the viewport. About screenshots preserve
all 42 glass panes, the fixed dark material and 1.8-second wipe duration.
Desktop navigation, project dialog/Escape close, night/rain transitions, mobile
resizing and reduced motion passed without application JavaScript errors.
Weather checks wait for the same target state with a bounded deadline, because
the existing simulation clamps elapsed time on slow frames; a fixed 2.8-second
sleep was unreliable at forced maximum quality.

Experiment ledger additions:

| Attempt | Result | Decision |
|---|---|---|
| One landscape in flight via a zero-timeout fence | No consistent frame improvement in two alternating runs | Reverted |
| Lighting decoration in isolation | Style time 880/885 ms to 701/794 ms | Kept |
| Batched contrast readback plus lighting | Task time 2,143/2,420 ms to 1,497/1,712 ms; p95 183/184 ms to 150/150 ms | Kept |
| Native scrolling with both changes | Three-run medians above; scrolling no longer waits for JS page transforms | Kept |
| Exact-size PBO allocation | Did not eliminate ANGLE warnings; no isolated benefit established | Reverted |
