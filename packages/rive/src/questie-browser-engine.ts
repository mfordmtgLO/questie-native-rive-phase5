// Browser-safe native Rive authoring & export bundle entry point for Questie Studio.
// Runs OpenRive's DOM-free native .riv serializer directly in the browser with zero server calls.
import { exportRiv, importRiv } from './document';
import { properties } from './databind';
import { buildBundle, type BundleFile } from './bundle';
import {
  buildQuestieGuide,
  defaultQuestieCustomization,
  GUIDE_MOUTHS,
  GUIDE_PROPERTIES,
  GUIDE_REACTIONS,
  type QuestieCustomization,
} from './templates-questie';

export {
  buildQuestieGuide,
  defaultQuestieCustomization,
  GUIDE_MOUTHS,
  GUIDE_PROPERTIES,
  GUIDE_REACTIONS,
  type QuestieCustomization,
};

export function compileCustomMascot(preset: 'Pin' | 'Geo', custom?: Partial<QuestieCustomization>) {
  const doc = buildQuestieGuide(preset, custom);
  const bytes = exportRiv(doc);
  const reread = importRiv(bytes);
  const ab = reread.artboards[0];
  if (!ab) throw new Error('Generated artboard missing');
  const names = properties(reread, ab).map((p) => p.name);
  if (names.length !== 13) {
    throw new Error(`Expected 13 GuideVM properties, got ${names.length}`);
  }
  return {
    doc,
    bytes,
    propertyCount: names.length,
    byteLength: bytes.length,
    artboardName: String(ab.artboard.props.name ?? preset),
  };
}

export function exportCustomBundleZip(
  name: string,
  preset: 'Pin' | 'Geo',
  custom: Partial<QuestieCustomization> | undefined,
  runtimeFiles?: BundleFile[],
): Uint8Array<ArrayBuffer> {
  const { doc, bytes } = compileCustomMascot(preset, custom);
  return buildBundle({
    name,
    doc,
    riv: bytes,
    runtime: runtimeFiles && runtimeFiles.length ? 'offline' : 'cdn',
    runtimeVersion: runtimeFiles && runtimeFiles.length ? 'vendored OpenRive runtime' : '2.50.0',
    runtimeFiles,
  });
}
