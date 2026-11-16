/** Production-browser fixture for the local session adapter. It deliberately avoids a wash
 * with loaded items: the browser test checks empty-wash completion without exercising GPU code.
 */

import { createSession, health, listLevels, SessionApi } from '../api.ts';

const output = document.querySelector<HTMLPreElement>('#result');
if (output === null) throw new Error('Missing #result element');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fail(error: unknown): void {
  output!.dataset.status = 'failed';
  output!.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
}

async function main(): Promise<void> {
  const status = await health();
  assert(status.ok, 'the local health endpoint should answer successfully');
  assert(status.benchmark_mode === false, 'the local session should be open mode');

  const levels = await listLevels();
  assert(levels.some((level) => level.id === 'tutorial'), 'the tutorial should be listed');

  const placedSession = await createSession('tutorial');
  assert(placedSession.session_id.length > 0, 'session creation should return an id');
  assert(placedSession.level_id === 'tutorial', 'the created session should use the tutorial');
  const placedApi = new SessionApi(placedSession.session_id);

  const slots = await placedApi.listSlots('lower_rack', 'plate_01');
  assert(slots.accepted, 'listing plate slots should succeed');
  const seat = slots.slots.find(
    (slot) => slot.drop_free === true && slot.drop_seats === true && slot.suggested_drop,
  );
  assert(seat?.suggested_drop !== undefined, 'the tutorial plate should have a free suggested seat');

  const placed = await placedApi.place({
    item_id: 'plate_01',
    frame: 'lower_rack',
    ...seat.suggested_drop,
  });
  assert(placed.accepted, 'placing plate_01 should succeed');

  const scene = await placedApi.scene();
  assert(
    scene.state.placed.some((item) => item.item_id === 'plate_01'),
    'the placed plate should appear in the local scene',
  );

  const emptySession = await createSession('tutorial');
  const emptyApi = new SessionApi(emptySession.session_id);
  const cycle = await emptyApi.startCycle('fast');
  assert(cycle.accepted, 'an empty cycle should start');

  let report = await emptyApi.getReport();
  const deadline = Date.now() + 10_000;
  while (report.accepted && (report.status === 'queued' || report.status === 'running')) {
    assert(Date.now() < deadline, 'the empty wash should finish within ten seconds');
    await new Promise((resolve) => setTimeout(resolve, 20));
    report = await emptyApi.getReport();
  }
  assert(report.accepted && report.status === 'done', 'the empty cycle should produce a report');
  assert(report.report.job.fidelity === 'fast', 'the empty report should retain the requested tier');
  assert(report.report.score.points === 0, 'an empty load should score zero points');
  assert(
    report.report.items.length > 0 && report.report.items.every((item) => !item.loaded),
    'every item should be reported as unloaded after the empty wash',
  );

  output!.dataset.status = 'passed';
  output!.textContent = JSON.stringify(
    {
      passed: true,
      sessionCreated: true,
      placedItem: 'plate_01',
      emptyWash: report.report.job.fidelity,
      emptyItems: report.report.items.length,
      points: report.report.score.points,
    },
    null,
    2,
  );
}

void main().catch(fail);
