/**
 * Commits updated HTML to GitHub so Netlify can rebuild (live-ish editing).
 *
 * Netlify env (Site settings → Environment variables):
 *   GITHUB_TOKEN      — fine-grained or classic PAT with Contents: Read/Write on this repo
 *   GITHUB_OWNER      — e.g. your-username or org name
 *   GITHUB_REPO       — repo name (no .git)
 *   GITHUB_BRANCH     — optional, default main
 *   EDITOR_USER       — must match editor login username
 *   EDITOR_PASS       — must match editor login password
 */

const GH_API = 'https://api.github.com';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, service: 'save-page-git' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { file, fullHtml, username, password } = body;
  const eu = process.env.EDITOR_USER || '';
  const ep = process.env.EDITOR_PASS || '';
  if (!eu || !ep) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server missing EDITOR_USER / EDITOR_PASS' }),
    };
  }
  if (username !== eu || password !== ep) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Server missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO',
      }),
    };
  }

  if (!file || typeof file !== 'string' || file.includes('..') || file.includes('/') || file.includes('\\')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file name' }) };
  }
  if (!/\.html$/i.test(file)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only .html files allowed' }) };
  }
  if (!fullHtml || typeof fullHtml !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fullHtml' }) };
  }

  const pathEncoded = file
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${pathEncoded}?ref=${encodeURIComponent(branch)}`;

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const getRes = await fetch(url, { headers: ghHeaders });
  let sha = null;
  if (getRes.status === 404) {
    sha = null;
  } else if (!getRes.ok) {
    const detail = await getRes.text();
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'GitHub read failed', detail: detail.slice(0, 400) }),
    };
  } else {
    const meta = await getRes.json();
    sha = meta.sha || null;
  }

  const content = Buffer.from(fullHtml, 'utf8').toString('base64');
  const putPayload = {
    message: `Site editor: update ${file}`,
    content,
    branch,
  };
  if (sha) putPayload.sha = sha;

  const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${pathEncoded}`, {
    method: 'PUT',
    headers: {
      ...ghHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(putPayload),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'GitHub write failed', detail: detail.slice(0, 400) }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `${file} committed to ${branch}. Netlify will rebuild shortly.`,
    }),
  };
};
