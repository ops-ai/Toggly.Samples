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

module.exports = { findStickyComment, upsertPrComment };
