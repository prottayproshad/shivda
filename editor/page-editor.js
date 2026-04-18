/**
 * Inline page editor: login → edit mode → click content → modal → persist via
 * (1) Netlify + GitHub — on a deployed site (not localhost), Save commits HTML via
 *     /.netlify/functions/save-page-git (configure env vars on Netlify), or
 * (2) Python — http://localhost:5000/api/save-page for local disk saves, or
 * (3) Download HTML — offline export.
 */
(function () {
  'use strict';

  function getScriptEl() {
    return (
      document.querySelector('script[src*="page-editor.js"][data-page-file]') ||
      document.currentScript
    );
  }

  const scriptEl = getScriptEl();
  const PAGE_FILE =
    (scriptEl && scriptEl.getAttribute('data-page-file')) ||
    (location.pathname.split('/').pop() || 'index.html');
  const API_BASE = (
    (scriptEl && scriptEl.getAttribute('data-api-base')) ||
    'http://localhost:5000/api'
  ).replace(/\/$/, '');

  function resolveRemoteSaveUrl() {
    var ex = scriptEl && scriptEl.getAttribute('data-save-url');
    if (ex) return ex.replace(/\/$/, '');
    if (typeof location === 'undefined' || !location.hostname) return null;
    if (location.protocol === 'file:') return null;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
    return location.origin.replace(/\/$/, '') + '/.netlify/functions/save-page-git';
  }

  const REMOTE_SAVE_URL = resolveRemoteSaveUrl();

  const LS_KEY = 'adminLoggedIn';
  const ADMIN_USER = 'shivus14';
  const ADMIN_PASS = 'Take7&this';

  const EDITABLE_TAGS = new Set([
    'IMG',
    'VIDEO',
    'IFRAME',
    'PICTURE',
    'SOURCE',
    'A',
    'P',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'SPAN',
    'LI',
    'TD',
    'TH',
    'LABEL',
    'BUTTON',
    'FIGCAPTION',
    'BLOCKQUOTE',
    'STRONG',
    'EM',
    'B',
    'I',
    'U',
    'SMALL',
    'CITE',
    'TIME',
    'DIV',
    'SECTION',
    'ARTICLE',
    'HEADER',
    'FOOTER',
    'NAV',
    'MAIN',
    'ADDRESS',
    'PRE',
    'CODE',
    'DT',
    'DD',
  ]);

  let isLoggedIn = localStorage.getItem(LS_KEY) === 'true';
  let isEditMode = false;
  let currentEditing = null;
  let dirty = false;
  let backendOk = false;
  let captureHandler = null;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function injectUi() {
    if (document.getElementById('page-editor-root')) return;

    const root = document.createElement('div');
    root.id = 'page-editor-root';
    root.className = 'page-editor-ui';
    root.innerHTML = `
<div class="pe-login-overlay pe-overlay" id="pe-loginOverlay" aria-hidden="true">
  <div class="pe-panel" role="dialog" aria-labelledby="pe-loginTitle">
    <h2 id="pe-loginTitle">Admin login</h2>
    <div class="pe-field">
      <label for="pe-user">Username</label>
      <input type="text" id="pe-user" autocomplete="username" />
    </div>
    <div class="pe-field">
      <label for="pe-pass">Password</label>
      <input type="password" id="pe-pass" autocomplete="current-password" />
    </div>
    <div class="pe-error" id="pe-loginErr"></div>
    <div class="pe-actions">
      <button type="button" class="pe-secondary" id="pe-loginCancel">Cancel</button>
      <button type="button" class="pe-primary" id="pe-loginSubmit">Sign in</button>
    </div>
  </div>
</div>
<div class="pe-admin-toolbar" id="pe-toolbar">
  <span class="pe-status">Edit mode — click any text, link, image, or block on this page</span>
  <span>
    <button type="button" class="pe-btn pe-btn-save" id="pe-downloadHtml" title="Save changes into an HTML file you upload to Netlify">
      Download HTML
    </button>
    <button type="button" class="pe-btn pe-btn-server" id="pe-saveServer" title="Requires Python backend on this machine">
      Save on server
    </button>
    <button type="button" class="pe-btn pe-btn-exit" id="pe-exit">Exit</button>
    <button type="button" class="pe-btn pe-btn-logout" id="pe-logout">Logout</button>
  </span>
</div>
<div class="pe-edit-overlay pe-overlay" id="pe-editOverlay" aria-hidden="true">
  <div class="pe-panel" role="dialog" aria-labelledby="pe-editTitle">
    <h2 id="pe-editTitle">Edit</h2>
    <div id="pe-editBody"></div>
    <div class="pe-actions">
      <button type="button" class="pe-secondary" id="pe-editCancel">Cancel</button>
      <button type="button" class="pe-primary" id="pe-editSave">Apply</button>
    </div>
  </div>
</div>
<div class="pe-toast" id="pe-toast"></div>
<div class="pe-backend-status" id="pe-backend">Backend: <span id="pe-backendText">…</span></div>`;
    document.body.appendChild(root);

    document.getElementById('pe-loginCancel').addEventListener('click', closeLogin);
    document.getElementById('pe-loginSubmit').addEventListener('click', doLogin);
    document.getElementById('pe-loginOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'pe-loginOverlay') closeLogin();
    });
    document.getElementById('pe-downloadHtml').addEventListener('click', downloadPageHtml);
    document.getElementById('pe-saveServer').addEventListener('click', saveToServer);
    document.getElementById('pe-exit').addEventListener('click', exitEditMode);
    document.getElementById('pe-logout').addEventListener('click', logout);
    document.getElementById('pe-editCancel').addEventListener('click', closeEditModal);
    document.getElementById('pe-editSave').addEventListener('click', applyEditModal);
    document.getElementById('pe-editOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'pe-editOverlay') closeEditModal();
    });

    document.addEventListener(
      'click',
      function (e) {
        if (e.target.closest('.pe-open-login')) {
          e.preventDefault();
          openLogin();
        }
      },
      true
    );

    updateToolbarForBackend();
  }

  function toast(msg, isErr) {
    const el = document.getElementById('pe-toast');
    el.textContent = msg;
    el.className = 'pe-toast pe-show' + (isErr ? ' pe-err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove('pe-show');
    }, 4200);
  }

  function isInsideChrome(el) {
    return !!(el && el.closest && el.closest('.page-editor-ui'));
  }

  function openLogin() {
    injectUi();
    document.getElementById('pe-loginErr').textContent = '';
    document.getElementById('pe-loginOverlay').classList.add('pe-open');
    document.getElementById('pe-loginOverlay').setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      document.getElementById('pe-user').focus();
    }, 0);
  }

  function closeLogin() {
    const o = document.getElementById('pe-loginOverlay');
    if (o) {
      o.classList.remove('pe-open');
      o.setAttribute('aria-hidden', 'true');
    }
  }

  function doLogin() {
    const u = document.getElementById('pe-user').value.trim();
    const p = document.getElementById('pe-pass').value;
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      isLoggedIn = true;
      localStorage.setItem(LS_KEY, 'true');
      closeLogin();
      enterEditMode();
      toast('Signed in — edit mode on for ' + PAGE_FILE);
    } else {
      document.getElementById('pe-loginErr').textContent = 'Invalid username or password.';
    }
  }

  function enterEditMode() {
    if (!isLoggedIn) return;
    injectUi();
    isEditMode = true;
    dirty = false;
    document.body.classList.add('pe-edit-mode');
    document.getElementById('pe-toolbar').classList.add('pe-active');
    if (!captureHandler) {
      captureHandler = function (e) {
        if (!isEditMode || !isLoggedIn) return;
        if (e.button !== 0) return;
        if (isInsideChrome(e.target)) return;
        const el = pickEditable(e.clientX, e.clientY);
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        openEditModal(el);
      };
      document.addEventListener('click', captureHandler, true);
    }
  }

  function exitEditMode() {
    if (dirty && !confirm('You have unsaved edits. Exit edit mode anyway?')) return;
    isEditMode = false;
    dirty = false;
    document.body.classList.remove('pe-edit-mode');
    const tb = document.getElementById('pe-toolbar');
    if (tb) tb.classList.remove('pe-active');
    if (captureHandler) {
      document.removeEventListener('click', captureHandler, true);
      captureHandler = null;
    }
    closeEditModal();
  }

  function logout() {
    if (!confirm('Log out and leave edit mode?')) return;
    localStorage.removeItem(LS_KEY);
    isLoggedIn = false;
    exitEditMode();
    const u = document.getElementById('pe-user');
    const p = document.getElementById('pe-pass');
    if (u) u.value = '';
    if (p) p.value = '';
  }

  function pickEditable(x, y) {
    let stack;
    try {
      stack = document.elementsFromPoint(x, y);
    } catch (err) {
      return null;
    }
    if (!stack || !stack.length) return null;
    for (let i = 0; i < stack.length; i++) {
      let el = stack[i];
      if (!(el instanceof Element)) continue;
      if (el === document.documentElement || el === document.body) continue;
      if (isInsideChrome(el)) return null;
      if (el.closest('.header-burger')) continue;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      if (tag === 'SVG' || tag === 'PATH' || tag === 'G' || tag === 'USE') {
        const svgHost = el.closest('svg');
        if (svgHost && !isInsideChrome(svgHost)) {
          const par = svgHost.parentElement;
          if (par && EDITABLE_TAGS.has(par.tagName)) el = par;
          else continue;
        } else continue;
      }
      if (tag === 'IMG') return el;
      if (tag === 'VIDEO' || tag === 'IFRAME') return el;
      if (tag === 'SOURCE' && el.parentElement && el.parentElement.tagName === 'VIDEO')
        return el.parentElement;
      if (!EDITABLE_TAGS.has(tag)) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 0) return el;
      if (tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME') return el;
      if (tag === 'A' && el.getAttribute('href')) return el;
      if (tag === 'DIV' || tag === 'SECTION') {
        const r = el.getBoundingClientRect();
        if (r.width > 12 && r.height > 12 && el.querySelector('img,video,iframe'))
          return el;
      }
    }
    return null;
  }

  function detectKind(el) {
    const tag = el.tagName;
    if (tag === 'IMG') return 'image';
    if (tag === 'VIDEO' || tag === 'IFRAME') return 'embed';
    if (tag === 'A') return 'link';
    const hasElementChildren = Array.from(el.childNodes).some(function (n) {
      return n.nodeType === 1 && n.tagName !== 'BR';
    });
    if (hasElementChildren) return 'html';
    return 'text';
  }

  var MAX_IMAGE_UPLOAD = 5 * 1024 * 1024;

  function bindImageFileInput() {
    const file = document.getElementById('pe-v-file');
    const srcInput = document.getElementById('pe-v-src');
    const prev = document.getElementById('pe-img-preview');
    if (!file || !srcInput || !prev) return;
    file.addEventListener('change', function () {
      const f = file.files && file.files[0];
      if (!f) return;
      if (!f.type.startsWith('image/')) {
        toast('Please choose an image file.', true);
        file.value = '';
        return;
      }
      if (f.size > MAX_IMAGE_UPLOAD) {
        toast('File too large (max 5 MB). Compress it or use an image URL instead.', true);
        file.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        srcInput.value = reader.result;
        prev.src = reader.result;
        toast('Image loaded — click Apply to use it on the page');
      };
      reader.onerror = function () {
        toast('Could not read that file.', true);
      };
      reader.readAsDataURL(f);
    });
    srcInput.addEventListener('input', function () {
      const v = srcInput.value.trim();
      if (!v) return;
      if (
        v.indexOf('data:') === 0 ||
        v.indexOf('http') === 0 ||
        v.indexOf('//') === 0 ||
        v.indexOf('/') === 0
      ) {
        try {
          prev.src = v;
        } catch (e) {
          /* ignore invalid preview */
        }
      }
    });
  }

  function doctypePrefix() {
    var dt = document.doctype;
    if (!dt) return '<!DOCTYPE html>';
    var parts = ['<!DOCTYPE ', dt.name];
    if (dt.publicId) {
      parts.push(' PUBLIC "', dt.publicId, '"');
      if (dt.systemId) parts.push(' "', dt.systemId, '"');
    } else if (dt.systemId) {
      parts.push(' SYSTEM "', dt.systemId, '"');
    }
    parts.push('>');
    return parts.join('');
  }

  function getFullDocumentHtmlForExport() {
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('.page-editor-ui').forEach(function (n) {
      n.remove();
    });
    var bodyEl = clone.querySelector('body');
    if (bodyEl) bodyEl.classList.remove('pe-edit-mode');
    return doctypePrefix() + '\n' + clone.outerHTML;
  }

  function updateToolbarForBackend() {
    var btn = document.getElementById('pe-saveServer');
    if (!btn) return;
    btn.disabled = !backendOk;
    if (backendOk) {
      btn.title = REMOTE_SAVE_URL
        ? 'Commits this page to GitHub; Netlify rebuilds in ~1–2 minutes.'
        : 'Writes this page using the Python API in this folder.';
    } else {
      btn.title =
        'Save service offline. Deploy Netlify function + GitHub env, run Python locally, or use Download HTML.';
    }
  }

  function openEditModal(el) {
    currentEditing = el;
    const kind = detectKind(el);
    const title = document.getElementById('pe-editTitle');
    const body = document.getElementById('pe-editBody');
    title.textContent =
      kind === 'image'
        ? 'Edit image'
        : kind === 'embed'
          ? 'Edit embed'
          : kind === 'link'
            ? 'Edit link'
            : kind === 'html'
              ? 'Edit HTML'
              : 'Edit text';

    if (kind === 'image') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      body.innerHTML =
        '<div class="pe-field"><label>Preview</label><img id="pe-img-preview" src="' +
        escapeHtml(src) +
        '" style="max-width:100%;max-height:160px;border-radius:4px;object-fit:contain" alt=""/></div>' +
        '<div class="pe-field"><label for="pe-v-file">Upload image</label><input id="pe-v-file" type="file" accept="image/*"/>' +
        '<p class="pe-hint">Upload embeds the file in the page (data URL). Good for Netlify; very large images increase HTML size.</p></div>' +
        '<div class="pe-field"><label for="pe-v-src">Or image URL</label><input id="pe-v-src" type="text" value="' +
        escapeHtml(src) +
        '"/></div>' +
        '<div class="pe-field"><label for="pe-v-alt">Alt text</label><input id="pe-v-alt" type="text" value="' +
        escapeHtml(alt) +
        '"/></div>';
      bindImageFileInput();
    } else if (kind === 'embed') {
      const src = el.getAttribute('src') || '';
      body.innerHTML =
        '<div class="pe-field"><label for="pe-v-src">URL (src)</label><input id="pe-v-src" type="text" value="' +
        escapeHtml(src) +
        '"/></div>';
    } else if (kind === 'link') {
      const href = el.getAttribute('href') || '';
      const txt = el.textContent || '';
      body.innerHTML =
        '<div class="pe-field"><label for="pe-v-text">Link text</label><textarea id="pe-v-text">' +
        escapeHtml(txt) +
        '</textarea></div>' +
        '<div class="pe-field"><label for="pe-v-href">URL (href)</label><input id="pe-v-href" type="text" value="' +
        escapeHtml(href) +
        '"/></div>';
    } else if (kind === 'html') {
      body.innerHTML =
        '<div class="pe-field"><label for="pe-v-html">Inner HTML</label><textarea id="pe-v-html">' +
        escapeHtml(el.innerHTML) +
        '</textarea></div>';
    } else {
      body.innerHTML =
        '<div class="pe-field"><label for="pe-v-text">Text</label><textarea id="pe-v-text">' +
        escapeHtml(el.textContent || '') +
        '</textarea></div>';
    }

    document.getElementById('pe-editOverlay').classList.add('pe-open');
    document.getElementById('pe-editOverlay').setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    currentEditing = null;
    const o = document.getElementById('pe-editOverlay');
    if (o) {
      o.classList.remove('pe-open');
      o.setAttribute('aria-hidden', 'true');
    }
  }

  function applyEditModal() {
    if (!currentEditing) return;
    const el = currentEditing;
    const kind = detectKind(el);
    try {
      if (kind === 'image') {
        el.setAttribute('src', document.getElementById('pe-v-src').value);
        el.setAttribute('alt', document.getElementById('pe-v-alt').value);
      } else if (kind === 'embed') {
        el.setAttribute('src', document.getElementById('pe-v-src').value);
      } else if (kind === 'link') {
        const t = document.getElementById('pe-v-text').value;
        const h = document.getElementById('pe-v-href').value;
        el.textContent = t;
        el.setAttribute('href', h);
      } else if (kind === 'html') {
        el.innerHTML = document.getElementById('pe-v-html').value;
      } else {
        el.textContent = document.getElementById('pe-v-text').value;
      }
      dirty = true;
      toast('Change applied — use Download HTML (Netlify) or Save on server (local)');
    } catch (err) {
      toast('Could not apply: ' + (err.message || err), true);
      return;
    }
    closeEditModal();
  }

  function stripEditorFromBodyHtml() {
    const holder = document.createElement('div');
    holder.innerHTML = document.body.innerHTML;
    holder.querySelectorAll('.page-editor-ui').forEach(function (n) {
      n.remove();
    });
    return holder.innerHTML;
  }

  function downloadPageHtml() {
    if (!dirty) {
      toast('Nothing new to export — edit something first, then download.', true);
      return;
    }
    try {
      var html = getFullDocumentHtmlForExport();
      var safeName = PAGE_FILE.replace(/[^a-zA-Z0-9._\- ]/g, '_') || 'page.html';
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dirty = false;
      toast('Downloaded ' + safeName + ' — replace that file in your project and deploy to Netlify.');
    } catch (e) {
      toast('Download failed: ' + (e.message || String(e)), true);
    }
  }

  function saveToServer() {
    if (!backendOk) {
      toast(
        'Save service unreachable. Use Download HTML, or configure Netlify + GitHub (see netlify/functions).',
        true
      );
      return;
    }
    if (!dirty) {
      toast('No changes to save.', true);
      return;
    }
    toast('Saving…');
    const ctrl = new AbortController();
    const tid = setTimeout(function () {
      ctrl.abort();
    }, 90000);
    const creds = { username: ADMIN_USER, password: ADMIN_PASS };

    if (REMOTE_SAVE_URL) {
      var fullHtml = getFullDocumentHtmlForExport();
      fetch(REMOTE_SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.assign({ file: PAGE_FILE, fullHtml: fullHtml }, creds)
        ),
        signal: ctrl.signal,
      })
        .then(function (r) {
          return r.json().then(function (data) {
            clearTimeout(tid);
            if (!r.ok) {
              var msg =
                data.detail ||
                data.hint ||
                data.error ||
                r.statusText ||
                'Save failed';
              if (data.error && data.detail && data.detail !== data.error) {
                msg = data.error + ': ' + data.detail;
              }
              toast(String(msg).slice(0, 500), true);
              return;
            }
            if (data.success) {
              dirty = false;
              toast(
                data.message ||
                  'Committed — GitHub updated; wait for Netlify to finish rebuilding (~1–2 min).'
              );
            } else {
              toast(String(data.error || data.detail || 'Save failed').slice(0, 500), true);
            }
          });
        })
        .catch(function (e) {
          clearTimeout(tid);
          toast('Save failed: ' + (e.message || String(e)), true);
        });
    } else {
      const bodyHtml = stripEditorFromBodyHtml();
      fetch(API_BASE + '/save-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.assign({ file: PAGE_FILE, bodyHtml: bodyHtml }, creds)
        ),
        signal: ctrl.signal,
      })
        .then(function (r) {
          clearTimeout(tid);
          if (!r.ok) return r.json().then(function (j) {
            throw new Error(j.error || r.statusText);
          });
          return r.json();
        })
        .then(function (data) {
          if (data.success) {
            dirty = false;
            toast('Saved ' + PAGE_FILE + ' on disk');
          } else {
            toast(data.error || 'Save failed', true);
          }
        })
        .catch(function (e) {
          clearTimeout(tid);
          toast('Save failed: ' + (e.message || String(e)), true);
        });
    }
  }

  async function pingBackend() {
    const statusEl = document.getElementById('pe-backend');
    const textEl = document.getElementById('pe-backendText');
    let ok = false;
    let label = 'offline';
    try {
      if (REMOTE_SAVE_URL) {
        const r = await fetch(REMOTE_SAVE_URL, { method: 'GET', cache: 'no-store' });
        if (r.ok) {
          ok = true;
          label = 'live save';
        }
      }
    } catch (e) {
      /* ignore */
    }
    if (!ok) {
      try {
        const r2 = await fetch(API_BASE.replace(/\/api$/, '') + '/health', {
          method: 'GET',
          cache: 'no-store',
        });
        if (r2.ok) {
          ok = true;
          label = 'local';
        }
      } catch (e) {
        /* ignore */
      }
    }
    backendOk = ok;
    if (textEl) {
      textEl.textContent = ok ? label : 'offline';
      textEl.style.color = ok ? '#2e7d32' : '#c62828';
    }
    if (statusEl) {
      if (!ok) statusEl.classList.add('pe-show');
      else statusEl.classList.remove('pe-show');
    }
    updateToolbarForBackend();
  }

  function onReady() {
    injectUi();
    pingBackend();
    setInterval(pingBackend, 8000);
    if (isLoggedIn) enterEditMode();
  }

  window.PageEditor = {
    openLogin: openLogin,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    downloadPageHtml: downloadPageHtml,
    saveToServer: saveToServer,
    pageFile: PAGE_FILE,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
