/** Browser-only wash worker. Uses upstream simulation, input conversion and reporting. */
import { wash, SIM_VERSION, composeParamLayers, washRegistry } from '../../../../packages/sim-core/src/index.ts';
import { createGpuContext } from '../../../../packages/sim-gpu/src/index.ts';
import { washReportOf } from '../../../../packages/wash-runner/src/report.ts';
import { washInputOf } from './wash-input.ts';
import params from '../../../../packages/calibration/anchors/anchored-v8.owner-capsule.json';

self.onmessage = async (event) => {
  const { manifest, tier } = event.data;
  const started = performance.now();
  let gpu: any = null;
  try {
    if (navigator.gpu) {
      try { gpu = await createGpuContext({ entry: { gpu: navigator.gpu, os: 'browser', webgpu: 'browser WebGPU', runtime: navigator.userAgent }, sim: SIM_VERSION, physics: 'none' }); } catch { gpu = null; }
    }
    const layers = composeParamLayers(washRegistry(), [{ name: params.provenance.name, origin: 'calibration', role: 'set', overrides: params.overrides } as any]);
    const input = { ...washInputOf(manifest, { tier }), params: layers.params, paramSets: layers.records, detergent: { name: 'Finish Powerball Ultimate', dose: 0.0129 } };
    const result = await wash(input, { gpu, cells: true, keepScene: false, onProgress: (p) => self.postMessage({ type: 'progress', progress: p.fraction, stage: p.stage }) });
    const bundle = washReportOf(manifest, result, { tier, runtimeS: (performance.now() - started) / 1000, rule: null, simVersion: result.provenance.simVersion, tierNote: `${tier === 'fast' ? 'Quick preview: results may differ from a full wash. ' : ''}${gpu ? 'Browser WebGPU.' : 'Browser CPU fallback; this can take considerably longer.'}` });
    self.postMessage({ type: 'done', ...bundle });
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally { if (gpu) { try { await gpu.drain(); } catch {} gpu.destroy(); } }
};
