import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adoBuildTimelineUrl,
  formatFailedTimelineDiagnostics,
  formatFailedTimelineRecordLog,
  formatFailedTimelineRecordMarkdown,
  getFailedTimelineRecords,
  reportAdoFailedTimelineDiagnostics,
} from './livee2e-pr-github.js';

test('adoBuildTimelineUrl encodes org and project', () => {
  const url = adoBuildTimelineUrl('my org', 'my/project', 42);
  assert.equal(
    url,
    'https://dev.azure.com/my%20org/my%2Fproject/_apis/build/builds/42/timeline?api-version=7.1',
  );
});

test('getFailedTimelineRecords keeps only failed results', () => {
  const failed = getFailedTimelineRecords({
    records: [
      { name: 'ok', result: 'succeeded' },
      { name: 'bad', result: 'failed', errorCount: 2 },
      { name: 'skip', result: 'skipped' },
    ],
  });
  assert.equal(failed.length, 1);
  assert.equal(failed[0].name, 'bad');
});

test('formatFailedTimelineRecord includes issues and log URL', () => {
  const record = {
    name: 'Run tests',
    type: 'Task',
    result: 'failed',
    errorCount: 1,
    issues: [{ message: 'Command failed with exit code 1' }],
    log: { url: 'https://dev.azure.com/org/project/_apis/build/builds/1/logs/9' },
  };
  assert.match(formatFailedTimelineRecordMarkdown(record), /Run tests/);
  assert.match(formatFailedTimelineRecordMarkdown(record), /Command failed/);
  assert.match(formatFailedTimelineRecordMarkdown(record), /logs\/9/);
  assert.match(formatFailedTimelineRecordLog(record), /issue: Command failed/);
});

test('formatFailedTimelineDiagnostics handles empty failed set', () => {
  const { markdown, logText } = formatFailedTimelineDiagnostics([]);
  assert.match(markdown, /no records/);
  assert.match(logText, /no records/);
});

test('reportAdoFailedTimelineDiagnostics is best-effort on fetch errors', async () => {
  const warnings = [];
  const result = await reportAdoFailedTimelineDiagnostics({
    org: 'org',
    project: 'proj',
    buildId: '99',
    pat: 'secret',
    warn: (message) => warnings.push(message),
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.markdown, '');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /HTTP 500/);
  assert.ok(!warnings.some((line) => line.includes('secret')));
});

test('reportAdoFailedTimelineDiagnostics logs failed records', async () => {
  const logs = [];
  const result = await reportAdoFailedTimelineDiagnostics({
    org: 'org',
    project: 'proj',
    buildId: '12',
    pat: 'pat',
    log: (message) => logs.push(message),
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          records: [
            {
              name: 'Compile',
              type: 'Task',
              result: 'failed',
              errorCount: 1,
              issues: [{ message: 'Build failed' }],
            },
          ],
        };
      },
    }),
  });
  assert.match(result.markdown, /Compile/);
  assert.match(result.markdown, /Build failed/);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Compile/);
});
