// Fail explicitly when copied conversion logic or the calibrated upstream defaults change.
// Review and regenerate the browser adapter after merging upstream.
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let input = read('packages/wash-runner/src/input.ts')
  .replace("import { washParamFilesFor, type WashParamChoice } from './defaults.ts';\n", '')
  .replace("import { composeParamFiles, ParamSetFileError } from './sim.ts';\n", '')
  .replace("import type { SimSoilRecord, WashInput, WashItemInput } from './sim.ts';", "import type { WashInput, WashItemInput } from '../../../../packages/sim-core/src/index.ts';\ntype SimSoilRecord = WashItemInput['soils'][number];");
const start = input.indexOf('export function withWashParams(');
const end = input.indexOf('/**\n * The loaded items', start);
if (start < 0 || end < 0) throw Error('Upstream input adapter changed; review the static conversion.');
input = input.slice(0, start) + input.slice(end);
if (input !== read('apps/web/src/static/wash-input.ts')) throw Error('Upstream wash input changed; update apps/web/src/static/wash-input.ts.');
const defaults = read('packages/wash-runner/src/defaults.ts');
const adapter = read('apps/web/src/static/wash-worker.ts');
if (!defaults.includes("paramSets: ['calibration/anchors/anchored-v8.owner-capsule.json']") || !defaults.includes('dose_g: 12.9') || !adapter.includes('anchored-v8.owner-capsule.json')) throw Error('Upstream wash defaults changed; update the browser parameters.');
console.log('Static adapter matches upstream wash input and calibrated defaults.');
