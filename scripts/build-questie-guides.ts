import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { exportRiv, importRiv } from '@openrive/rive/document';
import { properties } from '@openrive/rive/databind';
import { bundleFiles } from '@openrive/rive/bundle';
import { questiePin, questieGeo, GUIDE_MOUTHS, GUIDE_REACTIONS, GUIDE_PROPERTIES } from '../packages/rive/src/templates-questie';

const out = 'questie-site';
mkdirSync(out, { recursive: true });

for (const template of [questiePin, questieGeo]) {
  const doc = template.build();
  const bytes = exportRiv(doc);
  const reread = importRiv(bytes);
  assert.deepEqual(Buffer.from(exportRiv(reread)), Buffer.from(bytes), 'Rive byte round-trip');
  const ab = reread.artboards[0]!;
  assert.equal(ab.artboard.props.name, template === questiePin ? 'Pin' : 'Geo');
  assert.ok(ab.stateMachines.some((s) => s.props.name === 'Guide'));
  const names = properties(reread, ab).map((p) => p.name);
  assert.equal(names.length, 13);
  for (const prop of Object.keys(GUIDE_PROPERTIES)) {
    assert.ok(names.includes(prop), 'Missing ' + prop);
  }
  for (const [mouth] of GUIDE_MOUTHS) {
    assert.ok(ab.animations.some((a) => a.props.name === 'Viseme ' + mouth));
  }
  for (const [reaction] of GUIDE_REACTIONS) {
    assert.ok(ab.animations.some((a) => a.props.name === 'Reaction ' + reaction));
  }
  const runtimeFiles = ['canvas_advanced.mjs', 'rive.wasm'].map((name) => ({
    name,
    data: new Uint8Array(readFileSync(join('apps/web/public/rive', name))),
  }));
  for (const f of bundleFiles({
    name: template.id,
    doc,
    riv: bytes,
    runtime: 'offline',
    runtimeVersion: 'vendored OpenRive runtime',
    runtimeFiles,
  })) {
    const dest = join(out, template.id, f.name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, f.data);
  }
  // Ship portable Questie JS + React Living Mascot SDK and companion demo inside each standalone bundle
  for (const sdkFile of [
    'questie-sdk.js',
    'questie-react.js',
    'questie-sdk.d.ts',
    'behavior-engine.js',
    'guide-contract.js',
    'locked-voice.js',
    'embed-example.html',
    'companion-demo.html',
  ]) {
    writeFileSync(join(out, template.id, sdkFile), readFileSync(join('questie-preview', sdkFile)));
  }
  console.log(template.id, bytes.length, 'bytes; IDENTICAL round-trip; 8 visemes; 13 reactions; 13 properties');
}

// Bundle the DOM-free OpenRive native authoring engine for live in-browser mascot customization & .riv export
const engineBuild = await Bun.build({
  entrypoints: ['packages/rive/src/questie-browser-engine.ts'],
  target: 'browser',
  format: 'esm',
  minify: true,
});
if (!engineBuild.success) {
  for (const msg of engineBuild.logs) console.error(msg);
  throw new Error('Failed to bundle questie-browser-engine.ts');
}
writeFileSync(join(out, 'mascot-engine.js'), new Uint8Array(await engineBuild.outputs[0]!.arrayBuffer()));

for (const file of [
  'index.html',
  'styles.css',
  'studio.js',
  'questie-sdk.js',
  'questie-react.js',
  'questie-sdk.d.ts',
  'behavior-engine.js',
  'guide-contract.js',
  'locked-voice.js',
  'embed-example.html',
  'companion-demo.html',
  'muse-preview.html',
]) {
  const content = readFileSync(join('questie-preview', file), 'utf8');
  // The root embed uses the Pin bundle; exported bundle copies retain their local index.js.
  writeFileSync(join(out, file), file === 'embed-example.html'
    ? content.replace("from './index.js'", "from './questie-pin/index.js'")
    : content);
}

console.log('Preview site generated at ' + out);
