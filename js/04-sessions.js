// ===================== SESSION DETAIL MODAL =====================
function sessionBlockReps(log) {
  if(!log) return [];
  if(Array.isArray(log.block_reps)) return log.block_reps.slice();
  if(log.blocks && log.reps_per_block) {
    var a=[]; for(var i=0;i<log.blocks;i++) a.push(log.reps_per_block); return a;
  }
  return [];
}
function sessionRepsDisplay(log) {
  var r=sessionBlockReps(log);
  if(!r.length) return '\u2014';
  var allSame=r.every(function(x){ return x===r[0]; });
  return allSame ? String(r[0]) : r.join(' \u00b7 ');
}
function openSessionDetail(sessionId) {
  openSessionId = sessionId;
  document.getElementById('session-overlay').classList.add('open');
  renderSessionModalContent(sessionId);
}
function closeSessionModal() {
  document.getElementById('session-overlay').classList.remove('open');
  openSessionId = null;
}
function sessionOverlayClick(e) {
  if(e.target === document.getElementById('session-overlay')) closeSessionModal();
}
function renderSessionModalContent(sessionId) {
  var session = COND_SESSIONS.find(function(s){ return s.id === sessionId; });
  if(!session) return;
  var log = sessionLogData[sessionId] || null;
  var isTue = session.day === 'Tuesday';
  var dayType = isTue ? '2-min run (Tuesday)' : '1-min run (Thursday)';
  var dayKey = isTue ? 'tue' : 'thu';
  var canEdit = isAdminUnlocked() || isCoachLoggedIn();

  var titleEl = document.getElementById('session-modal-title');
  if(titleEl) titleEl.textContent = '📋 ' + session.date + ' — ' + session.day;

  var body = document.getElementById('session-modal-body');
  if(!body) return;
  body.innerHTML = '';

  // Day type info
  var infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'font-size:.85rem;color:var(--muted);margin-bottom:14px';
  infoDiv.innerHTML = '<strong>' + session.date + '</strong> &nbsp;·&nbsp; ' + dayType;
  body.appendChild(infoDiv);

  // Group targets table
  var targHdr = document.createElement('p');
  targHdr.style.cssText = 'font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px';
  targHdr.textContent = 'Group Targets';
  body.appendChild(targHdr);

  var tbl = document.createElement('table');
  tbl.className = 'session-targets-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Group</th><th>Target Yards</th><th>Players</th></tr>';
  tbl.appendChild(thead);
  var tbody = document.createElement('tbody');
  [1,2,3,4].forEach(function(g) {
    var targets = GROUP_TARGETS[g];
    var yds = targets ? targets[dayKey] : '—';
    var members = PLAYERS.filter(function(p){ return p.group === g; });
    var tr = document.createElement('tr');
    var label = 'Group ' + g + (g === 1 ? ' ⚡' : '');
    tr.innerHTML = '<td><span class="group-badge' + (g===1?' g1':'') + '">' + label + '</span></td>'
      + '<td style="font-weight:700;color:var(--purple)">' + yds + ' yd</td>'
      + '<td style="font-size:.78rem;color:var(--muted)">' + members.map(function(p){return p.name;}).join(', ') + '</td>';
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  body.appendChild(tbl);

  // Log data display
  if(log) {
    var logSection = document.createElement('div');
    logSection.className = 'log-section';
    var lh = document.createElement('h4');
    lh.textContent = 'Workout Log';
    logSection.appendChild(lh);
    var statRow = document.createElement('div');
    statRow.className = 'log-stat-row';
    var stats = [
      {val: log.blocks || '—', lbl: 'Blocks'},
      {val: sessionRepsDisplay(log), lbl: 'Reps/Block'},
      {val: log.total_reps || '—', lbl: 'Total Reps'}
    ];
    stats.forEach(function(s) {
      var st = document.createElement('div'); st.className = 'log-stat';
      st.innerHTML = '<div class="ls-val">' + s.val + '</div><div class="ls-lbl">' + s.lbl + '</div>';
      statRow.appendChild(st);
    });
    logSection.appendChild(statRow);
    if(log.notes) {
      var noteP = document.createElement('p');
      noteP.style.cssText = 'font-size:.83rem;color:#444;line-height:1.5;margin-top:6px;background:#f5f0ff;padding:8px 10px;border-radius:6px';
      noteP.textContent = log.notes;
      logSection.appendChild(noteP);
    }
    if(log.logged_by) {
      var byP = document.createElement('p');
      byP.style.cssText = 'font-size:.72rem;color:var(--muted);margin-top:6px';
      byP.textContent = 'Logged by: ' + log.logged_by;
      logSection.appendChild(byP);
    }
    body.appendChild(logSection);
  }

  // Attendance grid
  var attHdr = document.createElement('p');
  attHdr.style.cssText = 'font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px';
  attHdr.textContent = 'Attendance';
  body.appendChild(attHdr);

  var attGrid = document.createElement('div');
  attGrid.className = 'attendance-grid';
  var attendance = (log && log.attendance) ? log.attendance : {};
  var sortedPlayers = PLAYERS.slice().sort(function(a,b) {
    var ga = a.group || 99, gb = b.group || 99;
    if(ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  });
  var currentGroup = null;
  sortedPlayers.forEach(function(p) {
    var g = p.group || 0;
    if(g !== currentGroup) {
      currentGroup = g;
      var hdr = document.createElement('div');
      hdr.className = 'att-group-hdr';
      hdr.textContent = g ? ('Group ' + g + (g===1?' ⚡':'')) : 'Untested';
      attGrid.appendChild(hdr);
    }
    var row = document.createElement('div');
    var entry = getAttEntry(attendance, p.name);
    var present = entry.present;
    row.className = 'att-row' + (present === true ? ' present' : present === false ? ' absent' : '');
    var nameSpan = document.createElement('span');
    nameSpan.className = 'att-name';
    nameSpan.textContent = p.name + (p.isGuest ? ' (guest)' : '');
    if(entry.groupOverride && entry.groupOverride !== p.group) {
      var badge = document.createElement('span'); badge.className = 'att-grp-badge';
      badge.textContent = 'G' + entry.groupOverride; nameSpan.appendChild(badge);
    }
    if(entry.note) {
      var noteSpan = document.createElement('span'); noteSpan.className = 'att-note-disp';
      noteSpan.textContent = entry.note; nameSpan.appendChild(noteSpan);
    }
    row.appendChild(nameSpan);
    var statusSpan = document.createElement('span');
    statusSpan.className = 'att-status';
    statusSpan.textContent = present === true ? '✓' : present === false ? '✗' : '—';
    row.appendChild(statusSpan);
    attGrid.appendChild(row);
  });
  body.appendChild(attGrid);

  // Edit button for admin/coach
  if(canEdit) {
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-primary';
    editBtn.style.marginTop = '10px';
    editBtn.textContent = '✏️ Edit Session';
    editBtn.setAttribute('data-sid', sessionId);
    editBtn.addEventListener('click', function() {
      renderSessionEditForm(this.getAttribute('data-sid'));
    });
    body.appendChild(editBtn);
  }
}

function renderSessionEditForm(sessionId) {
  var body = document.getElementById('session-modal-body');
  if(!body) return;
  var session = COND_SESSIONS.find(function(s){ return s.id === sessionId; });
  var log = sessionLogData[sessionId] || {};
  var isTue = session.day === 'Tuesday';
  var dayKey = isTue ? 'tue' : 'thu';
  var attendance = log.attendance || {};

  body.innerHTML = '';

  var formDiv = document.createElement('div');

  // Blocks input
  var blocksGroup = document.createElement('div'); blocksGroup.className = 'log-field';
  var blocksLabel = document.createElement('label'); blocksLabel.textContent = 'Blocks (sets)';
  var blocksInput = document.createElement('input'); blocksInput.type = 'number';
  blocksInput.id = 'edit-blocks'; blocksInput.min = '1'; blocksInput.max = '20';
  blocksInput.value = log.blocks || '';
  blocksGroup.appendChild(blocksLabel); blocksGroup.appendChild(blocksInput);
  formDiv.appendChild(blocksGroup);

  // Per-block reps (one input per block; each block can differ)
  var repsGroup = document.createElement('div'); repsGroup.className = 'log-field';
  var repsLabel = document.createElement('label'); repsLabel.textContent = 'Reps per Block (set each block individually)';
  var repsWrap = document.createElement('div'); repsWrap.id = 'edit-block-reps-wrap';
  repsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:4px';
  repsGroup.appendChild(repsLabel); repsGroup.appendChild(repsWrap);
  formDiv.appendChild(repsGroup);

  // Total reps (auto-calc display)
  var totalGroup = document.createElement('div'); totalGroup.className = 'log-field';
  var totalLabel = document.createElement('label'); totalLabel.textContent = 'Total Reps (auto-calculated)';
  var totalInput = document.createElement('input'); totalInput.type = 'number';
  totalInput.id = 'edit-total-reps'; totalInput.readOnly = true;
  totalInput.style.background = '#f5f5f5';
  totalGroup.appendChild(totalLabel); totalGroup.appendChild(totalInput);
  formDiv.appendChild(totalGroup);

  function recalcTotal() {
    var t = 0, any = false;
    repsWrap.querySelectorAll('input.block-rep-inp').forEach(function(inp){
      var v = parseInt(inp.value); if(!isNaN(v)){ t += v; any = true; }
    });
    totalInput.value = any ? t : '';
  }
  function buildRepInputs() {
    var n = parseInt(blocksInput.value) || 0;
    var cur = [];
    repsWrap.querySelectorAll('input.block-rep-inp').forEach(function(inp){ cur.push(inp.value); });
    repsWrap.innerHTML = '';
    var existing = sessionBlockReps(log);
    for(var i=0;i<n;i++){
      var cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:64px';
      var cl = document.createElement('label');
      cl.textContent = 'Block ' + (i+1);
      cl.style.cssText = 'font-size:.68rem;color:var(--muted);margin-bottom:2px';
      var ci = document.createElement('input'); ci.type = 'number'; ci.min = '0'; ci.max = '50';
      ci.className = 'block-rep-inp'; ci.style.cssText = 'width:100%;text-align:center';
      var val = (cur[i] !== undefined && cur[i] !== '') ? cur[i] : (existing[i] !== undefined ? existing[i] : '');
      ci.value = val;
      ci.addEventListener('input', recalcTotal);
      cell.appendChild(cl); cell.appendChild(ci); repsWrap.appendChild(cell);
    }
    recalcTotal();
  }
  blocksInput.addEventListener('input', buildRepInputs);
  if(!blocksInput.value){ var initN = sessionBlockReps(log).length; if(initN) blocksInput.value = initN; }
  buildRepInputs();

  // Notes
  var notesGroup = document.createElement('div'); notesGroup.className = 'log-field';
  var notesLabel = document.createElement('label'); notesLabel.textContent = 'Notes';
  var notesInput = document.createElement('textarea');
  notesInput.id = 'edit-notes'; notesInput.placeholder = 'e.g. Humid day, strong effort';
  notesInput.value = log.notes || '';
  notesGroup.appendChild(notesLabel); notesGroup.appendChild(notesInput);
  formDiv.appendChild(notesGroup);

  // Attendance checkboxes
  var attHdr = document.createElement('p');
  attHdr.style.cssText = 'font-weight:800;font-size:.82rem;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:14px 0 6px';
  attHdr.textContent = 'Attendance';
  formDiv.appendChild(attHdr);

  var attWrapper = document.createElement('div');
  attWrapper.className = 'admin-att-grid-ext';
  var sortedPlayers = PLAYERS.slice().sort(function(a,b) {
    var ga = a.group || 99, gb = b.group || 99;
    if(ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  });
  var lastGrp = null;
  sortedPlayers.forEach(function(p) {
    var g = p.group || 0;
    if(g !== lastGrp) {
      lastGrp = g;
      var ghdr = document.createElement('p');
      ghdr.style.cssText = 'font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:8px 0 2px';
      ghdr.textContent = g ? ('Group ' + g + (g===1?' ⚡':'')) : 'Untested';
      attWrapper.appendChild(ghdr);
    }
    var ent = getAttEntry(attendance, p.name);
    var item = document.createElement('div'); item.className = 'admin-att-item-ext';
    var cb = document.createElement('input'); cb.type = 'checkbox';
    cb.id = 'att-cb-' + p.name.replace(/\s/g,'_');
    cb.checked = ent.present === true;
    var lbl = document.createElement('label'); lbl.htmlFor = cb.id;
    lbl.textContent = p.name + (p.isGuest ? '*' : '');
    lbl.style.cssText = 'cursor:pointer;font-weight:600';
    var grpSel = document.createElement('select'); grpSel.className = 'att-grp-sel';
    grpSel.id = 'att-grp-' + p.name.replace(/\s/g,'_');
    grpSel.title = 'Group for this session';
    [['','— default'],['1','G1 ⚡'],['2','G2'],['3','G3'],['4','G4']].forEach(function(opt) {
      var o = document.createElement('option'); o.value = opt[0]; o.textContent = opt[1];
      if(ent.groupOverride && String(ent.groupOverride) === opt[0]) o.selected = true;
      grpSel.appendChild(o);
    });
    var noteInp = document.createElement('input'); noteInp.type = 'text';
    noteInp.className = 'att-note-inp';
    noteInp.id = 'att-note-' + p.name.replace(/\s/g,'_');
    noteInp.placeholder = 'e.g. 2@G2, 3@G1';
    noteInp.value = ent.note || '';
    item.appendChild(cb); item.appendChild(lbl); item.appendChild(grpSel); item.appendChild(noteInp);
    attWrapper.appendChild(item);
  });
  formDiv.appendChild(attWrapper);

  // Buttons row
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';

  var saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary';
  saveBtn.textContent = '💾 Save Log';
  saveBtn.addEventListener('click', function() {
    saveSessionLog(sessionId);
  });

  var cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-edit';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', function() {
    renderSessionModalContent(sessionId);
  });

  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  formDiv.appendChild(btnRow);
  body.appendChild(formDiv);
}

function saveSessionLog(sessionId) {
  var blocks = parseInt(document.getElementById('edit-blocks').value) || null;
  var blockReps = [];
  var brWrap = document.getElementById('edit-block-reps-wrap');
  if(brWrap){ brWrap.querySelectorAll('input.block-rep-inp').forEach(function(inp){ var v = parseInt(inp.value); blockReps.push(isNaN(v) ? 0 : v); }); }
  var total = blockReps.length ? blockReps.reduce(function(a,b){ return a + b; }, 0) : null;
  var notes = document.getElementById('edit-notes').value.trim();

  var attendance = {};
  PLAYERS.forEach(function(p) {
    var cb = document.getElementById('att-cb-' + p.name.replace(/\s/g,'_'));
    var gSel = document.getElementById('att-grp-' + p.name.replace(/\s/g,'_'));
    var nInp = document.getElementById('att-note-' + p.name.replace(/\s/g,'_'));
    if(cb) attendance[p.name] = {
      present: cb.checked,
      groupOverride: gSel && gSel.value ? parseInt(gSel.value) : null,
      note: nInp ? nInp.value.trim() : ''
    };
  });

  var logger = isAdminUnlocked() ? 'Admin' : coachName;
  var data = {
    completed: true,
    attendance: attendance,
    logged_by: logger,
    logged_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if(blocks !== null) data.blocks = blocks;
  if(blockReps.length){ data.block_reps = blockReps; data.reps_per_block = firebase.firestore.FieldValue.delete(); }
  if(total !== null) data.total_reps = total;
  if(notes) data.notes = notes;

  db.collection('session_log').doc(sessionId).set(data, {merge:true})
    .then(function() {
      showToast('Session log saved ✓');
      renderSessionModalContent(sessionId);
    })
    .catch(function(e) { showToast('Error: ' + e.message); });
}

// ===================== SUMMER OVERVIEW =====================
function renderSummerOverview() {
  var container = document.getElementById('summer-overview-content');
  if(!container) return;
  container.innerHTML = '';

  var completedCount = COND_SESSIONS.filter(function(s) {
    return sessionLogData[s.id] && sessionLogData[s.id].completed;
  }).length;
  var total = COND_SESSIONS.length;

  // Progress bar
  var pbWrap = document.createElement('div'); pbWrap.className = 'progress-bar-wrap';
  var pbLabel = document.createElement('div'); pbLabel.className = 'progress-bar-label';
  var pbText = document.createElement('span');
  pbText.innerHTML = 'Sessions Completed: <strong>' + completedCount + ' / ' + total + '</strong>';
  var pbPct = document.createElement('span');
  pbPct.style.cssText = 'font-size:.82rem;color:var(--muted)';
  pbPct.textContent = Math.round(completedCount/total*100) + '%';
  pbLabel.appendChild(pbText); pbLabel.appendChild(pbPct);
  var pbOuter = document.createElement('div'); pbOuter.className = 'progress-bar-outer';
  var pbInner = document.createElement('div'); pbInner.className = 'progress-bar-inner';
  pbInner.style.width = Math.round(completedCount/total*100) + '%';
  pbOuter.appendChild(pbInner);
  pbWrap.appendChild(pbLabel); pbWrap.appendChild(pbOuter);
  container.appendChild(pbWrap);

  // Group chips
  var chipsRow = document.createElement('div'); chipsRow.className = 'group-chips-row';
  [4,1,2,3].forEach(function(g) {
    var members = PLAYERS.filter(function(p){ return p.group === g; });
    if(!members.length) return;
    var targets = GROUP_TARGETS[g];
    var chip = document.createElement('div');
    chip.className = 'group-chip' + (g===1?' g1':'');
    var titleDiv = document.createElement('div'); titleDiv.className = 'gc-title';
    titleDiv.innerHTML = 'Group ' + g + (g===1?' ⚡':'') + ' <span style="font-size:.72rem;font-weight:600;color:var(--muted)">' + members.length + ' players</span>';
    var subDiv = document.createElement('div'); subDiv.className = 'gc-sub';
    subDiv.textContent = targets.tue + 'yd Tue · ' + targets.thu + 'yd Thu';
    chip.appendChild(titleDiv); chip.appendChild(subDiv);
    chipsRow.appendChild(chip);
  });
  // Untested chip
  var untested = PLAYERS.filter(function(p){ return !p.group; });
  if(untested.length) {
    var chip = document.createElement('div'); chip.className = 'group-chip';
    var titleDiv = document.createElement('div'); titleDiv.className = 'gc-title';
    titleDiv.textContent = 'Untested — ' + untested.length + ' players';
    chip.appendChild(titleDiv);
    chipsRow.appendChild(chip);
  }
  container.appendChild(chipsRow);

  // Session details + attendance table
  var tableWrap = document.createElement('div'); tableWrap.className = 'attendance-table-wrap';
  var tbl = document.createElement('table'); tbl.className = 'att-overview-table';

  // ── THEAD: Week header row + session date row ──
  var thead = document.createElement('thead');
  var weekRow = document.createElement('tr'); weekRow.className = 'week-hdr-row';
  var thBlank = document.createElement('th'); thBlank.className = 'name-col'; thBlank.textContent = '';
  weekRow.appendChild(thBlank);
  for(var w=0; w<8; w++) {
    var thW = document.createElement('th'); thW.colSpan = 2;
    thW.textContent = 'Week ' + (w+1);
    if(w>0) thW.className = 'week-sep';
    weekRow.appendChild(thW);
  }
  thead.appendChild(weekRow);

  var hrow = document.createElement('tr');
  var th0 = document.createElement('th'); th0.className = 'name-col'; th0.textContent = 'Player';
  hrow.appendChild(th0);
  COND_SESSIONS.forEach(function(s, idx) {
    var th = document.createElement('th');
    th.textContent = s.date.split(', ')[0];
    th.title = s.date + ' · ' + s.day + (s.day==='Tuesday' ? ' (2-min run)' : ' (1-min run)');
    if(idx % 2 === 0 && idx > 0) th.className = 'week-sep';
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  tbl.appendChild(thead);

  // ── TBODY 1: Workout stats ──
  var statBody = document.createElement('tbody');

  // Day type row
  var dayRow = document.createElement('tr'); dayRow.className = 'day-type-row';
  var dayLbl = document.createElement('td'); dayLbl.className = 'name-col'; dayLbl.textContent = 'Day Type';
  dayRow.appendChild(dayLbl);
  COND_SESSIONS.forEach(function(s, idx) {
    var td = document.createElement('td');
    td.textContent = s.day === 'Tuesday' ? 'Tue · 2 min' : 'Thu · 1 min';
    if(idx % 2 === 0 && idx > 0) td.className = 'week-sep';
    dayRow.appendChild(td);
  });
  statBody.appendChild(dayRow);

  // Blocks row
  var blkRow = document.createElement('tr'); blkRow.className = 'stat-row';
  var blkLbl = document.createElement('td'); blkLbl.className = 'name-col'; blkLbl.textContent = 'Blocks';
  blkRow.appendChild(blkLbl);
  COND_SESSIONS.forEach(function(s, idx) {
    var log = sessionLogData[s.id];
    var td = document.createElement('td');
    td.className = (idx % 2 === 0 && idx > 0 ? 'week-sep ' : '') + (log && log.blocks ? 'logged' : 'unlogged');
    td.textContent = (log && log.blocks) ? log.blocks : '—';
    blkRow.appendChild(td);
  });
  statBody.appendChild(blkRow);

  // Reps/block row
  var repRow = document.createElement('tr'); repRow.className = 'stat-row';
  var repLbl = document.createElement('td'); repLbl.className = 'name-col'; repLbl.textContent = 'Reps / Block';
  repRow.appendChild(repLbl);
  COND_SESSIONS.forEach(function(s, idx) {
    var log = sessionLogData[s.id];
    var rb = log ? sessionBlockReps(log) : [];
    var td = document.createElement('td');
    td.className = (idx % 2 === 0 && idx > 0 ? 'week-sep ' : '') + (rb.length ? 'logged' : 'unlogged');
    td.textContent = rb.length ? sessionRepsDisplay(log) : '—';
    repRow.appendChild(td);
  });
  statBody.appendChild(repRow);

  // Total reps row
  var totRow = document.createElement('tr'); totRow.className = 'stat-row';
  var totLbl = document.createElement('td'); totLbl.className = 'name-col'; totLbl.textContent = 'Total Reps';
  totRow.appendChild(totLbl);
  COND_SESSIONS.forEach(function(s, idx) {
    var log = sessionLogData[s.id];
    var rbT = log ? sessionBlockReps(log) : [];
    var total = log ? (log.total_reps || (rbT.length ? rbT.reduce(function(a,b){return a+b;},0) : null)) : null;
    var td = document.createElement('td');
    td.className = (idx % 2 === 0 && idx > 0 ? 'week-sep ' : '') + (total ? 'logged' : 'unlogged');
    td.textContent = total ? total : '—';
    totRow.appendChild(td);
  });
  statBody.appendChild(totRow);

  // Divider
  var div1 = document.createElement('tr'); div1.className = 'stat-divider';
  var div1td = document.createElement('td'); div1td.colSpan = COND_SESSIONS.length + 1;
  div1.appendChild(div1td); statBody.appendChild(div1);

  // Yards rows per group (G1–G4, skip groups with no members)
  var grpColorClass = {1:'yards-g1',2:'yards-g2',3:'yards-g3',4:'yards-g4'};
  [1,2,3,4].forEach(function(g) {
    if(!PLAYERS.some(function(p){ return p.group===g; })) return;
    var targets = GROUP_TARGETS[g];
    var yRow = document.createElement('tr'); yRow.className = 'yards-row ' + grpColorClass[g];
    var yLbl = document.createElement('td'); yLbl.className = 'name-col';
    yLbl.textContent = 'G' + g + (g===1?' ⚡':'') + ' Yards';
    yRow.appendChild(yLbl);
    COND_SESSIONS.forEach(function(s, idx) {
      var yards = s.day === 'Tuesday' ? targets.tue : targets.thu;
      var td = document.createElement('td');
      td.textContent = yards + 'yd';
      td.title = 'Group ' + g + ' · ' + (s.day==='Tuesday' ? '2-min run' : '1-min run');
      if(idx % 2 === 0 && idx > 0) td.classList.add('week-sep');
      yRow.appendChild(td);
    });
    statBody.appendChild(yRow);
  });

  tbl.appendChild(statBody);

  // Bold separator between stats and attendance
  var sepBody = document.createElement('tbody');
  var sepRow = document.createElement('tr');
  var sepTd = document.createElement('td'); sepTd.colSpan = COND_SESSIONS.length + 1;
  sepTd.style.cssText = 'height:6px;background:var(--black);padding:0';
  sepRow.appendChild(sepTd); sepBody.appendChild(sepRow);
  tbl.appendChild(sepBody);

  // ── TBODY 2: Player attendance ──
  var tbody = document.createElement('tbody');
  var sortedByGroup = PLAYERS.slice().sort(function(a,b) {
    var ga = a.group || 99, gb = b.group || 99;
    if(ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  });
  var lastGroup = null;
  sortedByGroup.forEach(function(p) {
    var g = p.group || 0;
    if(g !== lastGroup) {
      lastGroup = g;
      var hdrRow = document.createElement('tr'); hdrRow.className = 'group-row-hdr';
      var hdrTd = document.createElement('td'); hdrTd.colSpan = COND_SESSIONS.length + 1;
      hdrTd.textContent = g ? ('Group ' + g + (g===1?' ⚡':'')) : 'Untested';
      hdrRow.appendChild(hdrTd);
      tbody.appendChild(hdrRow);
    }
    var row = document.createElement('tr');
    var nameTd = document.createElement('td'); nameTd.className = 'name-col';
    nameTd.textContent = p.name + (p.isGuest ? '*' : '');
    row.appendChild(nameTd);
    COND_SESSIONS.forEach(function(s, idx) {
      var td = document.createElement('td');
      if(idx % 2 === 0 && idx > 0) td.classList.add('week-sep');
      var log = sessionLogData[s.id];
      if(log && log.attendance && log.attendance[p.name] !== undefined) {
        var ent2 = getAttEntry(log.attendance, p.name);
        var present = ent2.present;
        td.classList.add(present ? 'att-cell-yes' : 'att-cell-no');
        td.textContent = present ? '✓' : '✗';
        if(ent2.note) td.title = ent2.note;
        else if(ent2.groupOverride && ent2.groupOverride !== p.group) td.title = 'G' + ent2.groupOverride + ' this session';
      } else {
        td.classList.add('att-cell-blank');
        td.textContent = '—';
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  tbl.appendChild(tbody);
  tableWrap.appendChild(tbl);
  container.appendChild(tableWrap);
}

// ===================== LISTENERS =====================
function startListeners() {
  ['fall','winter','spring','summer27'].forEach(season => {
    db.collection(getSeasonCollection(season)).onSnapshot(snap => {
      const v={}, n={};
      snap.forEach(doc=>{ v[doc.id]=doc.data().votes||{}; n[doc.id]=doc.data().notes||{}; });
      if(season==='fall'){allVotesFall=v;allNotesFall=n;}
      else if(season==='winter'){allVotesWinter=v;allNotesWinter=n;}
      else if(season==='spring'){allVotesSpring=v;allNotesSpring=n;}
      else{allVotesSummer27=v;allNotesSummer27=n;}
      initSeasonCredits(season);
      if(activeSeason===season){ renderSeasonGrid(season); updateCreditDisplay(); }
      if(document.getElementById('admin-panel')&&document.getElementById('admin-panel').style.display!=='none') renderVoteTally();
    });
  });
  db.collection('cancellations').onSnapshot(snap => {
    canceledEvents = {};
    snap.forEach(d => { canceledEvents[d.id] = true; });
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof renderAdminSchedule === 'function' && document.getElementById('admin-schedule-list')) renderAdminSchedule();
    if (typeof renderCondGrid === 'function') renderCondGrid();
    if (typeof renderCamps === 'function') renderCamps();
    if (typeof gtRerender === 'function') gtRerender();
  });
  db.collection('schedule').onSnapshot(snap => {
    scheduleItems=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderSchedule();
    if(document.getElementById('admin-panel')&&document.getElementById('admin-panel').style.display!=='none') renderAdminSchedule();
  });
  db.collection('venues').onSnapshot(snap => {
    venueItems=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderVenueDatalist==='function') renderVenueDatalist();
    if(document.getElementById('admin-panel')&&document.getElementById('admin-panel').style.display!=='none') renderVenuesAdmin();
  });
  db.collection('discussions').onSnapshot(snap => {
    discussionItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (typeof renderDiscussions === 'function') renderDiscussions();
  });
  db.collection('discussion_comments').onSnapshot(snap => {
    discussionComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (typeof renderDiscussions === 'function') renderDiscussions();
  });
  db.collection('ann_comments').onSnapshot(snap => {
    annComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (typeof renderAnnouncements === 'function') renderAnnouncements();
  });
  db.collection('announcements').onSnapshot(snap => {
    announcementItems=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAnnouncements();
    if(document.getElementById('admin-panel')&&document.getElementById('admin-panel').style.display!=='none') renderAdminAnnouncements();
  });
  db.collection('session_log').onSnapshot(function(snap) {
    sessionLogData = {};
    snap.forEach(function(doc) { sessionLogData[doc.id] = doc.data(); });
    renderSummerOverview();
    renderCondGrid();
    if(openSessionId) renderSessionModalContent(openSessionId);
    var adminPanel = document.getElementById('admin-panel');
    if(adminPanel && adminPanel.style.display !== 'none') {
      var tabSessions = document.getElementById('tab-sessions');
      if(tabSessions && tabSessions.classList.contains('active')) renderAdminSessions();
    }
  });
  db.collection('players').onSnapshot(function(snap) {
    snap.forEach(function(doc) {
      var p = PLAYERS.find(function(x){ return x.name === doc.id; });
      if(p) Object.assign(p, doc.data());
    });
    renderSummerOverview();
    var adminPanel = document.getElementById('admin-panel');
    if(adminPanel && adminPanel.style.display !== 'none') {
      var tabPlayers = document.getElementById('tab-players');
      if(tabPlayers && tabPlayers.classList.contains('active')) renderAdminPlayers();
    }
  });
}

