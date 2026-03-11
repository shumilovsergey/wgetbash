// ── STATE ──
let groups = [
  { id: 1, name: 'Группа 1', scripts: [
    { id: 11, name: 'скрипт 1',     content: '#!/bin/bash\necho "hello world"',                   exp: false, edit: false },
    { id: 12, name: 'update system', content: 'sudo apt update\nsudo apt upgrade -y\ndf -h',       exp: false, edit: false },
  ]},
  { id: 2, name: 'работа', scripts: [
    { id: 21, name: 'deploy',        content: 'git pull origin main\nnpm install\nnpm run build',  exp: false, edit: false },
    { id: 22, name: 'nginx reload',  content: 'sudo nginx -t\nsudo systemctl reload nginx',        exp: false, edit: false },
  ]},
  { id: 3, name: 'Test-1', scripts: [
    { id: 31, name: 'скрипт 1',     content: '#!/bin/bash\necho "test"',                           exp: false, edit: false },
    { id: 32, name: 'docker intall', content: 'sudo apt update\nsudo apt upgrade\ndf -h\nsudo whoami', exp: false, edit: false },
    { id: 33, name: 'script 2',     content: 'curl -fsSL https://get.docker.com | sh',            exp: false, edit: false },
  ]},
];

let selGrp    = 3;
let sbShrunk  = false;
let uid       = 200;
let confirmCb = null;

// ── UTILS ──
const $      = id => document.getElementById(id);
const esc    = s  => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isMob  = () => window.innerWidth <= 767;
function grp(id)      { return groups.find(g => g.id === id); }
function sc(gid, sid) { return grp(gid)?.scripts.find(s => s.id === sid); }
function init(name)   { return name.trim().charAt(0).toUpperCase(); }

// ── ICONS ──
const ICO = {
  chevD:  `<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 1.5L4.5 5L8 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevU:  `<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 5.5L4.5 2L8 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pencil: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.5 1.5L9 3L3.5 9H1.5V7L7.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  check:  `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  x:      `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
};

// ── RENDER ──
function render() {
  renderGroups();
  renderScripts();
  renderPanelHead();
}

function renderGroups() {
  const list = $('grpList');
  const q    = $('sbSearch').value.toLowerCase();
  list.innerHTML = '';
  groups
    .forEach(g => {
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
  list.innerHTML = '';
  const g = grp(selGrp);
  if (!g) return;

  g.scripts.forEach(s => {
    const item = document.createElement('div');
    item.className  = 'sc-item';
    item.dataset.id = s.id;

    // Row
    const row = document.createElement('div');
    row.className = 'sc-row';

    // Expand button
    const expBtn = document.createElement('button');
    expBtn.className = 'ib sm';
    expBtn.title     = s.exp ? 'collapse' : 'expand';
    expBtn.innerHTML = s.exp ? ICO.chevU : ICO.chevD;
    expBtn.addEventListener('click', () => toggleScript(s.id));

    // Name / editable input
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
      nameEl.className  = 'sc-name';
      nameEl.textContent = s.name || '(unnamed)';
    }

    // wget button
    const wb = document.createElement('button');
    wb.className = 'wget-btn';
    wb.textContent = 'wget';
    wb.title = 'copy wget command';
    wb.addEventListener('click', e => { e.stopPropagation(); copyWget(s.id); });

    row.appendChild(expBtn);
    row.appendChild(nameEl);

    // Edit / save button (only when expanded)
    if (s.exp) {
      const eb = document.createElement('button');
      eb.className = 'ib sm amber';
      eb.title     = s.edit ? 'save' : 'edit';
      eb.innerHTML = s.edit ? ICO.check : ICO.pencil;
      eb.addEventListener('click', () => s.edit ? saveScript(s.id) : startEdit(s.id));
      row.appendChild(eb);
    }

    row.appendChild(wb);

    item.appendChild(row);

    // Expanded content area
    if (s.exp) {
      const cont = document.createElement('div');
      cont.className = 'sc-content';

      const ta = document.createElement('textarea');
      ta.className = 'sc-ta';
      ta.value     = s.content;
      ta.rows      = Math.min(Math.max(s.content.split('\n').length + 1, 3), 12);
      if (!s.edit) {
        ta.readOnly = true;
      } else {
        ta.addEventListener('input', e => s._content = e.target.value);
      }

      const foot = document.createElement('div');
      foot.className = 'sc-foot';

      const db = document.createElement('button');
      db.className = 'ib sm danger';
      db.title     = 'delete script';
      db.innerHTML = ICO.x;
      db.addEventListener('click', () => confirmDel(() => deleteScript(s.id)));

      foot.appendChild(db);
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

  list.scrollTop = savedScroll;
}

function renderSearchResults(q) {
  const list = $('scList');
  list.innerHTML = '';
  let count = 0;

  groups.forEach(g => {
    g.scripts
      .filter(s => s.name.toLowerCase().includes(q))
      .forEach(s => {
        count++;
        const item = document.createElement('div');
        item.className = 'sc-item';

        const row = document.createElement('div');
        row.className = 'sc-row';
        row.style.cursor = 'pointer';
        row.title = `in: ${g.name}`;

        // Expand button
        const expBtn = document.createElement('button');
        expBtn.className = 'ib sm';
        expBtn.title     = s.exp ? 'collapse' : 'expand';
        expBtn.innerHTML = s.exp ? ICO.chevU : ICO.chevD;
        expBtn.addEventListener('click', e => {
          e.stopPropagation();
          s.exp = !s.exp;
          renderScripts();
        });

        // Group badge
        const badge = document.createElement('div');
        badge.className = 'grp-init';
        badge.textContent = init(g.name);
        badge.title = g.name;

        const nameEl = document.createElement('span');
        nameEl.className  = 'sc-name';
        nameEl.textContent = s.name || '(unnamed)';

        const wb = document.createElement('button');
        wb.className   = 'wget-btn';
        wb.textContent = 'wget';
        wb.addEventListener('click', e => { e.stopPropagation(); copyWget(s.id); });

        row.appendChild(expBtn);
        row.appendChild(badge);
        row.appendChild(nameEl);

        // Click → navigate to that group and clear search
        row.addEventListener('click', () => {
          $('sbSearch').value = '';
          selectGrp(g.id);
        });

        item.appendChild(row);

        // Expanded content preview
        if (s.exp) {
          const cont = document.createElement('div');
          cont.className = 'sc-content';

          const ta = document.createElement('textarea');
          ta.className = 'sc-ta';
          ta.value     = s.content || '';
          ta.readOnly  = true;
          ta.rows      = Math.min(Math.max((s.content || '').split('\n').length + 1, 3), 12);

          cont.appendChild(ta);
          item.appendChild(cont);
        }

        // wget in footer (bottom-right)
        const foot = document.createElement('div');
        foot.className = 'sc-foot';
        foot.style.padding = '0 14px 10px';
        wb.addEventListener('click', e => e.stopPropagation());
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
    if (g) $('grpRenameInp').value    = g.name;
  }
}

// ── ACTIONS ──
function selectGrp(id) {
  const prev = grp(selGrp);
  if (prev) prev.scripts.forEach(s => { applyEdits(s); s.exp = false; s.edit = false; });
  selGrp = id;
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

function saveScript(sid) {
  const s = sc(selGrp, sid);
  if (!s) return;
  applyEdits(s); s.edit = false;
  renderScripts();
}

function applyEdits(s) {
  if (s._name    !== undefined) { if (s._name.trim()) s.name = s._name.trim(); delete s._name; }
  if (s._content !== undefined) { s.content = s._content; delete s._content; }
}

function deleteScript(sid) {
  const g = grp(selGrp);
  if (!g) return;
  g.scripts = g.scripts.filter(s => s.id !== sid);
  renderScripts();
}

function copyWget(sid) {
  const cmd = `wget -qO- https://wgetbash.sh/run/${sid} | bash`;
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
  const commit = () => {
    const name = inp.value.trim();
    row.remove();
    if (!name) return;
    const id = uid++;
    groups.push({ id, name, scripts: [] });
    renderGroups();
    selectGrp(id);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') row.remove(); });
  inp.addEventListener('blur', commit);
  row.appendChild(inp);
  list.appendChild(row);
  inp.focus();
}

function addScript() {
  const g = grp(selGrp);
  if (!g) return;
  const id = uid++;
  g.scripts.push({ id, name: '', content: '', exp: true, edit: true, _name: '', _content: '' });
  renderScripts();
  const inp = document.querySelector(`.sc-item[data-id="${id}"] .sc-name-inp`);
  if (inp) inp.focus();
}

function saveGroupName() {
  const g   = grp(selGrp);
  const val = $('grpRenameInp').value.trim();
  if (g && val) { g.name = val; renderGroups(); renderPanelHead(); }
  $('grpDrop').style.display = 'none';
}

function saveUserName() {
  const val = $('userNameInp').value.trim();
  if (val) $('userLbl').textContent = val;
  $('userDrop').style.display = 'none';
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

$('userTrig').addEventListener('click',   e => { e.stopPropagation(); toggleDrop('userDrop'); });
$('grpTrig').addEventListener('click',    e => { e.stopPropagation(); toggleDrop('grpDrop'); });
$('saveUserBtn').addEventListener('click', e => { e.stopPropagation(); saveUserName(); });
$('saveGrpBtn').addEventListener('click',  e => { e.stopPropagation(); saveGroupName(); });
$('delGrpRow').addEventListener('click',   e => {
  e.stopPropagation();
  $('grpDrop').style.display = 'none';
  confirmDel(() => {
    groups = groups.filter(g => g.id !== selGrp);
    selGrp = groups.length ? groups[0].id : null;
    render();
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
    $('userLbl').textContent   = user.username;
    $('userNameInp').value     = user.username;
    $('loginWrap').style.display = 'none';
    $('appWrap').style.display   = 'flex';
    render();
    if (!isMob()) $('backBtn').style.display = 'none';
    else document.body.className = 'vg';
  } catch {
    $('loginWrap').style.display = 'flex';
    $('appWrap').style.display   = 'none';
  }
}

$('logoutRow').removeEventListener('click', null);
$('logoutRow').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
});

initAuth();
