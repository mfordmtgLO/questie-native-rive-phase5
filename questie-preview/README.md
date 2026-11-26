# Questie native guide V4.1
Pin and Geo use OpenRive's native authoring API and Rive WASM player. The previous V4 build passed its original GitHub Actions export and runtime smoke tests. This version has new acceptance tests; their results must be checked separately.

## Build
`bun install --frozen-lockfile`, then `bun run scripts/build-questie-guides.ts`. Serve questie-site over HTTP. The generator verifies round-trip equality, both native artboards and all 13 properties. Run `bunx playwright-core install chromium` and `bun run scripts/test-questie-preview.ts` for runtime tests.

## GuideVM
State machine Guide. All 13 properties are numeric: lookX/lookY/headX/headY/breath range -1..1; blink/mouthOpen/mouthWide/teeth/tongue/speaking range 0..1; emotion 0..12; mouthShape 0..7 (diagnostic only). The host drives autonomous breathing, blink, gaze, damping and scripted audio-clock morphs. Native component binds deform one mouth silhouette, control tongue/teeth, pupils, head/face translation, blink covers and speaking blush. Emotion selects native reaction states. The native head rotation is reaction-driven, not directly driven by headX. Default template art remains a simplified vector prototype; editor manual timeline previews are not the same as live GuideVM driving. No legacy inputs are required.

## Original locked recordings (no recasting)
The owner supplied Pin MAI_01 and Geo casper recordings (13 each, 26 total) with original Rhubarb timing. The source is private; the public preview contains only file names, byte sizes and Git blob fingerprints, not audio, private script text or timing data. Select all original MP3 files and pin-geo-mouth-cues.json in the locked pack input. Import verifies every byte against the source fingerprints. Each guide plays only its own recording, at original playback rate. The Rhubarb mapping into eight native targets is approximate; actual audio and on-model visual review are still required. Fixed demo scripts include context-specific claims and amounts; do not use as live mortgage or listing claims. No API keys or recasting.

## Vercel
Separate project, production source questie-rive-v4, framework Other; vercel.json builds the standalone preview, not the database-backed editor. No deployment API keys needed for the static preview. Vercel authorization still required.
