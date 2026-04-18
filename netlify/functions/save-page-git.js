/**
 * Commits updated HTML to GitHub so Netlify can rebuild.
 *
 * Netlify → Site settings → Environment variables:
 *   GITHUB_TOKEN       — classic PAT (repo scope) OR fine-grained: Contents Read/Write on this repo
 *   GITHUB_OWNER       — user or org name (exactly as in repo URL)
 *   GITHUB_REPO        — repo name only
 *   GITHUB_BRANCH      — branch Netlify builds from (often main or master)
 *   GITHUB_BASE_PATH   — optional, e.g. "docs" or "public" if HTML lives in a subfolder (no leading/trailing slash)
 *   EDITOR_USER / EDITOR_PASS — must match editor login
 */

const GH_API = 'https://api.github.com';

function githubErrorMessage(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    const j = JSON.parse(text);
    if (j.message) return j.message;
    if (j.error) return typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
  } catch (e) {
    /* not JSON */
  }
  return text.slice(0, 800);
}

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

  const token = (process.env.GITHUB_TOKEN || '').trim();
  const owner = (process.env.GITHUB_OWNER || '').trim();
  const repo = (process.env.GITHUB_REPO || '').trim();
  let branch = (process.env.GITHUB_BRANCH || 'main').trim();
  const basePath = (process.env.GITHUB_BASE_PATH || '').replace(/^\/+|\/+$/g, '');

  if (!token || !owner || !repo) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Server missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO',
      }),
    };
  }

  if (!file || typeof file !== 'string' || file.includes('..') || file.includes('\\')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file name' }) };
  }
  if (file.includes('/') && !basePath) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Use GITHUB_BASE_PATH instead of slashes in file name',
      }),
    };
  }
  if (!/\.html$/i.test(file)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only .html files allowed' }) };
  }
  if (!fullHtml || typeof fullHtml !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fullHtml' }) };
  }

  const relativePath = basePath ? `${basePath}/${file}` : file;
  const pathEncoded = relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'netlify-save-page-git',
  };

  const contentsUrl = `${GH_API}/repos/${owner}/${repo}/contents/${pathEncoded}`;
  const getUrl = `${contentsUrl}?ref=${encodeURIComponent(branch)}`;

  const getRes = await fetch(getUrl, { headers: ghHeaders });
  let sha = null;

  if (getRes.status === 404) {
    const errText = await getRes.text();
    const msg = githubErrorMessage(errText);
    if (msg && msg.toLowerCase().includes('no commit found for the ref')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Wrong branch',
          detail:
            `Branch "${branch}" was not found. Set GITHUB_BRANCH to your default branch (often main or master). GitHub said: ${msg}`,
        }),
      };
    }
    sha = null;
  } else if (!getRes.ok) {
    const errText = await getRes.text();
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'GitHub read failed',
        detail: githubErrorMessage(errText),
        hint: 'Check GITHUB_OWNER, GITHUB_REPO, token repo access, and branch name.',
      }),
    };
  } else {
    const meta = await getRes.json();
    sha = meta.sha || null;
  }

  const content = Buffer.from(fullHtml, 'utf8').toString('base64');
  const putPayload = {
    message: `Site editor: update ${relativePath}`,
    content,
    branch,
  };
  if (sha) {
    putPayload.sha = sha;
  }

  const putRes = await fetch(contentsUrl, {
    method: 'PUT',
    headers: {
      ...ghHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(putPayload),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    const ghMsg = githubErrorMessage(errText);
    let hint = '';
    if (/sha/i.test(ghMsg) && /wasn\'t supplied|required|mismatch/i.test(ghMsg)) {
      hint =
        ' The file may have moved or the branch is wrong. Set GITHUB_BASE_PATH if the site lives in a subfolder. If the default branch is master, set GITHUB_BRANCH=master.';
    }
    if (/403|Resource not accessible|permission/i.test(ghMsg)) {
      hint =
        ' Token needs repo access: classic PAT with "repo" scope, or fine-grained with Contents Read/Write. For org repos, authorize the token for SSO (GitHub → Settings → Applications → Authorized OAuth apps).';
    }
    if (/saml|sso/i.test(ghMsg)) {
      hint =
        ' Open github.com/settings/tokens → your token → Configure SSO → Authorize for this organization.';
    }
    if (/404/.test(String(putRes.status))) {
      hint =
        ' Repo or path not found. Confirm owner/repo name and GITHUB_BASE_PATH if files are not at repo root.';
    }
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'GitHub write failed',
        detail: ghMsg + hint,
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `${relativePath} committed to ${branch}. Netlify will rebuild shortly.`,
    }),
  };
};
