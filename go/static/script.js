// ── STATE ──
let groups    = [];
let selGrp    = null;
let sbShrunk  = false;
let confirmCb = null;
let userHash  = '';

// ── UTILS ──
const $      = id => document.getElementById(id);
const esc    = s  => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isMob  = () => window.innerWidth <= 767;
function grp(id)      { return groups.find(g => g.id === id); }
function sc(gid, sid) { return grp(gid)?.scripts?.find(s => s.id === sid); }
function init(name)   { return name.trim().charAt(0).toUpperCase(); }

// ── ICONS ──
const ICO = {
  chevD:  `<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 1.5L4.5 5L8 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevU:  `<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 5.5L4.5 2L8 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pencil: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.5 1.5L9 3L3.5 9H1.5V7L7.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  clip:   `<svg width="10" height="12" viewBox="0 0 10 12" fill="none"><rect x="1" y="2.5" width="8" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 2.5V1.8C3.5 1.36 3.86 1 4.3 1H5.7C6.14 1 6.5 1.36 6.5 1.8V2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  check:  `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  x:      `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
};

// ── HELPERS ──
function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

// ── API ──
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── LOAD DATA ──
async function loadGroups() {
  try {
    const data = await api('GET', '/api/groups');
    groups = data.map(g => ({ ...g, scripts: [], loaded: false }));
    if (groups.length) {
      selGrp = groups[0].id;
      await loadScripts(selGrp);
    }
    render();
  } catch {
    toast('failed to load groups');
  }
}

async function loadScripts(gid) {
  const g = grp(gid);
  if (!g || g.loaded) return;
  try {
    const data = await api('GET', `/api/groups/${gid}/scripts`);
    g.scripts = data.map(s => ({ ...s, exp: false, edit: false }));
    g.loaded  = true;
  } catch {
    toast('failed to load scripts');
  }
}

// ── RENDER ──
function render() {
  renderGroups();
  renderScripts();
  renderPanelHead();
}

function renderGroups() {
  const list = $('grpList');
  list.innerHTML = '';
  groups.forEach(g => {
    const d = document.createElement('div');
    d.className = 'grp-row' + (g.id === selGrp ? ' active' : '');
    d.innerHTML = `<div class="grp-init">${init(g.name)}</div><span class="grp-lbl">${esc(g.name)}</span>`;
    d.addEventListener('click', () => selectGrp(g.id));
    list.appendChild(d);
  });

  const addRow = document.createElement('div');
  addRow.className = 'sb-add';
  addRow.title = 'add group';
  addRow.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  addRow.addEventListener('click', addGroup);
  list.appendChild(addRow);
}

function renderScripts() {
  const q = $('sbSearch').value.trim().toLowerCase();
  if (q) { renderSearchResults(q); return; }

  const list = $('scList');
  const savedScroll = list.scrollTop;
  const savedWinScroll = window.scrollY;
  list.innerHTML = '';
  const g = grp(selGrp);
  if (!g) return;

  g.scripts.forEach(s => {
    const item = document.createElement('div');
    item.className  = 'sc-item';
    item.dataset.id = s.id;

    const row = document.createElement('div');
    row.className = 'sc-row';

    const expBtn = document.createElement('button');
    expBtn.className = 'ib sm';
    expBtn.title     = s.exp ? 'collapse' : 'expand';
    expBtn.innerHTML = s.exp ? ICO.chevU : ICO.chevD;
    expBtn.addEventListener('click', () => toggleScript(s.id));

    let nameEl;
    if (s.edit) {
      nameEl = document.createElement('input');
      nameEl.className    = 'sc-name-inp';
      nameEl.value        = s.name;
      nameEl.autocomplete = 'off';
      nameEl.addEventListener('input',   e => s._name = e.target.value);
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') saveScript(s.id); });
    } else {
      nameEl = document.createElement('span');
      nameEl.className   = 'sc-name';
      nameEl.textContent = s.name || '(unnamed)';
    }

    const wb = document.createElement('button');
    wb.className = 'wget-btn';
    wb.textContent = 'wget';
    wb.title = 'copy wget command';
    wb.addEventListener('click', e => { e.stopPropagation(); copyWget(s); });

    row.appendChild(expBtn);
    row.appendChild(nameEl);

    if (s.exp) {
      const eb = document.createElement('button');
      eb.className = 'ib sm amber';
      eb.title     = s.edit ? 'save' : 'edit';
      eb.innerHTML = s.edit ? ICO.check : ICO.pencil;
      eb.addEventListener('click', () => s.edit ? saveScript(s.id) : startEdit(s.id));
      row.appendChild(eb);
    } else {
      const cb = document.createElement('button');
      cb.className = 'ib sm';
      cb.title     = 'copy script';
      cb.innerHTML = ICO.clip;
      cb.addEventListener('click', e => { e.stopPropagation(); copyContent(s); });
      row.appendChild(cb);
    }

    row.appendChild(wb);
    item.appendChild(row);

    if (s.exp) {
      const cont = document.createElement('div');
      cont.className = 'sc-content';

      const ta = document.createElement('textarea');
      ta.className    = 'sc-ta';
      ta.value        = s.content;
      ta.spellcheck   = false;
      if (!s.edit) {
        ta.readOnly = true;
      } else {
        ta.addEventListener('input', e => { s._content = e.target.value; autoResize(ta); });
        ta.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
            const pos = ta.selectionStart;
            if (pos === 0 || ta.value[pos - 1] === '\n') e.preventDefault();
          }
        });
      }
      requestAnimationFrame(() => autoResize(ta));

      const foot = document.createElement('div');
      foot.className = 'sc-foot';
      const delBtn = document.createElement('button');
      delBtn.className = 'ib sm danger';
      delBtn.title     = 'delete script';
      delBtn.innerHTML = ICO.x;
      delBtn.addEventListener('click', () => confirmDel(() => deleteScript(s.id)));
      foot.appendChild(delBtn);

      cont.appendChild(ta);
      cont.appendChild(foot);
      item.appendChild(cont);
    }

    list.appendChild(item);
  });

  if (g) {
    const addRow = document.createElement('div');
    addRow.className = 'rp-add';
    addRow.title = 'add script';
    addRow.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    addRow.addEventListener('click', addScript);
    list.appendChild(addRow);
  }

  // restore immediately (sync) AND after autoResize RAFs finish
  list.scrollTop = savedScroll;
  window.scrollTo(0, savedWinScroll);
  requestAnimationFrame(() => {
    list.scrollTop = savedScroll;
    window.scrollTo(0, savedWinScroll);
  });
}

function renderSearchResults(q) {
  const list = $('scList');
  list.innerHTML = '';
  let count = 0;

  groups.forEach(g => {
    (g.scripts || [])
      .filter(s => s.name.toLowerCase().includes(q))
      .forEach(s => {
        count++;
        const item = document.createElement('div');
        item.className = 'sc-item';

        const row = document.createElement('div');
        row.className = 'sc-row';
        row.style.cursor = 'pointer';

        const expBtn = document.createElement('button');
        expBtn.className = 'ib sm';
        expBtn.innerHTML = s.exp ? ICO.chevU : ICO.chevD;
        expBtn.addEventListener('click', e => {
          e.stopPropagation();
          s.exp = !s.exp;
          renderScripts();
        });

        const badge = document.createElement('div');
        badge.className   = 'grp-init';
        badge.textContent = init(g.name);
        badge.title       = g.name;

        const nameEl = document.createElement('span');
        nameEl.className   = 'sc-name';
        nameEl.textContent = s.name || '(unnamed)';

        row.appendChild(expBtn);
        row.appendChild(badge);
        row.appendChild(nameEl);

        row.addEventListener('click', () => {
          $('sbSearch').value = '';
          selectGrp(g.id);
        });

        item.appendChild(row);

        if (s.exp) {
          const cont = document.createElement('div');
          cont.className = 'sc-content';
          const ta = document.createElement('textarea');
          ta.className  = 'sc-ta';
          ta.value      = s.content || '';
          ta.readOnly   = true;
          ta.spellcheck = false;
          requestAnimationFrame(() => autoResize(ta));
          cont.appendChild(ta);
          item.appendChild(cont);
        }

        const foot = document.createElement('div');
        foot.className = 'sc-foot';
        foot.style.padding = '0 14px 10px';
        const wb = document.createElement('button');
        wb.className   = 'wget-btn';
        wb.textContent = 'wget';
        wb.addEventListener('click', e => { e.stopPropagation(); copyWget(s); });
        foot.appendChild(wb);
        item.appendChild(foot);

        list.appendChild(item);
      });
  });

  if (count === 0) {
    const empty = document.createElement('div');
    empty.className = 'sc-row';
    empty.style.cssText = 'justify-content:center;color:var(--txt3);font-size:12px;';
    empty.textContent   = 'no scripts found';
    list.appendChild(empty);
  }
}

function renderPanelHead() {
  const q = $('sbSearch').value.trim();
  const g = grp(selGrp);
  if (q) {
    $('rpTitle').textContent          = '';
    $('grpMenuWrap').style.visibility = 'hidden';
  } else {
    $('rpTitle').textContent          = g ? g.name : '—';
    $('grpMenuWrap').style.visibility = g ? 'visible' : 'hidden';
    const nd = $('grpNameDisplay');
    if (nd && g) nd.textContent = g.name;
  }
}

// ── ACTIONS ──
async function selectGrp(id) {
  const prev = grp(selGrp);
  if (prev) prev.scripts.forEach(s => { applyEdits(s); s.exp = false; s.edit = false; });
  selGrp = id;
  await loadScripts(id);
  render();
  if (isMob()) { document.body.className = 'vs'; $('backBtn').style.display = 'inline-flex'; }
}

function toggleScript(sid) {
  const s = sc(selGrp, sid);
  if (!s) return;
  if (s.exp) { applyEdits(s); s.exp = false; s.edit = false; }
  else       { s.exp = true; }
  renderScripts();
}

function startEdit(sid) {
  const s = sc(selGrp, sid);
  if (!s) return;
  s.edit = true; s._name = s.name; s._content = s.content;
  renderScripts();
  const inp = document.querySelector(`.sc-item[data-id="${sid}"] .sc-name-inp`);
  if (inp) inp.focus();
}

async function saveScript(sid) {
  const s = sc(selGrp, sid);
  if (!s) return;
  applyEdits(s);
  s.edit = false;
  try {
    await api('PUT', `/api/scripts/${sid}`, { name: s.name, content: s.content });
  } catch {
    toast('failed to save script');
  }
  renderScripts();
}

function applyEdits(s) {
  if (s._name    !== undefined) { if (s._name.trim()) s.name = s._name.trim(); delete s._name; }
  if (s._content !== undefined) { s.content = s._content; delete s._content; }
}

async function deleteScript(sid) {
  const g = grp(selGrp);
  if (!g) return;
  try {
    await api('DELETE', `/api/scripts/${sid}`);
    g.scripts = g.scripts.filter(s => s.id !== sid);
  } catch {
    toast('failed to delete script');
  }
  renderScripts();
}

function copyContent(s) {
  navigator.clipboard?.writeText(s.content).catch(() => {});
  toast('script copied!');
}

function copyWget(s) {
  const cmd = `wget -qO- ${window.location.origin}/run/${userHash}/${s.hash} | bash`;
  navigator.clipboard?.writeText(cmd).catch(() => {});
  toast('wget command copied!');
}

function addGroup() {
  const list = $('grpList');
  if (list.querySelector('.new-grp-inp')) return;
  const row = document.createElement('div');
  row.className = 'new-grp-row';
  const inp = document.createElement('input');
  inp.className    = 'new-grp-inp';
  inp.placeholder  = 'group name';
  inp.autocomplete = 'off';
  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    const name = inp.value.trim();
    row.remove();
    if (!name) return;
    try {
      const g = await api('POST', '/api/groups', { name });
      groups.push({ ...g, scripts: [], loaded: true });
      renderGroups();
      selectGrp(g.id);
    } catch {
      toast('failed to create group');
    }
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { committed = true; row.remove(); } });
  inp.addEventListener('blur', commit);
  row.appendChild(inp);
  list.appendChild(row);
  inp.focus();
}

async function addScript() {
  const g = grp(selGrp);
  if (!g) return;
  try {
    const s = await api('POST', `/api/groups/${selGrp}/scripts`, { name: '', content: '' });
    g.scripts.push({ ...s, exp: true, edit: true, _name: '', _content: '' });
    renderScripts();
    const inp = document.querySelector(`.sc-item[data-id="${s.id}"] .sc-name-inp`);
    if (inp) inp.focus();
  } catch {
    toast('failed to create script');
  }
}

function enterGrpEditMode() {
  const row = $('grpNameRow');
  const g = grp(selGrp);

  const inp = document.createElement('input');
  inp.className    = 'drop-inp';
  inp.id           = 'grpRenameInp';
  inp.value        = g ? g.name : '';
  inp.placeholder  = 'new name';
  inp.autocomplete = 'off';

  const btn = $('grpRenameBtn');
  btn.innerHTML = ICO.check;
  btn.title = 'save';
  btn.onclick = e => { e.stopPropagation(); saveGroupName(); };

  row.replaceChild(inp, $('grpNameDisplay'));
  inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveGroupName();
    if (e.key === 'Escape') exitGrpEditMode();
  });
}

function exitGrpEditMode() {
  const row = $('grpNameRow');
  const inp = $('grpRenameInp');
  if (!inp) return;

  const span = document.createElement('span');
  span.className   = 'drop-lbl';
  span.id          = 'grpNameDisplay';
  span.textContent = grp(selGrp)?.name ?? '';
  span.style.cursor = 'pointer';
  span.addEventListener('click', e => { e.stopPropagation(); enterGrpEditMode(); });
  row.replaceChild(span, inp);

  const btn = $('grpRenameBtn');
  btn.innerHTML = ICO.pencil;
  btn.title = 'edit name';
  btn.onclick = e => { e.stopPropagation(); enterGrpEditMode(); };
}

async function saveGroupName() {
  const g   = grp(selGrp);
  const val = ($('grpRenameInp')?.value ?? '').trim();
  exitGrpEditMode();
  if (!g || !val) return;
  try {
    await api('PUT', `/api/groups/${selGrp}`, { name: val });
    g.name = val;
    renderGroups();
    renderPanelHead();
  } catch {
    toast('failed to rename group');
  }
  $('grpDrop').style.display = 'none';
}

function setUserDisplay(name) {
  $('userNameDisplay').textContent = name;
}

function enterUserEditMode() {
  const row = $('userNameRow');
  const currentName = $('userLbl').textContent;

  const inp = document.createElement('input');
  inp.className   = 'drop-inp';
  inp.id          = 'userNameInp';
  inp.value       = currentName;
  inp.placeholder = 'new name';
  inp.autocomplete = 'off';

  const btn = $('userEditBtn');
  btn.innerHTML = `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  btn.title = 'save';
  btn.onclick = e => { e.stopPropagation(); commitUserName(); };

  row.replaceChild(inp, $('userNameDisplay'));
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commitUserName(); if (e.key === 'Escape') exitUserEditMode(); });
}

function exitUserEditMode() {
  const row = $('userNameRow');
  const inp = $('userNameInp');
  const span = document.createElement('span');
  span.className = 'drop-lbl';
  span.id        = 'userNameDisplay';
  span.textContent = $('userLbl').textContent;
  span.style.cursor = 'pointer';
  span.addEventListener('click', e => { e.stopPropagation(); enterUserEditMode(); });
  row.replaceChild(span, inp);

  const btn = $('userEditBtn');
  btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.5 1.5L9 3L3.5 9H1.5V7L7.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  btn.title = 'edit name';
  btn.onclick = e => { e.stopPropagation(); enterUserEditMode(); };
}

async function commitUserName() {
  const val = $('userNameInp')?.value.trim() || 'no name';
  exitUserEditMode();
  try {
    await api('PUT', '/api/users/me', { username: val });
    $('userLbl').textContent = val;
    setUserDisplay(val);
  } catch {
    toast('failed to save name');
  }
}

function toggleSb() {
  sbShrunk = !sbShrunk;
  $('sb').classList.toggle('shrunk', sbShrunk);
  $('sbArrow').innerHTML = sbShrunk
    ? '<path d="M2 2L6 6L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M6 2L2 6L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
}

function toggleDrop(id) {
  const d    = $(id);
  const open = d.style.display === 'none';
  closeAllDrops();
  if (open) d.style.display = 'block';
}

function closeAllDrops() {
  ['userDrop', 'grpDrop'].forEach(id => $(id).style.display = 'none');
}

// ── CONFIRM MODAL ──
function confirmDel(cb) {
  confirmCb = cb;
  $('confirmOverlay').style.display = 'flex';
}
$('confirmYes').addEventListener('click', () => {
  $('confirmOverlay').style.display = 'none';
  if (confirmCb) { confirmCb(); confirmCb = null; }
});
$('confirmNo').addEventListener('click', () => {
  $('confirmOverlay').style.display = 'none'; confirmCb = null;
});

// ── TOAST ──
let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── EVENT WIRING ──
$('sbToggle').addEventListener('click', toggleSb);
$('sbSearch').addEventListener('input', render);
$('backBtn').addEventListener('click', () => { document.body.className = 'vg'; $('backBtn').style.display = 'none'; });

$('userTrig').addEventListener('click', e => { e.stopPropagation(); toggleDrop('userDrop'); });
$('grpTrig').addEventListener('click',  e => { e.stopPropagation(); toggleDrop('grpDrop'); });
$('userEditBtn').addEventListener('click',    e => { e.stopPropagation(); enterUserEditMode(); });
$('userNameDisplay').addEventListener('click', e => { e.stopPropagation(); enterUserEditMode(); });
$('userNameDisplay').style.cursor = 'pointer';
$('grpRenameBtn').addEventListener('click',  e => { e.stopPropagation(); enterGrpEditMode(); });
$('grpNameDisplay').addEventListener('click', e => { e.stopPropagation(); enterGrpEditMode(); });
$('grpNameDisplay').style.cursor = 'pointer';
$('delGrpRow').addEventListener('click',   e => {
  e.stopPropagation();
  $('grpDrop').style.display = 'none';
  confirmDel(async () => {
    try {
      await api('DELETE', `/api/groups/${selGrp}`);
      groups = groups.filter(g => g.id !== selGrp);
      selGrp = groups.length ? groups[0].id : null;
      if (selGrp) await loadScripts(selGrp);
      render();
    } catch {
      toast('failed to delete group');
    }
  });
});
document.addEventListener('click', e => { if (!e.target.closest('.dd')) closeAllDrops(); });

// ── AUTH ──
$('doLogin').addEventListener('click', () => {
  window.location.href = '/auth/login';
});

async function initAuth() {
  try {
    const res  = await fetch('/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const user = await res.json();
    $('userLbl').textContent = user.username;
    userHash                 = user.user_hash;
    setUserDisplay(user.username);
    $('loginWrap').style.display = 'none';
    $('appWrap').style.display   = 'flex';
    if (!isMob()) $('backBtn').style.display = 'none';
    else document.body.className = 'vg';
    await loadGroups();
  } catch {
    $('loginWrap').style.display = 'flex';
    $('appWrap').style.display   = 'none';
  }
}

$('logoutRow').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
});

// ── LOGIN CHEVRON ──
$('loginChev').addEventListener('click', () => {
  const open = $('loginChev').classList.toggle('open');
  $('loginPanel').classList.toggle('open', open);
});

initAuth();
