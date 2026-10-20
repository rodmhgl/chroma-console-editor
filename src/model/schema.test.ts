import { describe, expect, it } from 'vitest';
import { defaultWorkingState } from './state';
import { PARAMS } from '../midi/map';
import {
  SCHEMA_VERSION,
  parseLibraryFile,
  parsePreset,
  presetTags,
  serializeBundle,
  serializePreset,
  type Preset,
} from './schema';

const shimmer: Preset = {
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  name: 'Shimmer Tape',
  notes: 'Big wash. Expects a Gesture recording.',
  tags: ['ambient', 'pad'],
  createdAt: '2026-10-01T10:00:00.000Z',
  modifiedAt: '2026-10-02T11:30:00.000Z',
  params: { ...defaultWorkingState(), characterEffect: 76, mix: 90, diffusionEngaged: 0, filterStyle: 107 },
};

describe('serializePreset', () => {
  it('writes the envelope first, then every preset param in pedal map order', () => {
    const file = JSON.parse(serializePreset(shimmer));

    expect(Object.keys(file)).toEqual([
      'format',
      'schemaVersion',
      'appVersion',
      'id',
      'name',
      'notes',
      'tags',
      'createdAt',
      'modifiedAt',
      'params',
    ]);
    expect(file.format).toBe('chroma-console-preset');
    expect(file.schemaVersion).toBe(3);
    expect(typeof file.appVersion).toBe('string');
    expect(file.tags).toEqual(['ambient', 'pad']);
    expect(Object.keys(file.params).slice(0, 5)).toEqual([
      'characterEffect',
      'movementEffect',
      'diffusionEffect',
      'textureEffect',
      'tilt',
    ]);
    expect(Object.keys(file.params)).toHaveLength(Object.keys(defaultWorkingState()).length);
    expect(file.params).toMatchObject({ characterEffect: 76, mix: 90, diffusionEngaged: 0, filterStyle: 107 });
  });

  it('is 2-space JSON with a trailing newline, so an unchanged Preset writes an identical file', () => {
    const text = serializePreset(shimmer);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "format": "chroma-console-preset",\n');
    expect(serializePreset(shimmer)).toBe(text);
  });
});

describe('parsePreset', () => {
  it('reads back what serializePreset wrote, without warnings', () => {
    expect(parsePreset(serializePreset(shimmer))).toEqual({ ok: true, preset: shimmer, warnings: [] });
  });
});

describe('parsePreset migrates', () => {
  it('a schema 1 file, written before Module Order, to the default Module Order without a warning', () => {
    const defaults = { moduleOrder: 0, dualBypassModules: 0b1111, expressionTarget: 0 };
    const file = JSON.parse(serializePreset({ ...shimmer, params: { ...shimmer.params, ...defaults } }));
    for (const id of Object.keys(defaults)) delete file.params[id];
    const result = parsePreset(JSON.stringify({ ...file, schemaVersion: 1 }));

    expect(result).toEqual({ ok: true, preset: { ...shimmer, params: { ...shimmer.params, ...defaults } }, warnings: [] });
  });

  it('a schema 2 file, written before Dual Bypass and the expression target, to all Modules and none without a warning', () => {
    const file = JSON.parse(serializePreset({ ...shimmer, params: { ...shimmer.params, dualBypassModules: 0b1111, expressionTarget: 0 } }));
    delete file.params.dualBypassModules;
    delete file.params.expressionTarget;
    const result = parsePreset(JSON.stringify({ ...file, schemaVersion: 2 }));

    expect(result).toEqual({ ok: true, preset: { ...shimmer, params: { ...shimmer.params, dualBypassModules: 0b1111, expressionTarget: 0 } }, warnings: [] });
  });
});

describe('parsePreset rejects', () => {
  const valid = () => JSON.parse(serializePreset(shimmer));
  const parse = (file: unknown) => parsePreset(JSON.stringify(file));

  it.each([
    ['broken JSON', '{"format": "chroma-console-preset",'],
    ['a JSON value that is not an object', '[1, 2]'],
  ])('%s', (_, text) => {
    expect(parsePreset(text)).toEqual({ ok: false, error: 'Not a Preset file' });
  });

  it('a file whose format is not a Preset, whatever its extension', () => {
    expect(parse({ ...valid(), format: 'chroma-console-bundle' })).toEqual({ ok: false, error: 'Not a Preset file' });
    expect(parse({ ...valid(), format: undefined })).toEqual({ ok: false, error: 'Not a Preset file' });
  });

  it.each([
    ['clean-preset', 'This is a Clean Preset, open it in the Clean editor'],
    ['clean-bundle', 'This is a Clean Bundle, open it in the Clean editor'],
    ['lost-found-preset', 'This is a Lost+Found Preset, open it in the Lost+Found editor'],
    ['lost-found-bundle', 'This is a Lost+Found Bundle, open it in the Lost+Found editor'],
  ])('a %s file, naming the pedal it belongs to', (format, error) => {
    expect(parse({ ...valid(), format })).toEqual({ ok: false, error });
  });

  it.each(['id', 'name', 'schemaVersion'])('a file missing its %s', (field) => {
    expect(parse({ ...valid(), [field]: undefined })).toEqual({ ok: false, error: `Missing ${field}` });
  });

  it.each([0, 1.5, '1'])('a schemaVersion of %j', (schemaVersion) => {
    expect(parse({ ...valid(), schemaVersion })).toEqual({ ok: false, error: 'Missing schemaVersion' });
  });

  it('a blank name', () => {
    expect(parse({ ...valid(), name: '   ' })).toEqual({ ok: false, error: 'Missing name' });
  });

  it('a file made by a newer version, rather than loading it best-effort', () => {
    expect(parse({ ...valid(), schemaVersion: 4 })).toEqual({
      ok: false,
      error: 'Made by a newer version of the editor, please update',
    });
  });
});

describe('parsePreset clamps params the way the pedal decodes them, and reports each change', () => {
  const parseFile = (change: (file: Record<string, unknown> & { params: Record<string, unknown> }) => void) => {
    const file = JSON.parse(serializePreset(shimmer));
    change(file);
    const result = parsePreset(JSON.stringify(file));
    if (!result.ok) throw new Error(result.error);
    return result;
  };
  const parseParams = (params: Record<string, unknown>) =>
    parseFile((file) => {
      file.params = { ...file.params, ...params };
    });

  it('gives missing params their map default', () => {
    const result = parseFile((file) => {
      delete file.params.mix;
      delete file.params.movementDrift;
    });
    expect(result.preset.params).toMatchObject({ mix: 127, movementDrift: 0 });
    expect(result.warnings).toEqual(['mix missing: set to 127', 'movementDrift missing: set to 0']);
  });

  it('drops unknown params', () => {
    const result = parseParams({ sparkle: 3 });
    expect(result.preset.params).not.toHaveProperty('sparkle');
    expect(result.warnings).toEqual(['Unknown param sparkle dropped']);
  });

  it('clamps levels to 0–127, and snaps Effects and choices to the value the editor sends, never OFF', () => {
    const result = parseParams({ tilt: 200, mix: -4, rate: 33.6, characterEffect: 120, textureEffect: 25, movementEngaged: 70, filterStyle: 0 });
    expect(result.preset.params).toMatchObject({
      tilt: 127,
      mix: 0,
      rate: 34,
      characterEffect: 98,
      textureEffect: 32,
      movementEngaged: 127,
      filterStyle: 21,
    });
    expect(result.warnings).toEqual([
      'characterEffect 120: set to 98',
      'textureEffect 25: set to 32',
      'tilt 200: set to 127',
      'rate 33.6: set to 34',
      'mix -4: set to 0',
      'movementEngaged 70: set to 127',
      'filterStyle 0: set to 21',
    ]);
  });

  it('replaces non-numbers with the default', () => {
    const result = parseParams({ tilt: '90', captureRouting: null });
    expect(result.preset.params).toMatchObject({ tilt: 64, captureRouting: 0 });
    expect(result.warnings).toEqual(['tilt "90": set to 64', 'captureRouting null: set to 0']);
  });

  it('shortens a name longer than 64 characters', () => {
    const result = parseFile((file) => {
      file.name = 'x'.repeat(70);
    });
    expect(result.preset.name).toBe('x'.repeat(64));
    expect(result.warnings).toEqual(['Name longer than 64 characters: shortened']);
  });

  it('reads missing notes and tags as empty, and tidies tags', () => {
    const missing = parseFile((file) => {
      delete file.notes;
      delete file.tags;
    });
    expect(missing.preset).toMatchObject({ notes: '', tags: [] });
    expect(missing.warnings).toEqual([]);

    const messy = parseFile((file) => {
      file.tags = [' Ambient ', 'ambient', '', 7, 'pad'];
    });
    expect(messy.preset.tags).toEqual(['Ambient', 'pad']);
    expect(messy.warnings).toEqual(['Tags tidied']);
  });
});

describe('presetTags', () => {
  it('reads a comma-separated list: trimmed, blanks dropped, each tag once whatever its case', () => {
    expect(presetTags(' ambient, Pad,,ambient , drone ')).toEqual(['ambient', 'Pad', 'drone']);
    expect(presetTags('')).toEqual([]);
  });

  it('shortens each tag to 32 characters', () => {
    expect(presetTags('y'.repeat(40))).toEqual(['y'.repeat(32)]);
  });
});

describe('Bundles', () => {
  const tape: Preset = { ...shimmer, id: '6f1c2d3e-0000-4000-8000-000000000002', name: 'Tape', notes: '', tags: [] };
  const bundle = () => JSON.parse(serializeBundle('My Presets', [shimmer, tape], '2026-10-07T09:00:00.000Z'));

  it('writes the envelope first, then each Preset as a full Preset object keeping its id, and no Slot numbers', () => {
    const file = bundle();

    expect(Object.keys(file)).toEqual(['format', 'schemaVersion', 'appVersion', 'name', 'exportedAt', 'presets']);
    expect(file).toMatchObject({ format: 'chroma-console-bundle', schemaVersion: SCHEMA_VERSION, name: 'My Presets' });
    expect(file.exportedAt).toBe('2026-10-07T09:00:00.000Z');
    expect(file.presets).toEqual([JSON.parse(serializePreset(shimmer)), JSON.parse(serializePreset(tape))]);
    expect(file).not.toHaveProperty('id');
    expect(JSON.stringify(file)).not.toMatch(/slot/i);
  });

  it('reads back every Preset in a Bundle, without problems', () => {
    expect(parseLibraryFile(JSON.stringify(bundle()))).toEqual({ ok: true, presets: [shimmer, tape], problems: [] });
  });

  it('reads a single Preset file as one Preset', () => {
    expect(parseLibraryFile(serializePreset(shimmer))).toEqual({ ok: true, presets: [shimmer], problems: [] });
  });

  it('migrates a schema 1 Bundle, Preset by Preset', () => {
    const file = { ...bundle(), schemaVersion: 1 };
    for (const p of file.presets) {
      p.schemaVersion = 1;
      delete p.params.moduleOrder;
    }
    const result = parseLibraryFile(JSON.stringify(file));

    expect(result.ok && result.presets.map((p) => p.params.moduleOrder)).toEqual([0, 0]);
    expect(result.ok && result.problems).toEqual([]);
  });

  it('skips a broken Preset inside a Bundle and reports it and any warnings by name or position', () => {
    const file = bundle();
    delete file.presets[0].params.mix;
    file.presets[1].id = '';
    file.presets.push('nope');

    expect(parseLibraryFile(JSON.stringify(file))).toEqual({
      ok: true,
      presets: [{ ...shimmer, params: { ...shimmer.params, mix: PARAMS.mix.default } }],
      problems: [
        `Shimmer Tape: mix missing: set to ${PARAMS.mix.default}`,
        'Preset 2: Missing id',
        'Preset 3: Not a Preset file',
      ],
    });
  });

  it('skips another pedal’s Preset inside a Bundle, naming the pedal it belongs to', () => {
    const file = bundle();
    file.presets[1].format = 'clean-preset';

    expect(parseLibraryFile(JSON.stringify(file))).toEqual({
      ok: true,
      presets: [shimmer],
      problems: ['Preset 2: This is a Clean Preset, open it in the Clean editor'],
    });
  });

  it.each([
    ['broken JSON', '{', 'Not a Preset or Bundle file'],
    ['another format', JSON.stringify({ format: 'something-else' }), 'Not a Preset or Bundle file'],
    ['a Bundle with no presets list', JSON.stringify({ format: 'chroma-console-bundle', schemaVersion: 1 }), 'Missing presets'],
    [
      'a Bundle made by a newer version',
      JSON.stringify({ format: 'chroma-console-bundle', schemaVersion: SCHEMA_VERSION + 1, presets: [] }),
      'Made by a newer version of the editor, please update',
    ],
    ['a Bundle missing its schemaVersion', JSON.stringify({ format: 'chroma-console-bundle', presets: [] }), 'Missing schemaVersion'],
    ['a broken Preset file', JSON.stringify({ format: 'chroma-console-preset', schemaVersion: 1 }), 'Missing id'],
    ['a Clean Preset', JSON.stringify({ format: 'clean-preset', schemaVersion: 1 }), 'This is a Clean Preset, open it in the Clean editor'],
    [
      'a Clean Bundle',
      JSON.stringify({ format: 'clean-bundle', schemaVersion: 1, presets: [] }),
      'This is a Clean Bundle, open it in the Clean editor',
    ],
    [
      'a Lost+Found Bundle',
      JSON.stringify({ format: 'lost-found-bundle', schemaVersion: 1, presets: [] }),
      'This is a Lost+Found Bundle, open it in the Lost+Found editor',
    ],
  ])('rejects %s', (_, text, error) => {
    expect(parseLibraryFile(text)).toEqual({ ok: false, error });
  });
});
