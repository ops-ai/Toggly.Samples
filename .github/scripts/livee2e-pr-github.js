// Helpers for live-e2e-pr.yml (github-script steps).
'use strict';

/**
 * @param {import('@octokit/rest').Octokit} github
 */
async function findStickyComment(github, { owner, repo, issue_number, marker }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
    per_page: 100,
  });
  return comments.find((c) => c.body?.includes(marker));
}

/**
 * @param {import('@octokit/rest').Octokit} github
 */
function buildPrCommentBody(marker, heading, content) {
  return [marker, heading, '', content].join('\n');
}

async function upsertPrComment(github, { owner, repo, issue_number, marker, body }) {
  const existing = await findStickyComment(github, {
    owner,
    repo,
    issue_number,
    marker,
  });
  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return;
  }
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body,
  });
}

function adoBuildTimelineUrl(org, project, buildId) {
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;
  return `${base}/_apis/build/builds/${buildId}/timeline?api-version=7.1`;
}

/**
 * @param {{ records?: Array<Record<string, unknown>> }} timeline
 */
function getFailedTimelineRecords(timeline) {
  const records = timeline?.records ?? [];
  return records.filter((record) => record?.result === 'failed');
}

/**
 * @param {{ name?: string, type?: string, result?: string, errorCount?: number, issues?: Array<{ message?: string }>, log?: { url?: string } }} record
 */
function formatFailedTimelineRecordMarkdown(record) {
  const name = record.name ?? '(unnamed)';
  const type = record.type ?? 'unknown';
  const result = record.result ?? 'unknown';
  const errorCount = record.errorCount ?? 0;
  const lines = [`- **${name}** (type: \`${type}\`, result: \`${result}\`, errorCount: ${errorCount})`];
  for (const issue of record.issues ?? []) {
    if (issue?.message) {
      lines.push(`  - ${issue.message}`);
    }
  }
  if (record.log?.url) {
    lines.push(`  - Log: ${record.log.url}`);
  }
  return lines.join('\n');
}

/**
 * @param {{ name?: string, type?: string, result?: string, errorCount?: number, issues?: Array<{ message?: string }>, log?: { url?: string } }} record
 */
function formatFailedTimelineRecordLog(record) {
  const name = record.name ?? '(unnamed)';
  const type = record.type ?? 'unknown';
  const result = record.result ?? 'unknown';
  const errorCount = record.errorCount ?? 0;
  const lines = [`ADO timeline failed record: name=${name} type=${type} result=${result} errorCount=${errorCount}`];
  for (const issue of record.issues ?? []) {
    if (issue?.message) {
      lines.push(`  issue: ${issue.message}`);
    }
  }
  if (record.log?.url) {
    lines.push(`  log: ${record.log.url}`);
  }
  return lines.join('\n');
}

function formatFailedTimelineDiagnostics(failedRecords) {
  if (!failedRecords.length) {
    return {
      markdown: 'ADO build timeline: no records with `result: failed`.',
      logText: 'ADO build timeline: no records with result failed.',
    };
  }
  const markdown = [
    '### ADO failed timeline records',
    '',
    ...failedRecords.map((record) => formatFailedTimelineRecordMarkdown(record)),
  ].join('\n');
  const logText = failedRecords.map((record) => formatFailedTimelineRecordLog(record)).join('\n\n');
  return { markdown, logText };
}

async function fetchAdoBuildTimeline({ org, project, buildId, pat, fetchImpl = fetch }) {
  const url = adoBuildTimelineUrl(org, project, buildId);
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`:${pat}`, 'utf8').toString('base64')}`,
    },
  });
  if (!response.ok) {
    throw new Error(`ADO timeline HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Best-effort: never throws; does not log the PAT.
 */
async function reportAdoFailedTimelineDiagnostics({
  org,
  project,
  buildId,
  pat,
  log = (message) => console.log(message),
  warn = (message) => console.warn(message),
  fetchImpl = fetch,
}) {
  if (!org || !project || !buildId || !pat) {
    warn('Skipping ADO timeline diagnostics: missing org, project, build id, or PAT.');
    return { markdown: '', logText: '' };
  }
  try {
    const timeline = await fetchAdoBuildTimeline({ org, project, buildId, pat, fetchImpl });
    const failedRecords = getFailedTimelineRecords(timeline);
    const formatted = formatFailedTimelineDiagnostics(failedRecords);
    log(formatted.logText);
    return formatted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(`Could not fetch ADO build timeline (best-effort): ${message}`);
    return { markdown: '', logText: '' };
  }
}

module.exports = {
  findStickyComment,
  upsertPrComment,
  buildPrCommentBody,
  adoBuildTimelineUrl,
  getFailedTimelineRecords,
  formatFailedTimelineRecordMarkdown,
  formatFailedTimelineRecordLog,
  formatFailedTimelineDiagnostics,
  fetchAdoBuildTimeline,
  reportAdoFailedTimelineDiagnostics,
};
