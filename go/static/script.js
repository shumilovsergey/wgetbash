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

function highlightBash(text) {
  return text.split('\n').map(line => {
    const idx = line.indexOf('#');
    if (idx === -1) return esc(line);
    return esc(line.slice(0, idx)) + '<span class="cm">' + esc(line.slice(idx)) + '</span>';
  }).join('\n');
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

      const hl = document.createElement('div');
      hl.className = 'sc-hl';
      hl.setAttribute('aria-hidden', 'true');
      hl.innerHTML = highlightBash(s.content);
      ta.addEventListener('scroll', () => { hl.style.transform = `translateY(-${ta.scrollTop}px)`; });

      const taWrap = document.createElement('div');
      taWrap.className = 'ta-wrap';
      taWrap.appendChild(hl);
      taWrap.appendChild(ta);

      if (!s.edit) {
        ta.readOnly = true;
      } else {
        ta.addEventListener('input', e => {
          s._content = e.target.value;
          hl.innerHTML = highlightBash(e.target.value);
          autoResize(ta);
        });
        function handleBackspaceLine(e) {
          const start = ta.selectionStart;
          const end   = ta.selectionEnd;
          if (start !== end || start === 0) return;
          if (ta.value[start - 1] !== '\n') return;
          e.preventDefault();
          ta.value = ta.value.slice(0, start - 1) + ta.value.slice(start);
          ta.selectionStart = ta.selectionEnd = start - 1;
          s._content = ta.value;
          hl.innerHTML = highlightBash(ta.value);
          autoResize(ta);
        }
        ta.addEventListener('keydown', e => { if (e.key === 'Backspace') handleBackspaceLine(e); });
        ta.addEventListener('beforeinput', e => { if (e.inputType === 'deleteContentBackward') handleBackspaceLine(e); });
      }

      const foot = document.createElement('div');
      foot.className = 'sc-foot';
      const delBtn = document.createElement('button');
      delBtn.className = 'ib sm danger';
      delBtn.title     = 'delete script';
      delBtn.innerHTML = ICO.x;
      delBtn.addEventListener('click', () => confirmDel(() => deleteScript(s.id)));
      foot.appendChild(delBtn);

      cont.appendChild(taWrap);
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

  list.querySelectorAll('.sc-ta').forEach(ta => autoResize(ta));
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

          const hl = document.createElement('div');
          hl.className = 'sc-hl';
          hl.setAttribute('aria-hidden', 'true');
          hl.innerHTML = highlightBash(s.content || '');
          ta.addEventListener('scroll', () => { hl.style.transform = `translateY(-${ta.scrollTop}px)`; });

          const taWrap = document.createElement('div');
          taWrap.className = 'ta-wrap';
          taWrap.appendChild(hl);
          taWrap.appendChild(ta);

          cont.appendChild(taWrap);
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
    $('userLbl').textContent     = val;
    $('userInitial').textContent = init(val);
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
  $('grpDrop').style.display = 'none';
  $('userDrop').classList.remove('open');
  $('userTrig').classList.remove('open');
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

$('userTrig').addEventListener('click', e => {
  e.stopPropagation();
  $('grpDrop').style.display = 'none';
  const open = $('userDrop').classList.toggle('open');
  $('userTrig').classList.toggle('open', open);
});
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
document.addEventListener('click', e => {
  if (!e.target.closest('.dd') && !e.target.closest('.profile-area')) closeAllDrops();
});

// ── AUTH ──
$('doLogin').addEventListener('click', () => {
  window.location.href = '/auth/login';
});

async function initAuth() {
  try {
    const res  = await fetch('/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const user = await res.json();
    $('userLbl').textContent     = user.username;
    $('userInitial').textContent = init(user.username);
    userHash                     = user.user_hash;
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

// ── TAB SWITCHING ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.view[data-view]').forEach(v => {
      v.classList.toggle('active', v.dataset.view === target);
    });
  });
});

// ── LOGER ─────────────────────────────────────────────────────────────────
(function () {
  // state
  let rawLines = [];
  let grepConds   = [];  // { id, pattern, enabled }
  let removeConds = [];  // { id, pattern, enabled }
  let mathConds   = [];  // { id, prefix, op, value, enabled }
  let focusOn = true;
  let nextId  = 1;

  // dom refs
  const lgrLoad      = document.getElementById('lgrLoad');
  const lgrWorkspace = document.getElementById('lgrWorkspace');
  const lgrDropZone  = document.getElementById('lgrDropZone');
  const lgrFile      = document.getElementById('lgrFile');
  const lgrPaste     = document.getElementById('lgrPaste');
  const lgrPasteLoad = document.getElementById('lgrPasteLoad');
  const lgrDisplay   = document.getElementById('lgrDisplay');
  const lgrGrepList  = document.getElementById('lgrGrepList');
  const lgrRemoveList= document.getElementById('lgrRemoveList');
  const lgrMathList  = document.getElementById('lgrMathList');
  const lgrAddGrep   = document.getElementById('lgrAddGrep');
  const lgrAddRemove = document.getElementById('lgrAddRemove');
  const lgrAddMath   = document.getElementById('lgrAddMath');
  const lgrActs      = document.getElementById('lgrActs');
  const lgrCount     = document.getElementById('lgrCount');
  const lgrLoadNewBtn= document.getElementById('lgrLoadNewBtn');
  const lgrClearBtn  = document.getElementById('lgrClearBtn');
  const lgrSelectBtn = document.getElementById('lgrSelectBtn');
  const lgrNewWinBtn = document.getElementById('lgrNewWindowBtn');
  const lgrDropErr   = document.getElementById('lgrDropErr');
  const lgrFocusCenter = document.getElementById('lgrFocusCenter');
  const lgrFocusBefore = document.getElementById('lgrFocusBefore');
  const lgrFocusAfter  = document.getElementById('lgrFocusAfter');
  const lgrFocusToggle = document.getElementById('lgrFocusToggle');
  const lgrFocusReset  = document.getElementById('lgrFocusReset');

  // ── utils ──────────────────────────────────────────────────────────────
  function escH(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function globRe(pat) {
    const tl = /^\*[^*]+$/.test(pat), ld = /^[^*]+\*$/.test(pat);
    const esc = pat.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*?').replace(/\?/g,'.');
    return new RegExp((ld ? '^' : '') + esc + (tl ? '$' : ''), 'i');
  }
  function globReHl(pat) {
    const esc = pat.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^",:{}\\[\\]]*?').replace(/\?/g,'[^",:{}\\[\\]]');
    return new RegExp(esc, 'gi');
  }
  function lineMatches(line, pat) {
    if (!pat.trim()) return false;
    try { return globRe(pat).test(line); } catch { return line.toLowerCase().includes(pat.toLowerCase()); }
  }
  function detectLevel(line) {
    const l = line.toLowerCase();
    if (/\b(error|err|fatal|crit)\b/.test(l)) return 'error';
    if (/\b(warn|warning)\b/.test(l))         return 'warn';
    if (/\b(debug|dbg)\b/.test(l))            return 'debug';
    if (/\b(trace|verbose)\b/.test(l))        return 'trace';
    return 'info';
  }

  // ── focus ──────────────────────────────────────────────────────────────
  function applyFocus(lines) {
    if (!focusOn) return { lines, offset: 0 };
    const center = parseInt(lgrFocusCenter.value) || 0;
    if (!center) return { lines, offset: 0 };
    const before = parseInt(lgrFocusBefore.value) || 0;
    const after  = parseInt(lgrFocusAfter.value)  || 0;
    const z = center - 1;
    const s = Math.max(0, z - before), e = Math.min(lines.length - 1, z + after);
    return { lines: lines.slice(s, e + 1), offset: s };
  }
  lgrFocusCenter.addEventListener('input', renderLogs);
  lgrFocusBefore.addEventListener('input', renderLogs);
  lgrFocusAfter.addEventListener('input',  renderLogs);
  lgrFocusToggle.addEventListener('click', () => {
    focusOn = !focusOn;
    lgrFocusToggle.classList.toggle('active', focusOn);
    lgrFocusToggle.innerHTML = focusOn
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> on`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> off`;
    renderLogs();
  });
  lgrFocusReset.addEventListener('click', () => {
    lgrFocusCenter.value = lgrFocusBefore.value = lgrFocusAfter.value = 0;
    focusOn = true;
    lgrFocusToggle.classList.add('active');
    lgrFocusToggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> on`;
    renderLogs();
  });

  // ── math ───────────────────────────────────────────────────────────────
  const OPS = ['>', '<', '>=', '<=', '==', '!='];
  const NUM_RE = /-?\d+(?:\.\d+)?/g;
  function evalOp(n, op, v) {
    return op==='>'?n>v:op==='<'?n<v:op==='>='?n>=v:op==='<='?n<=v:op==='=='?n===v:n!==v;
  }
  function mathPass(line, active) {
    if (!active.length) return true;
    return active.every(c => {
      if (c.prefix && c.prefix.trim()) {
        const e = c.prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const m = new RegExp(e+'(-?\\d+(?:\\.\\d+)?)','i').exec(line);
        return m ? evalOp(parseFloat(m[1]), c.op, c.value) : false;
      }
      return [...line.matchAll(NUM_RE)].some(m => evalOp(parseFloat(m[0]), c.op, c.value));
    });
  }

  // ── remove classification ──────────────────────────────────────────────
  function classifyRm(pat) {
    const p = pat.trim(), lead = p.startsWith('*'), trail = p.endsWith('*');
    const stripped = p.replace(/^\*+/,'').replace(/\*+$/,'').trim();
    if (lead && trail)  return { type:'hide',  literal: stripped };
    if (lead && !trail) return { type:'left',  literal: stripped };
    if (!lead && trail) return { type:'right', literal: stripped };
    const si = p.indexOf('*');
    if (si > 0 && si === p.lastIndexOf('*') && !p.includes('?'))
      return { type:'span', prefix: p.slice(0, si), suffix: p.slice(si + 1) };
    if (/[*?]/.test(p)) return { type:'hide', literal: p };
    return { type:'literal', literal: p };
  }
  function redactIntervals(text, instrs) {
    const ivs = [];
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    instrs.forEach(instr => {
      if (instr.type === 'span') {
        if (!instr.prefix && !instr.suffix) return;
        const m = new RegExp(esc(instr.prefix)+'[\\s\\S]*?'+esc(instr.suffix),'i').exec(text);
        if (m && !ivs.some(iv => iv.s<=m.index && iv.e>=m.index+m[0].length))
          ivs.push({ s: m.index, e: m.index+m[0].length });
        return;
      }
      const { literal } = instr;
      if (!literal) return;
      const re = new RegExp(esc(literal),'gi'); let m;
      if (instr.type === 'right') {
        let last = null;
        while ((m = re.exec(text)) !== null)
          if (!ivs.some(iv=>iv.s<=m.index&&iv.e>=m.index+m[0].length)) last = m;
        if (last) ivs.push({ s: last.index+last[0].length, e: text.length });
        return;
      }
      while ((m = re.exec(text)) !== null) {
        if (ivs.some(iv=>iv.s<=m.index&&iv.e>=m.index+m[0].length)) continue;
        ivs.push({ s: instr.type==='left'?0:m.index, e: instr.type==='left'?m.index:m.index+m[0].length });
        break;
      }
    });
    return ivs;
  }
  function stripRedacted(text, instrs) {
    const ivs = redactIntervals(text, instrs).sort((a,b)=>a.s-b.s);
    let r='', pos=0;
    for (const iv of ivs) { if (iv.s>pos) r+=text.slice(pos,iv.s); pos=iv.e; }
    return r + text.slice(pos);
  }

  // ── line HTML builder ──────────────────────────────────────────────────
  const PRIO = { rm:3, mhl:2, hl:1 };
  function buildLineHtml(text, hlPats, instrs, mathPfx=[], mathHlNums=false) {
    const n = text.length;
    const ct = new Array(n).fill(null);
    const paint = (s,e,t) => { for(let i=s;i<e;i++) if(!ct[i]||PRIO[t]>PRIO[ct[i]]) ct[i]=t; };
    hlPats.forEach(p => { if(!p.trim()) return; const re=globReHl(p); let m; while((m=re.exec(text))!==null){paint(m.index,m.index+m[0].length,'hl');if(!m[0].length)re.lastIndex++;} });
    mathPfx.forEach(p => { if(!p) return; const re=new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'); let m; while((m=re.exec(text))!==null) paint(m.index,m.index+m[0].length,'mhl'); });
    if (mathHlNums) { const re=/-?\d+(?:\.\d+)?/g; let m; while((m=re.exec(text))!==null) paint(m.index,m.index+m[0].length,'mhl'); }
    redactIntervals(text, instrs).forEach(iv => paint(iv.s, iv.e, 'rm'));
    if (ct.every(t=>t===null)) return escH(text);
    let html='', i=0;
    while(i<n){const t=ct[i];let j=i+1;while(j<n&&ct[j]===t)j++;const c=text.slice(i,j);
      html += t===null?escH(c):t==='hl'?`<mark class="lgr-hl">${escH(c)}</mark>`:t==='mhl'?`<mark class="lgr-hl-m">${escH(c)}</mark>`:`<span class="lgr-rm"></span>`;
      i=j;}
    return html;
  }

  // ── render logs ────────────────────────────────────────────────────────
  function renderLogs() {
    const aGrep   = grepConds.filter(c=>c.enabled&&c.pattern.trim());
    const aRemove = removeConds.filter(c=>c.enabled&&c.pattern.trim());
    const aMath   = mathConds.filter(c=>c.enabled&&c.value!==null&&c.value!==undefined&&c.value!=='');
    const classified = aRemove.map(c=>({cond:c,cls:classifyRm(c.pattern)}));
    const globRms    = classified.filter(({cls})=>cls.type==='hide');
    const inlineRm   = classified.filter(({cls})=>cls.type!=='hide').map(({cls})=>cls);
    const { lines: fl, offset: fo } = applyFocus(rawLines);
    const filtered=[], nums=[];
    fl.forEach((line, i) => {
      const orig = fo + i + 1;
      if (globRms.some(({cond})=>lineMatches(line,cond.pattern))) return;
      const vis = inlineRm.length ? stripRedacted(line, inlineRm) : line;
      if (aGrep.length && !aGrep.every(c=>lineMatches(vis,c.pattern))) return;
      if (!mathPass(vis, aMath)) return;
      filtered.push(line); nums.push(orig);
    });
    if (!filtered.length && rawLines.length) {
      lgrDisplay.innerHTML = '<div class="lgr-empty">No lines match current conditions.</div>';
      lgrCount.textContent = `0 / ${rawLines.length} lines`; return;
    }
    lgrCount.textContent = `${filtered.length} / ${rawLines.length} lines`;
    const hlPats = aGrep.map(c=>c.pattern).filter(p=>p.trim());
    const allMath = mathConds.filter(c=>c.enabled);
    const mathPfx = allMath.map(c=>c.prefix&&c.prefix.trim()).filter(Boolean);
    const mathHlNums = allMath.some(c=>!(c.prefix&&c.prefix.trim()));
    const focCenter = parseInt(lgrFocusCenter.value)||0;
    const frag = document.createDocumentFragment();
    filtered.forEach((line,i) => {
      const div = document.createElement('div');
      div.className = 'lgr-line' + (focusOn&&focCenter>0&&nums[i]===focCenter?' center':'');
      const num = document.createElement('span');
      num.className = 'lgr-num'; num.textContent = nums[i];
      const txt = document.createElement('span');
      txt.className = `lgr-txt lvl-${detectLevel(line)}`;
      txt.innerHTML = buildLineHtml(line, hlPats, inlineRm, mathPfx, mathHlNums);
      div.appendChild(num); div.appendChild(txt); frag.appendChild(div);
    });
    lgrDisplay.innerHTML = ''; lgrDisplay.appendChild(frag);
  }

  // ── condition UI ───────────────────────────────────────────────────────
  function makePill(type, cond) {
    const pill = document.createElement('div');
    pill.className = `lgr-pill ${type}-pill${cond.enabled?'':' off'}`;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = cond.pattern;
    inp.placeholder = type==='grep' ? '*text* or ERROR' : '*200* or ERROR';
    inp.style.width = Math.max(80, inp.value.length*8)+'px';
    inp.addEventListener('input', () => {
      cond.pattern = inp.value;
      inp.style.width = Math.max(80, inp.value.length*8)+'px';
      renderLogs();
    });
    const tog = document.createElement('button');
    tog.className = 'lgr-pbtn tog'; tog.title = cond.enabled?'disable':'enable';
    tog.innerHTML = cond.enabled
      ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    tog.addEventListener('click', () => { cond.enabled=!cond.enabled; renderConds(); renderLogs(); });
    const del = document.createElement('button');
    del.className = 'lgr-pbtn del'; del.title = 'delete';
    del.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    del.addEventListener('click', () => {
      if (type==='grep') grepConds = grepConds.filter(c=>c.id!==cond.id);
      else removeConds = removeConds.filter(c=>c.id!==cond.id);
      renderConds(); renderLogs();
    });
    pill.appendChild(inp); pill.appendChild(tog); pill.appendChild(del);
    return pill;
  }

  function makeMathPill(cond) {
    const pill = document.createElement('div');
    pill.className = 'lgr-math-pill' + (cond.enabled?'':' off');
    const pfx = document.createElement('input'); pfx.type='text'; pfx.className='lgr-mpfx';
    pfx.value=cond.prefix||''; pfx.placeholder='N'; pfx.title='optional prefix before number';
    pfx.style.width=Math.max(20,(cond.prefix||'').length*8)+'px';
    pfx.addEventListener('input', () => { cond.prefix=pfx.value; pfx.style.width=Math.max(20,pfx.value.length*8)+'px'; renderLogs(); });
    const op = document.createElement('select'); op.className='lgr-mop';
    OPS.forEach(o => { const opt=document.createElement('option'); opt.value=o; opt.textContent=o; if(o===cond.op) opt.selected=true; op.appendChild(opt); });
    op.addEventListener('change', () => { cond.op=op.value; renderLogs(); });
    const val = document.createElement('input'); val.type='number'; val.className='lgr-mval';
    val.value=cond.value??''; val.placeholder='0';
    val.addEventListener('input', () => { cond.value=val.value===''?null:parseFloat(val.value); renderLogs(); });
    const tog = document.createElement('button'); tog.className='lgr-pbtn tog'; tog.title=cond.enabled?'disable':'enable';
    tog.innerHTML = cond.enabled
      ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    tog.addEventListener('click', () => { cond.enabled=!cond.enabled; renderMath(); renderLogs(); });
    const del = document.createElement('button'); del.className='lgr-pbtn del'; del.title='delete';
    del.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    del.addEventListener('click', () => { mathConds=mathConds.filter(c=>c.id!==cond.id); renderMath(); renderLogs(); });
    pill.appendChild(pfx); pill.appendChild(op); pill.appendChild(val); pill.appendChild(tog); pill.appendChild(del);
    return pill;
  }

  function renderConds() {
    lgrGrepList.innerHTML = ''; lgrRemoveList.innerHTML = '';
    grepConds.forEach(c => lgrGrepList.appendChild(makePill('grep', c)));
    removeConds.forEach(c => lgrRemoveList.appendChild(makePill('remove', c)));
  }
  function renderMath() {
    lgrMathList.innerHTML = '';
    mathConds.forEach(c => lgrMathList.appendChild(makeMathPill(c)));
  }

  lgrAddGrep.addEventListener('click',   () => { grepConds.push({id:nextId++,pattern:'',enabled:true}); renderConds(); lgrGrepList.lastElementChild?.querySelector('input')?.focus(); });
  lgrAddRemove.addEventListener('click', () => { removeConds.push({id:nextId++,pattern:'',enabled:true}); renderConds(); lgrRemoveList.lastElementChild?.querySelector('input')?.focus(); });
  lgrAddMath.addEventListener('click',   () => { mathConds.push({id:nextId++,prefix:'',op:'>',value:null,enabled:true}); renderMath(); lgrMathList.lastElementChild?.querySelector('input')?.focus(); });

  // ── load ───────────────────────────────────────────────────────────────
  const ALLOWED = new Set(['.log','.txt','.out','.err','.json','.jsonl','.ndjson','.csv']);
  function getExt(n) { const m=n.match(/(\.[^.]+)$/); return m?m[1].toLowerCase():''; }
  function allowed(n) { return ALLOWED.has(getExt(n)); }
  function showErr(n) {
    lgrDropErr.textContent = `Unsupported: ${getExt(n)||'(no ext)'}`;
    lgrDropErr.classList.add('show');
    setTimeout(() => lgrDropErr.classList.remove('show'), 3000);
  }

  function loadText(text) {
    rawLines = text.split('\n');
    while (rawLines.length && !rawLines[rawLines.length-1].trim()) rawLines.pop();
    if (!rawLines.length) return;
    lgrLoad.style.display = 'none';
    lgrWorkspace.style.display = 'flex';
    lgrWorkspace.style.flexDirection = 'column';
    lgrActs.style.display = 'flex';
    renderLogs();
  }

  lgrDropZone.addEventListener('click', () => lgrFile.click());
  lgrFile.addEventListener('change', () => {
    const f = lgrFile.files[0]; if (!f) return; lgrFile.value='';
    if (!allowed(f.name)) { showErr(f.name); return; }
    const r = new FileReader(); r.onload = e => loadText(e.target.result); r.readAsText(f);
  });
  lgrDropZone.addEventListener('dragover', e => { e.preventDefault(); lgrDropZone.classList.add('over'); });
  lgrDropZone.addEventListener('dragleave', () => lgrDropZone.classList.remove('over'));
  lgrDropZone.addEventListener('drop', e => {
    e.preventDefault(); lgrDropZone.classList.remove('over');
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (!allowed(f.name)) { showErr(f.name); return; }
    const r = new FileReader(); r.onload = ev => loadText(ev.target.result); r.readAsText(f);
  });
  lgrPasteLoad.addEventListener('click', () => {
    const t = lgrPaste.value.trim(); if (!t) return;
    loadText(t); lgrPaste.value = '';
  });
  lgrPaste.addEventListener('keydown', e => { if (e.key==='Enter'&&(e.ctrlKey||e.metaKey)) lgrPasteLoad.click(); });

  document.addEventListener('paste', e => {
    if (document.querySelector('.tab[data-tab="loger"]')?.classList.contains('active') &&
        lgrLoad.style.display !== 'none') {
      const t = e.clipboardData.getData('text');
      if (t && t.includes('\n')) { loadText(t); e.preventDefault(); }
    }
  });

  function resetAll() {
    grepConds=[]; removeConds=[]; mathConds=[];
    lgrFocusCenter.value=lgrFocusBefore.value=lgrFocusAfter.value=0;
    focusOn=true; lgrFocusToggle.classList.add('active');
    lgrFocusToggle.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> on`;
    renderConds(); renderMath();
  }

  lgrLoadNewBtn.addEventListener('click', () => {
    rawLines = []; lgrLoad.style.display = ''; lgrWorkspace.style.display = 'none'; lgrActs.style.display = 'none';
    lgrCount.textContent = '0 / 0 lines'; resetAll();
  });
  lgrClearBtn.addEventListener('click', () => { resetAll(); renderLogs(); });
  lgrSelectBtn.addEventListener('click', () => {
    const r = document.createRange(); r.selectNodeContents(lgrDisplay);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  lgrNewWinBtn.addEventListener('click', () => window.open(window.location.href, '_blank'));
})();

// ══════════════════════════════════════
// CLEANER
// ══════════════════════════════════════
(function () {
  const input  = document.getElementById('clnrInput');
  const output = document.getElementById('clnrOutput');
  const stats  = document.getElementById('clnrStats');
  const btnClear = document.getElementById('clnrClear');
  const btnCopy  = document.getElementById('clnrCopy');

  // Allowlist: tabs, newlines, printable ASCII, Cyrillic block,
  // common typographic chars (guillemets, dashes, curly quotes, ellipsis)
  const ALLOWED = /[^\t\n\r -~«»–—‘’“”…Ѐ-ӿ]/g;

  function clean(text) {
    return text
      .replace(/\u00A0/g, ' ')        // non-breaking space → regular space
      .replace(/\u2028|\u2029/g, '\n') // line/paragraph separator → newline
      .replace(ALLOWED, '');
  }

  function update() {
    const raw = input.value;
    if (!raw) {
      output.value = '';
      stats.innerHTML = 'paste text to clean';
      return;
    }
    const cleaned = clean(raw);
    output.value = cleaned;
    const before  = raw.length;
    const after   = cleaned.length;
    const removed = before - after;
    stats.innerHTML = `<strong>${before}</strong> chars → <strong>${after}</strong> chars` +
      (removed > 0 ? ` · <strong style="color:var(--redhi)">${removed} removed</strong>` : ' · nothing to remove');
  }

  input.addEventListener('input', update);

  btnClear.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    stats.innerHTML = 'paste text to clean';
  });

  btnCopy.addEventListener('click', () => {
    if (!output.value) return;
    navigator.clipboard.writeText(output.value).then(() => showToast('copied'));
  });
})();
