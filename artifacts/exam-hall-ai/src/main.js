const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  room: '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M9 21v-5h6v5M8 8h.01M16 8h.01M8 12h.01M16 12h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  sliders: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
  sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 14 1.1 2.5L23 17.5l-2.9 1.1L19 21l-1-2.4-3-1.1 3-.9L19 14Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  seat: '<path d="M7 10V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5M5 10h14v7H5zM7 17v4m10-4v4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
const NAV = [
  ['/', 'Dashboard', 'grid'], ['/students', 'Students', 'users'], ['/rooms', 'Rooms', 'room'],
  ['/exams', 'Exams', 'calendar'], ['/constraints', 'Constraints', 'sliders'],
  ['/allocation', 'AI Allocation', 'sparkle'], ['/results', 'Results', 'chart'], ['/analysis', 'AI Analysis', 'book'],
];
const state = { path: location.pathname, data: {}, loading: false, error: '', search: '', modal: null, result: null, theme: localStorage.getItem('examai-theme') || 'light', busy: false };
document.documentElement.classList.toggle('dark', state.theme === 'dark');

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(typeof body === 'object' ? body.error || body.message || `Request failed (${response.status})` : body || `Request failed (${response.status})`);
  return body;
};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getArray = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
const fmtDate = (value) => { if (!value) return '—'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
const toast = (message, error = false) => {
  const region = document.querySelector('.toast-region');
  if (!region) return;
  const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.setAttribute('role', error ? 'alert' : 'status'); item.textContent = message;
  region.append(item); setTimeout(() => item.remove(), 3400);
};

function shell() {
  const path = state.path === '/' ? '/' : state.path.replace(/\/$/, '');
  document.querySelector('#root').innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brand-mark">${icon('seat')}</span><span>ExamAI<small>HALL ALLOCATION</small></span></div>
      <div class="nav-label">WORKSPACE</div>
      <nav class="nav-list" aria-label="Primary navigation">
        ${NAV.map(([href, label, ico]) => `<a class="nav-link ${path === href ? 'active' : ''}" href="${href}" data-route="${href}" ${path === href ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${href === '/allocation' ? '<span class="nav-count">AI</span>' : ''}</a>`).join('')}
      </nav>
      <div class="sidebar-bottom"><div class="nav-label">SYSTEM</div><button class="nav-link" data-action="theme" data-testid="theme-toggle" aria-label="Toggle color theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span>${state.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span></button></div>
    </aside>
    <section class="workspace">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:12px"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open navigation" data-testid="mobile-menu">${icon('menu')}</button><div class="crumb">Exam operations <span aria-hidden="true">/</span> <strong>${esc(NAV.find(n => n[0] === path)?.[1] || 'Dashboard')}</strong></div></div>
        <div class="top-actions"><button class="icon-btn" data-action="theme" aria-label="Toggle theme" data-testid="top-theme-toggle">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button><div class="profile"><div class="avatar">EA</div><span>Exam office</span></div></div>
      </header>
      <main class="main-content" id="page-content" aria-live="polite">${pageLoading()}</main>
    </section>
    <div class="toast-region" aria-live="polite"></div>
    <div id="modal-root"></div>
  </div>`;
}
function pageLoading() { return `<div class="page-head"><div><p class="eyebrow">Exam operations</p><h1>Loading workspace</h1><p class="page-subtitle">Connecting to the allocation service…</p></div></div><div class="grid stats-grid">${[1,2,3,4].map(() => '<div class="stat-card"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:60%;height:28px;margin-top:22px"></div></div>').join('')}</div>`; }
function head(eyebrow, title, subtitle, actions = '') { return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`; }
function btn(label, action, primary = false, ico = '') { return `<button class="btn ${primary ? 'btn-primary' : ''}" data-action="${action}" data-testid="${action}-button">${ico ? icon(ico) : ''}${label}</button>`; }
function errorBlock(error, retryAction = 'retry') { return `<div class="panel error-state" role="alert"><div class="empty-mark">${icon('alert')}</div><h3>Could not load this view</h3><p>${esc(error || 'The API did not return a response.')}</p><button class="btn" data-action="${retryAction}" data-testid="retry-button">${icon('arrow')} Try again</button></div>`; }

async function loadView() {
  state.error = ''; state.loading = true;
  if (!document.querySelector('.app-shell')) shell();
  const content = document.querySelector('#page-content'); if (content) content.innerHTML = pageLoading();
  try {
    if (state.path === '/') {
      state.data.dashboard = await api('/dashboard');
    } else if (state.path === '/students') {
      state.data.students = getArray(await api('/students'));
    } else if (state.path === '/rooms') {
      state.data.rooms = getArray(await api('/rooms'));
    } else if (state.path === '/exams') {
      state.data.exams = getArray(await api('/exams'));
    } else if (state.path === '/constraints') {
      state.data.constraints = await api('/constraints');
    } else if (state.path === '/allocation') {
      state.data.exams = getArray(await api('/exams'));
      try { state.result = await api('/allocation/result'); } catch { state.result = null; }
    } else if (state.path === '/results' || state.path === '/analysis') {
      state.result = await api('/allocation/result');
    } else { state.path = '/'; history.replaceState({}, '', '/'); state.data.dashboard = await api('/dashboard'); }
    state.loading = false; renderPage();
  } catch (error) {
    state.loading = false; state.error = error.message;
    const target = document.querySelector('#page-content');
    if (target) target.innerHTML = `${head('Exam operations', NAV.find(n => n[0] === state.path)?.[1] || 'Dashboard', 'Live data from the ExamAI allocation service.')}${errorBlock(error.message)}`;
  }
}
function renderPage() {
  const target = document.querySelector('#page-content');
  if (!target) return;
  if (state.path === '/') target.innerHTML = dashboardPage(state.data.dashboard || {});
  else if (state.path === '/students') target.innerHTML = studentsPage(state.data.students || []);
  else if (state.path === '/rooms') target.innerHTML = roomsPage(state.data.rooms || []);
  else if (state.path === '/exams') target.innerHTML = examsPage(state.data.exams || []);
  else if (state.path === '/constraints') target.innerHTML = constraintsPage(state.data.constraints || {});
  else if (state.path === '/allocation') target.innerHTML = allocationPage(state.data.exams || [], state.result);
  else if (state.path === '/results') target.innerHTML = resultsPage(state.result);
  else if (state.path === '/analysis') target.innerHTML = analysisPage(state.result);
  shellNavUpdate();
}
function shellNavUpdate() {
  const current = state.path === '/' ? '/' : state.path.replace(/\/$/, '');
  document.querySelectorAll('.nav-link[data-route]').forEach(link => {
    const active = link.dataset.route === current; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  const crumb = document.querySelector('.crumb strong'); if (crumb) crumb.textContent = NAV.find(n => n[0] === current)?.[1] || 'Dashboard';
}

function statCard(label, value, foot, ico, color) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon" style="background:${color}18;color:${color}">${icon(ico)}</span></div><div class="stat-value" data-testid="metric-${label.toLowerCase().replaceAll(' ','-')}">${value ?? '—'}</div><div class="stat-foot">${foot}</div></article>`;
}
function dashboardPage(d) {
  const occupied = Number(d.occupied_seats || 0), available = Number(d.available_seats || 0), total = Number(d.total_seats || 0);
  const utilization = total ? Math.round(occupied / total * 100) : 0;
  const latest = d.latest_allocation;
  const allocationName = latest?.exam?.name || latest?.exam_name || latest?.name || 'No allocation yet';
  const status = d.allocation_status || (latest ? 'Ready' : 'Awaiting allocation');
  const chart = `<div class="chart-wrap" role="img" aria-label="Current seat utilization is ${utilization} percent"><svg viewBox="0 0 560 230" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs><line class="chart-gridline" x1="45" y1="35" x2="548" y2="35"/><line class="chart-gridline" x1="45" y1="90" x2="548" y2="90"/><line class="chart-gridline" x1="45" y1="145" x2="548" y2="145"/><line class="chart-gridline" x1="45" y1="198" x2="548" y2="198"/><text class="chart-label" x="2" y="39">100%</text><text class="chart-label" x="12" y="94">66%</text><text class="chart-label" x="12" y="149">33%</text><text class="chart-label" x="24" y="202">0%</text><path class="chart-area" d="M45 198 L548 198 L548 ${198 - utilization * 1.63} L45 ${198 - utilization * 1.63} Z"/><path class="chart-line" d="M45 ${198 - utilization * 1.63} L548 ${198 - utilization * 1.63}"/><circle class="chart-dot" cx="548" cy="${198 - utilization * 1.63}" r="5"/></svg></div>`;
  return `${head('OVERVIEW / LIVE SYSTEM', 'Good morning, Exam office', 'A clear view of your exam-day readiness and seat allocation.', btn('View allocation', 'goto-allocation', true, 'arrow'))}
    <div class="grid stats-grid">
      ${statCard('Students', d.students, 'Registered candidates', 'users', '#5869d8')}
      ${statCard('Exam rooms', d.rooms, 'Rooms in the system', 'room', '#8a70dd')}
      ${statCard('Seat capacity', total, `${available} available seats`, 'seat', '#40ad91')}
      ${statCard('Conflicts', d.conflict_count, status, 'alert', Number(d.conflict_count) > 0 ? '#da7182' : '#42b99b')}
    </div>
    <div class="grid dashboard-grid">
      <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Seat utilization</h2><p class="panel-note">Current allocation against total configured capacity</p></div><span class="pill">${utilization}% in use</span></div>${chart}<div style="display:flex;justify-content:space-between;color:var(--muted);font-size:10px"><span>Current allocation</span><span>${occupied} occupied of ${total} seats</span></div></section>
      <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Allocation snapshot</h2><p class="panel-note">Most recent server-reported run</p></div><span class="pill ${Number(d.conflict_count) ? 'amber' : 'mint'}">${esc(status)}</span></div>
       <div class="status-block"><div class="donut" style="background:conic-gradient(var(--primary) 0deg ${utilization * 3.6}deg,var(--line) ${utilization * 3.6}deg 360deg)"><div class="donut-label">${utilization}%<small>capacity</small></div></div><div class="legend"><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:var(--primary)"></i>Occupied</span><strong>${occupied}</strong></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:var(--line)"></i>Available</span><strong>${available}</strong></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:var(--amber)"></i>Conflicts</span><strong>${d.conflict_count ?? '—'}</strong></div></div></div>
       <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;justify-content:space-between;align-items:center"><div><span class="subline">LATEST EXAM</span><strong style="font-size:12px">${esc(allocationName)}</strong></div><button class="tiny-link" data-action="goto-results">Open results ${icon('arrow')}</button></div>
      </section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Exam cycle</h2><p class="panel-note">Your workflow, from candidate records to verified seating</p></div><span class="pill">${d.exam_count ?? '—'} exams configured</span></div><div class="grid workflow-grid" style="gap:10px">
      ${[['01','Prepare roster','Confirm candidates and special requirements','/students'],['02','Configure halls','Map rooms, capacity and accessible seats','/rooms'],['03','Set constraints','Tune the CSP preferences for this run','/constraints'],['04','Run allocation','Generate an explainable seat plan','/allocation']].map(([n,t,p,l])=>`<button class="panel" data-route="${l}" style="text-align:left;padding:13px;border-radius:11px;cursor:pointer"><span class="eyebrow">${n}</span><strong style="display:block;font:700 12px var(--display);margin-bottom:4px">${t}</strong><span class="subline">${p}</span></button>`).join('')}
    </div></section>`;
}

function searchToolbar(placeholder, extra = '') { return `<div class="table-toolbar"><label class="search-wrap">${icon('search')}<input class="search-input" type="search" placeholder="${placeholder}" data-testid="list-search" aria-label="${placeholder}"></label><div class="actions">${extra}</div></div>`; }
function emptyState(title, message, action = '') { return `<div class="empty-state"><div class="empty-mark">${icon('grid')}</div><h3>${title}</h3><p>${message}</p>${action}</div>`; }
function studentsPage(items) {
  const actions = `<button class="btn" data-action="load-sample" data-testid="load-sample-button">Load sample students</button><button class="btn" data-action="import-file" data-testid="import-csv-button">${icon('upload')}Import CSV</button>${btn('Add student','add-student',true,'plus')}`;
  const rows = items.map(s => `<tr data-searchable="${esc([s.name,s.roll_number,s.class_name,s.section,s.subject,s.special_requirement].join(' ').toLowerCase())}"><td><div class="person-cell"><div class="person-mark">${esc((s.name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div><span class="person-name">${esc(s.name)}</span><span class="subline">${esc(s.id)}</span></div></div></td><td class="mono">${esc(s.roll_number)}</td><td>${esc(s.class_name)} <span class="subline">Section ${esc(s.section)}</span></td><td>${esc(s.subject)}</td><td>${s.special_requirement ? `<span class="pill mint">${esc(s.special_requirement)}</span>` : '<span style="color:var(--muted)">—</span>'}</td><td><div class="row-actions"><button class="row-action" data-action="edit-student" data-id="${esc(s.id)}" aria-label="Edit ${esc(s.name)}" data-testid="edit-student-${esc(s.id)}">${icon('edit')}</button><button class="row-action delete" data-action="delete-student" data-id="${esc(s.id)}" data-label="${esc(s.name)}" aria-label="Delete ${esc(s.name)}" data-testid="delete-student-${esc(s.id)}">${icon('trash')}</button></div></td></tr>`).join('');
  return `${head('ROSTER / CANDIDATES','Students','Manage candidate records, requirements and exam eligibility.',actions)}
    <section class="panel lookup-card" style="margin-bottom:16px"><div class="panel-head"><div><p class="eyebrow">QUICK LOOKUP</p><h2 class="panel-title">Find a candidate’s seat</h2><p class="panel-note">Search the allocation service by student ID or roll number.</p></div>${icon('search')}</div><form class="lookup-form" id="student-lookup-form"><input class="field-input" name="lookup" placeholder="Enter student ID or roll number" required aria-label="Student ID or roll number" data-testid="student-lookup-input"><button class="btn btn-primary" type="submit" data-testid="student-lookup-button">${icon('search')}Find seat</button></form><div class="lookup-result" id="lookup-result" aria-live="polite"></div></section>
    <section class="panel table-panel">${searchToolbar('Search by student, roll number or class…')}<div class="table-scroll"><table><thead><tr><th>Student</th><th>Roll number</th><th>Class / section</th><th>Subject</th><th>Requirement</th><th>Actions</th></tr></thead><tbody id="data-rows">${rows || ''}</tbody></table></div>${items.length ? '' : emptyState('No students in the roster','Add a candidate, import a CSV, or load the server sample set.',btn('Add first student','add-student',true,'plus'))}</section><input hidden type="file" id="csv-file" accept=".csv,text/csv" data-testid="csv-file-input"><div id="import-feedback" class="form-error" role="status"></div>`;
}
function roomsPage(items) {
  const rows = items.map(r => `<tr data-searchable="${esc([r.id,r.name,r.rows,r.columns,r.capacity].join(' ').toLowerCase())}"><td><div class="person-cell"><div class="person-mark">${icon('room')}</div><div><span class="person-name">${esc(r.name)}</span><span class="subline">${esc(r.id)}</span></div></div></td><td>${r.rows} × ${r.columns}</td><td><strong>${r.capacity}</strong> seats</td><td><span class="pill mint">${Array.isArray(r.accessible_seats) ? r.accessible_seats.length : 0} accessible</span></td><td><button class="tiny-link" data-action="view-room" data-id="${esc(r.id)}">Seat layout ${icon('arrow')}</button></td><td><div class="row-actions"><button class="row-action" data-action="edit-room" data-id="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">${icon('edit')}</button><button class="row-action delete" data-action="delete-room" data-id="${esc(r.id)}" data-label="${esc(r.name)}" aria-label="Delete ${esc(r.name)}">${icon('trash')}</button></div></td></tr>`).join('');
  return `${head('FACILITIES / CAPACITY','Rooms','Define hall dimensions and accessible seat positions.',btn('Add room','add-room',true,'plus'))}<section class="panel table-panel">${searchToolbar('Search rooms…')}<div class="table-scroll"><table><thead><tr><th>Room</th><th>Grid dimensions</th><th>Capacity</th><th>Accessibility</th><th>Map</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>${items.length?'':emptyState('No rooms configured','Add a room to make seats available for the solver.',btn('Add first room','add-room',true,'plus'))}</section><div id="room-map-modal"></div>`;
}
function examsPage(items) {
  const rows = items.map(e => `<tr data-searchable="${esc([e.name,e.subject,e.date,e.id].join(' ').toLowerCase())}"><td><div class="person-cell"><div class="person-mark">${icon('calendar')}</div><div><span class="person-name">${esc(e.name)}</span><span class="subline">${esc(e.id)}</span></div></div></td><td>${esc(e.subject)}</td><td>${fmtDate(e.date)}<span class="subline">${esc(e.time)}</span></td><td>${e.duration} min</td><td><div class="row-actions"><button class="row-action" data-action="edit-exam" data-id="${esc(e.id)}" aria-label="Edit ${esc(e.name)}">${icon('edit')}</button><button class="row-action delete" data-action="delete-exam" data-id="${esc(e.id)}" data-label="${esc(e.name)}" aria-label="Delete ${esc(e.name)}">${icon('trash')}</button></div></td></tr>`).join('');
  return `${head('SCHEDULE / SITTINGS','Exams','Schedule exams and prepare each sitting for allocation.',btn('Add exam','add-exam',true,'plus'))}<section class="panel table-panel">${searchToolbar('Search exams or subjects…')}<div class="table-scroll"><table><thead><tr><th>Exam</th><th>Subject</th><th>Date / time</th><th>Duration</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>${items.length?'':emptyState('No exams scheduled','Create an exam sitting before you run an allocation.',btn('Add first exam','add-exam',true,'plus'))}</section>`;
}

function constraintsPage(c) {
  return `${head('SOLVER / PREFERENCES','Constraints','Choose how the CSP should balance seat assignments.',`<span class="pill mint" id="constraint-status">Server preferences</span>`)}
  <div class="grid split-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Separation preferences</h2><p class="panel-note">These are solver preferences—not guaranteed hard constraints.</p></div>${icon('sliders')}</div>
    <div class="constraint-row"><div><strong>Avoid same-section neighbors</strong><p>Prefer not to seat candidates from one section adjacent to each other.</p></div><button class="switch" role="switch" aria-checked="${!!c.avoid_same_section}" data-constraint="avoid_same_section" aria-label="Avoid same section" data-testid="constraint-avoid-same-section"></button></div>
    <div class="constraint-row"><div><strong>Avoid same-subject neighbors</strong><p>Spread candidates taking the same subject across neighboring seats.</p></div><button class="switch" role="switch" aria-checked="${!!c.avoid_same_subject}" data-constraint="avoid_same_subject" aria-label="Avoid same subject" data-testid="constraint-avoid-same-subject"></button></div>
    <div class="constraint-row"><div><strong>Section separation weight</strong><p>Relative penalty applied by the solver (0–10).</p><div class="range-row"><input type="range" min="0" max="10" value="${Number(c.section_weight ?? 0)}" data-constraint="section_weight" data-testid="constraint-section-weight" aria-label="Section separation weight"><output class="range-value">${Number(c.section_weight ?? 0)}</output></div></div><span class="pill">Weight</span></div>
    <div class="constraint-row"><div><strong>Subject separation weight</strong><p>Relative penalty applied by the solver (0–10).</p><div class="range-row"><input type="range" min="0" max="10" value="${Number(c.subject_weight ?? 0)}" data-constraint="subject_weight" data-testid="constraint-subject-weight" aria-label="Subject separation weight"><output class="range-value">${Number(c.subject_weight ?? 0)}</output></div></div><span class="pill">Weight</span></div>
    <div class="actions" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-primary" data-action="save-constraints" data-testid="save-constraints-button">${icon('check')}Save preferences</button></div><p class="form-error" id="constraint-error" role="status"></p>
  </section>
  <aside class="panel"><p class="eyebrow">CSP FIELD NOTES</p><h2 class="panel-title" style="font-size:17px;margin-bottom:10px">Preferences shape the search.</h2><p class="page-subtitle" style="line-height:1.7">A constraint satisfaction problem describes the exam as variables, domains and constraints. A seat is a variable assignment; room seats form the domain; the preferences here guide the solver toward a lower-conflict arrangement.</p><div class="explain-card" style="margin-top:17px"><strong style="font:700 12px var(--display)">Hard vs. soft</strong><p style="font-size:11px;line-height:1.6;margin:6px 0 0;color:var(--muted)">Room capacity and an individual seat assignment are structural requirements. Section and subject spacing are optimization preferences; actual outcomes are reported in the run results.</p></div><button class="tiny-link" style="margin-top:12px;padding-left:0" data-route="/analysis">Explore the CSP explanation ${icon('arrow')}</button></aside></div>`;
}

function statsEntries(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).filter(([,v]) => ['string','number','boolean'].includes(typeof v));
}
function allocationPage(exams, result) {
  const examOptions = exams.map(e => `<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.subject)} · ${fmtDate(e.date)}</option>`).join('');
  const resultBlock = result && typeof result === 'object' && result.success !== undefined ? allocationResultSummary(result) : `<div class="panel" style="text-align:center;padding:21px;margin-top:16px"><span class="pill">No run loaded</span><p class="page-subtitle" style="margin-top:9px">Run the solver to request a current result from the API. Existing assignments are never generated in the browser.</p></div>`;
  return `${head('CSP SOLVER / EXECUTION','AI Allocation','Run the server-side solver and inspect its actual assignments.')}
    <section class="allocation-hero"><p class="eyebrow">EXPLAINABLE SEAT ALLOCATION</p><h2>Turn exam constraints into a seat plan.</h2><p>Select a scheduled exam. ExamAI sends the exam identifier to the allocation API and presents the solver’s returned assignments, conflicts and statistics.</p>
    <form class="allocation-form" id="allocation-form" data-testid="allocation-form"><label class="sr-only" for="allocation-exam">Choose exam</label><select class="field-select" name="exam_id" id="allocation-exam" required data-testid="allocation-exam-select"><option value="">Choose an exam…</option>${examOptions}</select><button class="btn btn-primary" type="submit" data-testid="run-allocation-button">${icon('sparkle')}Run allocation</button></form><div class="form-error" id="allocation-error" role="alert"></div></section>
    ${resultBlock}`;
}
function allocationResultSummary(r) {
  const counts = r.totals && typeof r.totals === 'object' ? statsEntries(r.totals) : [];
  const stats = r.statistics && typeof r.statistics === 'object' ? statsEntries(r.statistics) : [];
  const conflicts = Array.isArray(r.conflicts) ? r.conflicts.length : 0;
  const students = Array.isArray(r.assignments) ? r.assignments.length : 0;
  const summaryValues = counts.slice(0,4);
  return `<section class="panel"><div class="panel-head"><div><p class="eyebrow">SERVER RESPONSE · ${esc(r.created_at || 'latest')}</p><h2 class="panel-title">${esc(r.exam?.name || 'Allocation result')}</h2><p class="panel-note">${esc(r.exam?.subject || '')} ${r.exam?.date ? `· ${fmtDate(r.exam.date)}` : ''}</p></div><span class="pill ${r.success && !conflicts ? 'mint' : 'amber'}">${r.success ? 'Run completed' : 'Run reported issues'}</span></div>
  <div class="result-summary">${(summaryValues.length ? summaryValues : [['assignments',students],['conflicts',conflicts]]).map(([k,v])=>`<div class="mini-stat"><strong>${esc(v)}</strong><span>${esc(k.replaceAll('_',' '))}</span></div>`).join('')}</div>
  <div style="display:flex;gap:9px;flex-wrap:wrap"><span class="pill">${students} assignments returned</span><span class="pill ${conflicts ? 'amber' : 'mint'}">${conflicts} conflicts returned</span><button class="tiny-link" data-action="goto-results">Inspect room maps ${icon('arrow')}</button></div>
  ${stats.length ? `<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:12px"><p class="eyebrow">SERVER-REPORTED ALGORITHM STATISTICS</p><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px">${stats.map(([k,v])=>`<div class="mini-stat"><strong style="font-size:14px">${esc(v)}</strong><span>${esc(k.replaceAll('_',' '))}</span></div>`).join('')}</div></div>` : ''}</section>`;
}
function resultsPage(r) {
  if (!r || typeof r !== 'object' || r.success === undefined) return `${head('OUTPUT / ASSIGNMENTS','Results','Review actual server-generated room seating and conflicts.')}${emptyState('No allocation result available','Run an allocation first. This view does not generate or assume any seat assignments.',`<button class="btn btn-primary" data-action="goto-allocation">${icon('sparkle')}Go to AI Allocation</button>`)}`;
  const maps = Array.isArray(r.rooms) ? r.rooms : [];
  const assignments = Array.isArray(r.assignments) ? r.assignments : [];
  const conflicts = Array.isArray(r.conflicts) ? r.conflicts : [];
  return `${head('OUTPUT / ASSIGNMENTS','Results',`${r.exam?.name || 'Latest allocation'} · ${r.created_at || 'server result'}`,`<button class="btn" data-action="refresh-results">${icon('arrow')}Refresh result</button>`)}
    ${allocationResultSummary(r)}
    ${maps.length ? `<div style="display:grid;gap:15px;margin-top:16px">${maps.map(room=>roomMap(room,assignments)).join('')}</div>` : `<section class="panel" style="margin-top:16px">${emptyState('No room map in this response','The API returned no room seat maps for this result.')}</section>`}
    <section class="panel table-panel" style="margin-top:16px"><div class="table-toolbar"><div><h2 class="panel-title">Assignments</h2><p class="panel-note">${assignments.length} assignment records returned by the solver</p></div><label class="search-wrap">${icon('search')}<input class="search-input" type="search" placeholder="Find a candidate…" data-testid="assignment-search"></label></div><div class="table-scroll"><table><thead><tr><th>Candidate</th><th>Roll number</th><th>Class / section</th><th>Subject</th><th>Room</th><th>Seat</th></tr></thead><tbody>${assignments.map(a=>`<tr data-searchable="${esc([a.student_name,a.roll_number,a.class_name,a.section,a.subject,a.room_name,a.seat_id].join(' ').toLowerCase())}"><td>${esc(a.student_name)}</td><td class="mono">${esc(a.roll_number)}</td><td>${esc(a.class_name)} / ${esc(a.section)}</td><td>${esc(a.subject)}</td><td>${esc(a.room_name)}</td><td class="mono">${esc(a.seat_id || `${a.row},${a.column}`)}</td></tr>`).join('')}</tbody></table></div>${assignments.length?'':emptyState('No assignments returned','The result contains no assignment records.')}</section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Conflicts</h2><p class="panel-note">Only conflicts supplied in the server response are shown.</p></div><span class="pill ${conflicts.length?'amber':'mint'}">${conflicts.length} returned</span></div>${conflicts.length ? `<div class="table-scroll"><table><thead><tr><th>Roll numbers</th><th>Reasons</th><th>Score</th></tr></thead><tbody>${conflicts.map(c=>`<tr><td class="mono">${esc((c.roll_numbers||[]).join(', '))}</td><td>${esc((c.reasons||[]).join('; '))}</td><td>${esc(c.score)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="page-subtitle">No conflicts were reported by this result.</p>'}</section>`;
}
function roomMap(room, allAssignments = []) {
  const seats = Array.isArray(room.seats) ? room.seats : [];
  const cols = Math.max(1, Number(room.columns) || 1), rows = Math.max(1, Number(room.rows) || 1);
  const placed = new Map();
  seats.forEach(a => placed.set(`${a.row}-${a.column}`, a));
  if (!seats.length) allAssignments.filter(a=>a.room_id===room.room_id).forEach(a=>placed.set(`${a.row}-${a.column}`,a));
  let cells = '';
  for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) {
    const a=placed.get(`${r}-${c}`); cells+=`<div class="seat ${a?'occupied':''} ${a?.special?'special':''}" title="${a?`${esc(a.student_name)} · ${esc(a.roll_number)}`:`Row ${r}, seat ${c}`}" aria-label="${a?`Occupied by ${esc(a.student_name)} (${esc(a.roll_number)})`:`Empty seat row ${r}, seat ${c}`}">${a?esc(a.roll_number || a.seat_id || '●'):''}</div>`;
  }
  return `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${esc(room.room_name || room.name || room.room_id)}</h2><p class="panel-note">${rows} rows × ${cols} columns · ${seats.length || allAssignments.filter(a=>a.room_id===room.room_id).length} assigned</p></div><span class="pill">${esc(room.room_id || '')}</span></div><div class="screen-label">FRONT OF ROOM</div><div class="seat-map" style="grid-template-columns:repeat(${Math.min(cols,12)},34px)">${cells}</div><div class="map-legend"><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Available</span><span><i style="background:#e9ecff"></i>Assigned</span><span><i style="background:#e4f5ef"></i>Special requirement</span></div></section>`;
}
function analysisPage(r) {
  const stats = r?.statistics && typeof r.statistics === 'object' ? statsEntries(r.statistics) : [];
  const totals = r?.totals && typeof r.totals === 'object' ? statsEntries(r.totals) : [];
  return `${head('EXPLAINABILITY / CSP','AI Analysis','Understand the model—and inspect metrics only when the API has returned them.')}
    <section class="explain-card"><p class="eyebrow">THE MODEL, IN PLAIN LANGUAGE</p><h2 style="font:800 22px var(--display);letter-spacing:-.6px;margin:5px 0 8px">Seating is a constraint satisfaction problem.</h2><p style="color:var(--muted);line-height:1.7;font-size:12px;max-width:850px;margin:0">The solver searches for a mapping from each candidate to one physical seat. It must honor the exam’s structural rules—such as assigning candidates within room capacity—while preferences can reduce undesirable adjacency. The returned plan is inspectable: each assignment, conflict and statistic below comes from the Flask API, not a browser-side simulation.</p></section>
    <div class="concept-list">
      <article class="concept"><span class="concept-num">01 / VARIABLES</span><h3>Who needs a seat?</h3><p>Each candidate becomes a variable in the problem. An assignment links their identity, class, subject and requirements to a specific seat.</p></article>
      <article class="concept"><span class="concept-num">02 / DOMAINS</span><h3>Where can they sit?</h3><p>The candidate’s domain is the set of available physical seats across the configured rooms. Room geometry gives those choices a clear map.</p></article>
      <article class="concept"><span class="concept-num">03 / CONSTRAINTS</span><h3>What makes a plan valid?</h3><p>Capacity and unique seat occupancy define the structure. Weighted preferences influence candidate spacing; conflicts expose any trade-offs reported by the solver.</p></article>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><p class="eyebrow">LATEST SERVER RESPONSE</p><h2 class="panel-title">${r?.exam?.name ? esc(r.exam.name) : 'No allocation metrics loaded'}</h2><p class="panel-note">${r?.created_at ? `Created ${esc(r.created_at)}` : 'Metrics appear after a successful allocation run.'}</p></div>${r ? `<span class="pill ${r.success?'mint':'amber'}">${r.success?'Result available':'Solver reported issues'}</span>` : ''}</div>
      ${stats.length || totals.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:11px">${[...totals.map(([k,v])=>[k,v,'total']),...stats.map(([k,v])=>[k,v,'statistic'])].map(([k,v,type])=>`<div class="mini-stat"><span>${type.toUpperCase()} · ${esc(k.replaceAll('_',' '))}</span><strong>${esc(v)}</strong></div>`).join('')}</div>` : '<div class="empty-state" style="padding:24px"><div class="empty-mark">'+icon('chart')+'</div><h3>No algorithm statistics in the response</h3><p>ExamAI will display only metrics supplied by the allocation API.</p></div>'}
      ${r ? `<div style="margin-top:15px"><p class="panel-note">Response payload status: ${r.success ? 'success' : 'not successful'} · ${Array.isArray(r.assignments) ? r.assignments.length : 0} assignments · ${Array.isArray(r.conflicts) ? r.conflicts.length : 0} conflicts</p></div>` : `<button class="btn btn-primary" data-action="goto-allocation">${icon('sparkle')}Run an allocation</button>`}
    </section><section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Read the seating plan</h2><p class="panel-note">Results preserve the solver’s returned room and seat coordinates.</p></div><button class="tiny-link" data-action="goto-results">Open results ${icon('arrow')}</button></div><p class="page-subtitle" style="line-height:1.7">A seat map is not just a display. It is the human-readable projection of the solver’s variable assignments. Special requirements are indicated when the response marks an assignment as special; no seat is inferred or rearranged in this interface.</p></section>`;
}

const FORM_FIELDS = {
  student: [
    ['id','Student ID','text',true],['name','Full name','text',true],['roll_number','Roll number','text',true],
    ['class_name','Class','text',true],['section','Section','text',true],['subject','Subject','text',true],
    ['special_requirement','Special requirement','text',false],
  ],
  room: [
    ['id','Room ID','text',true],['name','Room name','text',true],['rows','Rows','number',true],
    ['columns','Columns','number',true],['accessible_seats','Accessible seats','text',false],
  ],
  exam: [
    ['id','Exam ID','text',true],['name','Exam name','text',true],['subject','Subject','text',true],
    ['date','Date','date',true],['time','Start time','time',true],['duration','Duration (minutes)','number',true],
  ],
};
function openForm(kind, item = null) {
  const fields = FORM_FIELDS[kind], title = `${item ? 'Edit' : 'Add'} ${kind}`;
  const formFields = fields.map(([key,label,type,required]) => {
    let value = item?.[key] ?? '';
    if (kind === 'room' && key === 'accessible_seats') value = Array.isArray(value) ? value.join(', ') : '';
    const hint = kind === 'room' && key === 'accessible_seats' ? '<span class="subline">Comma-separated seat IDs; leave blank if none.</span>' : '';
    return `<div class="field ${key === 'special_requirement' ? 'full' : ''}"><label for="field-${key}">${label}${required ? ' *' : ''}</label><input class="field-input" id="field-${key}" name="${key}" type="${type}" ${type === 'number' ? 'min="1"' : ''} ${required ? 'required' : ''} value="${esc(value)}" ${item && key === 'id' ? 'readonly' : ''} data-testid="form-${kind}-${key}">${hint}</div>`;
  }).join('');
  document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div class="modal-head"><div><h2 id="form-title">${title}</h2><p>Fields marked with * are required.</p></div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><form id="entity-form" data-kind="${kind}" data-id="${esc(item?.id || '')}"><div class="form-grid">${formFields}</div><p id="entity-form-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit" data-testid="save-${kind}-button">${icon('check')}${item ? 'Save changes' : `Create ${kind}`}</button></div></form></section></div>`;
  document.querySelector('#field-' + fields[0][0])?.focus();
}
function openRoomMap(room) {
  const rows = Math.max(1, Number(room.rows) || 1), cols = Math.max(1, Number(room.columns) || 1);
  const accessible = new Set(Array.isArray(room.accessible_seats) ? room.accessible_seats.map(value => String(value).toUpperCase()) : []);
  let cells = '';
  for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) {
    const seatId = `${r}-${c}`, suffix = `-R${r}-C${c}`;
    const isAccessible = accessible.has(seatId.toUpperCase()) || accessible.has(`R${r}C${c}`) || [...accessible].some(value => value.endsWith(suffix));
    cells += `<div class="seat ${isAccessible ? 'special' : ''}" title="${isAccessible ? 'Accessible seat' : `Row ${r}, seat ${c}`}" aria-label="${isAccessible ? 'Accessible seat' : `Row ${r}, seat ${c}`}">${esc(seatId)}</div>`;
  }
  document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="room-map-title"><div class="modal-head"><div><h2 id="room-map-title">${esc(room.name)}</h2><p>${room.rows} rows × ${room.columns} columns · ${room.capacity} seats configured</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close room map">${icon('close')}</button></div><div class="screen-label">FRONT OF ROOM</div><div class="seat-map" style="grid-template-columns:repeat(${Math.min(cols,12)},34px)">${cells}</div><div class="map-legend"><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Standard seat</span><span><i style="background:#e4f5ef"></i>Accessible</span></div><div class="modal-actions"><button class="btn" data-action="close-modal">Close map</button></div></section></div>`;
}
async function submitEntity(form) {
  const kind = form.dataset.kind, id = form.dataset.id, data = Object.fromEntries(new FormData(form).entries());
  const error = document.querySelector('#entity-form-error');
  if (kind === 'room') {
    data.rows = Number(data.rows); data.columns = Number(data.columns);
    data.accessible_seats = data.accessible_seats ? data.accessible_seats.split(',').map(v=>v.trim()).filter(Boolean) : [];
  }
  if (kind === 'exam') data.duration = Number(data.duration);
  if (kind === 'student' && !data.special_requirement) data.special_requirement = null;
  const endpoint = kind === 'student' ? '/students' : kind === 'room' ? '/rooms' : '/exams';
  const method = id ? 'PUT' : 'POST';
  const resourceId = encodeURIComponent(id);
  try {
    await api(id ? `${endpoint}/${resourceId}` : endpoint, { method, body: JSON.stringify(data) });
    document.querySelector('#modal-root').innerHTML = '';
    toast(`${kind[0].toUpperCase()+kind.slice(1)} ${id ? 'updated' : 'created'}.`);
    await loadView();
  } catch (e) { if (error) error.textContent = e.message; }
}
async function removeEntity(kind, id, label) {
  if (!confirm(`Delete ${label || kind}? This cannot be undone.`)) return;
  const endpoint = kind === 'student' ? '/students' : kind === 'room' ? '/rooms' : '/exams';
  try {
    await api(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast(`${kind[0].toUpperCase()+kind.slice(1)} deleted.`);
    await loadView();
  } catch (e) { toast(e.message, true); }
}
function csvQuoted(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}
    else if(ch==='"') quoted=!quoted;
    else if(ch===','&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}
    else cell+=ch;
  }
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
async function importCsv(file) {
  const status = document.querySelector('#import-feedback'); if (!file) return;
  try {
    const csv = await file.text();
    if (!csv.trim()) throw new Error('The selected CSV file is empty.');
    const result = await api('/students/import', { method:'POST', body:JSON.stringify({ csv }) });
    const count = result.imported ?? result.count ?? '—';
    if (status) status.textContent = `${count} students imported.${Array.isArray(result.errors) && result.errors.length ? ` ${result.errors.length} rows need attention.` : ''}`;
    toast(`CSV import finished · ${count} imported.`);
    await loadView();
  } catch(e) { if(status) status.textContent = e.message; toast(e.message, true); }
}
async function lookupStudent(form) {
  const query = new FormData(form).get('lookup').trim(), out = document.querySelector('#lookup-result');
  if (!query || !out) return;
  out.innerHTML = '<div class="skeleton" style="width:60%"></div>';
  try {
    const result = await api(`/student/${encodeURIComponent(query)}`);
    const student = result.student || result, assignment = result.assignment || result.seat || null;
    const room = assignment?.room_name || assignment?.room?.name || 'Not allocated yet';
    const seat = assignment?.seat_id || (assignment?.row != null ? `Row ${assignment.row}, seat ${assignment.column}` : 'Not allocated yet');
    out.innerHTML = `<div class="panel" style="padding:13px"><div class="person-cell"><div class="person-mark">${esc((student.name||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div><strong>${esc(student.name || 'Candidate found')}</strong><span class="subline">${esc(student.roll_number || query)} · ${esc(student.class_name || '')} ${esc(student.section || '')}</span></div></div><div class="result-summary" style="margin-bottom:0"><div class="mini-stat"><strong style="font-size:14px">${esc(room)}</strong><span>ROOM</span></div><div class="mini-stat"><strong style="font-size:14px">${esc(seat)}</strong><span>ASSIGNED SEAT</span></div></div></div>`;
  } catch(e) { out.innerHTML = `<div class="form-error" role="alert">${esc(e.message)}</div>`; }
}
async function saveConstraints() {
  const inputs = document.querySelectorAll('[data-constraint]'), data = {};
  inputs.forEach(input => data[input.dataset.constraint] = input.type === 'range' ? Number(input.value) : input.getAttribute('aria-checked') === 'true');
  const status = document.querySelector('#constraint-error');
  try {
    const result = await api('/constraints', { method:'PATCH', body:JSON.stringify(data) });
    state.data.constraints = result || data;
    if (status) status.textContent = 'Preferences saved to the API.';
    toast('Solver preferences saved.');
  } catch(e) { if(status) status.textContent = e.message; }
}
async function runAllocation(form) {
  const exam_id = new FormData(form).get('exam_id'), error = document.querySelector('#allocation-error');
  if (!exam_id) { if(error) error.textContent = 'Choose an exam before running allocation.'; return; }
  const button = form.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Running solver…';
  if (error) error.textContent = '';
  try {
    await api('/allocation/run', { method:'POST', body:JSON.stringify({ exam_id }) });
    const result = await api('/allocation/result');
    state.result = result; renderPage(); toast('Allocation result received from the server.');
    if (result.success === false) toast('The solver returned a result with issues. Review conflicts.', true);
  } catch(e) {
    if(error) error.textContent = e.message;
    button.disabled = false; button.innerHTML = `${icon('sparkle')}Run allocation`;
  }
}

document.addEventListener('click', async (event) => {
  const routeLink = event.target.closest('[data-route]');
  if (routeLink) {
    event.preventDefault();
    const path = routeLink.dataset.route;
    history.pushState({}, '', path); state.path = path; state.search = '';
    document.querySelector('#sidebar')?.classList.remove('open');
    await loadView(); return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'theme') {
    state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('examai-theme', state.theme);
    document.documentElement.classList.toggle('dark', state.theme === 'dark'); shellNavUpdate();
    document.querySelectorAll('[data-action="theme"]').forEach(b => { b.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon') + (b.classList.contains('nav-link') ? `<span>${state.theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>` : ''); });
  } else if (action === 'menu') document.querySelector('#sidebar')?.classList.toggle('open');
  else if (action === 'add-student') openForm('student');
  else if (action === 'add-room') openForm('room');
  else if (action === 'add-exam') openForm('exam');
  else if (action === 'close-modal' || (action === 'backdrop-close' && event.target === button)) document.querySelector('#modal-root').innerHTML = '';
  else if (action === 'edit-student') openForm('student', state.data.students.find(x=>x.id===button.dataset.id));
  else if (action === 'edit-room') openForm('room', state.data.rooms.find(x=>x.id===button.dataset.id));
  else if (action === 'edit-exam') openForm('exam', state.data.exams.find(x=>x.id===button.dataset.id));
  else if (action === 'delete-student') await removeEntity('student',button.dataset.id,button.dataset.label);
  else if (action === 'delete-room') await removeEntity('room',button.dataset.id,button.dataset.label);
  else if (action === 'delete-exam') await removeEntity('exam',button.dataset.id,button.dataset.label);
  else if (action === 'view-room') { const room=state.data.rooms.find(x=>x.id===button.dataset.id); if(room) openRoomMap(room); }
  else if (action === 'load-sample') {
    button.disabled=true;
    try { const res=await api('/students/load-sample',{method:'POST'}); toast(res.message || `${res.count ?? 'Sample'} sample students loaded.`); await loadView(); }
    catch(e){toast(e.message,true);button.disabled=false;}
  } else if (action === 'import-file') document.querySelector('#csv-file')?.click();
  else if (action === 'save-constraints') await saveConstraints();
  else if (action === 'goto-allocation') { history.pushState({},'','/allocation');state.path='/allocation';await loadView(); }
  else if (action === 'goto-results') { history.pushState({},'','/results');state.path='/results';await loadView(); }
  else if (action === 'refresh-results' || action === 'retry') await loadView();
});
document.addEventListener('submit', async event => {
  const form=event.target;
  if (form.id==='entity-form') { event.preventDefault(); await submitEntity(form); }
  else if(form.id==='allocation-form'){event.preventDefault();await runAllocation(form);}
  else if(form.id==='student-lookup-form'){event.preventDefault();await lookupStudent(form);}
});
document.addEventListener('change', event => {
  if (event.target.id === 'csv-file' && event.target.files?.[0]) importCsv(event.target.files[0]);
});
document.addEventListener('input', event => {
  if (event.target.matches('.search-input')) {
    const query=event.target.value.toLowerCase().trim();
    const table=event.target.closest('.panel')?.querySelector('tbody');
    if(table) table.querySelectorAll('tr[data-searchable]').forEach(row=>row.hidden=!row.dataset.searchable.includes(query));
  }
  if (event.target.matches('input[type="range"][data-constraint]')) event.target.nextElementSibling.textContent=event.target.value;
});
document.addEventListener('click', event => {
  const toggle=event.target.closest('[data-constraint][role="switch"]');
  if(toggle) toggle.setAttribute('aria-checked',toggle.getAttribute('aria-checked')!=='true'?'true':'false');
});
window.addEventListener('popstate', () => { state.path=location.pathname;state.search='';loadView(); });
shell();
loadView();