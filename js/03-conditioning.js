// ===================== SUMMER CONDITIONING =====================
const COND_SESSIONS = [
  {id:'2026-06-09',day:'Tuesday',date:'Jun 9, 2026'},
  {id:'2026-06-11',day:'Thursday',date:'Jun 11, 2026'},
  {id:'2026-06-16',day:'Tuesday',date:'Jun 16, 2026'},
  {id:'2026-06-18',day:'Thursday',date:'Jun 18, 2026'},
  {id:'2026-06-23',day:'Tuesday',date:'Jun 23, 2026'},
  {id:'2026-06-25',day:'Thursday',date:'Jun 25, 2026'},
  {id:'2026-06-30',day:'Tuesday',date:'Jun 30, 2026'},
  {id:'2026-07-02',day:'Thursday',date:'Jul 2, 2026'},
  {id:'2026-07-07',day:'Tuesday',date:'Jul 7, 2026'},
  {id:'2026-07-09',day:'Thursday',date:'Jul 9, 2026'},
  {id:'2026-07-14',day:'Tuesday',date:'Jul 14, 2026'},
  {id:'2026-07-16',day:'Thursday',date:'Jul 16, 2026'},
  {id:'2026-07-21',day:'Tuesday',date:'Jul 21, 2026'},
  {id:'2026-07-23',day:'Thursday',date:'Jul 23, 2026'},
  {id:'2026-07-28',day:'Tuesday',date:'Jul 28, 2026'},
  {id:'2026-07-30',day:'Thursday',date:'Jul 30, 2026'}
];
let condData = {}; // id -> [names]

function getCondName() {
  return getVoterName() || localStorage.getItem('f6ad_cond_name') || '';
}
function setCondName() {
  var n = document.getElementById('cond-name-input').value.trim();
  if(!n){showToast('Please enter your name.'); return;}
  localStorage.setItem('f6ad_cond_name', n);
  if(!getVoterName()) saveVoterName(n);
  renderCondNameRow();
  renderCondGrid();
  renderCampGrid();
}
function renderCondNameRow() {
  var name = getCondName();
  var display = document.getElementById('cond-voter-display');
  var wrap = document.getElementById('cond-name-input-wrap');
  if(name) {
    if(display) display.textContent = name;
    if(wrap) wrap.style.display = 'none';
  } else {
    if(display) display.textContent = '';
    if(wrap) wrap.style.display = '';
  }
}
function startCondListeners() {
  db.collection('conditioning').onSnapshot(snap => {
    condData = {};
    snap.forEach(doc => { condData[doc.id] = doc.data().attendees || []; });
    renderCondGrid();
    renderCampGrid();
    if(document.getElementById('tab-camps')&&document.getElementById('tab-camps').classList.contains('active')) renderAdminCamps();
  });
}
function toggleCondArchive() {
  showPastCondSessions = !showPastCondSessions;
  renderCondGrid();
}

function renderCondGrid() {
  var grid = document.getElementById('cond-grid');
  if(!grid) return;
  var myName = getCondName();
  grid.innerHTML = '';

  var today = new Date(); today.setHours(0,0,0,0);
  var past    = COND_SESSIONS.filter(function(s){ return new Date(s.id + 'T00:00:00') < today; });
  var upcoming = COND_SESSIONS.filter(function(s){ return new Date(s.id + 'T00:00:00') >= today; });

  // Past sessions toggle at top (only if there are past sessions)
  if(past.length) {
    var toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'grid-column:1/-1;margin-bottom:10px;border-bottom:2px dashed var(--border);padding-bottom:12px';

    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'schedule-archive-toggle';
    toggleBtn.onclick = toggleCondArchive;
    var chevron = document.createElement('span');
    chevron.className = 'archive-chevron' + (showPastCondSessions ? ' open' : '');
    chevron.textContent = '▼';
    var label = document.createElement('span');
    label.textContent = showPastCondSessions
      ? 'Hide Past Sessions (' + past.length + ')'
      : 'Show Past Sessions (' + past.length + ')';
    toggleBtn.appendChild(chevron);
    toggleBtn.appendChild(document.createTextNode(' '));
    toggleBtn.appendChild(label);
    toggleRow.appendChild(toggleBtn);

    if(showPastCondSessions) {
      var pastGrid = document.createElement('div');
      pastGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:12px;opacity:.65';
      past.forEach(function(s) { pastGrid.appendChild(makeCondCard(s, myName, true)); });
      toggleRow.appendChild(pastGrid);
    }
    grid.appendChild(toggleRow);
  }

  // Upcoming sessions
  upcoming.forEach(function(s) {
    var attendees = condData[s.id] || [];
    var isMine = myName && attendees.indexOf(myName) !== -1;
    var log = sessionLogData[s.id];
    var isLogged = log && log.completed;

    var card = document.createElement('div');
    card.className = 'cond-card' + (isMine ? ' signed-up' : '');

    var dayDiv = document.createElement('div'); dayDiv.className = 'cond-day'; dayDiv.textContent = s.day;
    var dateDiv = document.createElement('div'); dateDiv.className = 'cond-date'; dateDiv.textContent = s.date;
    var timeDiv = document.createElement('div'); timeDiv.className = 'cond-time';
    timeDiv.innerHTML = '5:00 – 6:00 PM  ·  GA';
    card.appendChild(dayDiv); card.appendChild(dateDiv); card.appendChild(timeDiv);

    if(isLogged) {
      var badge = document.createElement('span'); badge.className = 'session-logged-badge';
      badge.textContent = '✅ Logged';
      card.appendChild(badge);
    }

    var countDiv = document.createElement('div'); countDiv.className = 'cond-count';
    countDiv.textContent = attendees.length > 0
      ? attendees.length + ' player' + (attendees.length !== 1 ? 's' : '')
      : 'Be the first!';
    card.appendChild(countDiv);

    var attsDiv = document.createElement('div'); attsDiv.className = 'cond-attendees';
    if(attendees.length) {
      attendees.forEach(function(n) {
        var mine = myName && n === myName;
        var chip = document.createElement('span');
        chip.className = 'cond-attendee-chip' + (mine ? ' mine' : '');
        chip.textContent = n;
        if(mine) {
          var rmBtn = document.createElement('button');
          rmBtn.title = 'Remove me'; rmBtn.textContent = '✕';
          rmBtn.setAttribute('data-sid', s.id); rmBtn.setAttribute('data-n', n);
          rmBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            condLeave(this.getAttribute('data-sid'), this.getAttribute('data-n'));
          });
          chip.appendChild(rmBtn);
        }
        attsDiv.appendChild(chip);
      });
    } else {
      attsDiv.innerHTML = '<span style="color:#aaa;font-style:italic">No sign-ups yet</span>';
    }
    card.appendChild(attsDiv);

    if(myName) {
      var signBtn = document.createElement('button');
      signBtn.className = 'cond-signup-btn ' + (isMine ? 'leave' : 'join');
      signBtn.textContent = isMine ? '✓ I\'m Out' : '+ I\'m In';
      signBtn.setAttribute('data-sid', s.id); signBtn.setAttribute('data-n', myName);
      signBtn.setAttribute('data-mine', isMine ? '1' : '0');
      signBtn.addEventListener('click', function() {
        if(this.getAttribute('data-mine') === '1') condLeave(this.getAttribute('data-sid'), this.getAttribute('data-n'));
        else condJoin(this.getAttribute('data-sid'), this.getAttribute('data-n'));
      });
      card.appendChild(signBtn);
    } else {
      var noNameDiv = document.createElement('div');
      noNameDiv.style.cssText = 'font-size:.72rem;color:#aaa;font-style:italic;text-align:center';
      noNameDiv.textContent = 'Set your name above to sign up';
      card.appendChild(noNameDiv);
    }

    var detBtn = document.createElement('button');
    detBtn.className = 'btn-details';
    detBtn.textContent = '📋 Details';
    detBtn.setAttribute('data-sid', s.id);
    detBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openSessionDetail(this.getAttribute('data-sid'));
    });
    card.appendChild(detBtn);

    grid.appendChild(card);
  });

}

function makeCondCard(s, myName, isPast) {
  var attendees = condData[s.id] || [];
  var isMine = myName && attendees.indexOf(myName) !== -1;
  var log = sessionLogData[s.id];
  var isLogged = log && log.completed;

  var card = document.createElement('div');
  card.className = 'cond-card' + (isMine ? ' signed-up' : '');
  if(isPast) card.style.cssText = 'pointer-events:none;filter:grayscale(.3)';

  var dayDiv = document.createElement('div'); dayDiv.className = 'cond-day'; dayDiv.textContent = s.day;
  var dateDiv = document.createElement('div'); dateDiv.className = 'cond-date'; dateDiv.textContent = s.date;
  var timeDiv = document.createElement('div'); timeDiv.className = 'cond-time';
  timeDiv.innerHTML = '5:00 – 6:00 PM  ·  GA';
  card.appendChild(dayDiv); card.appendChild(dateDiv); card.appendChild(timeDiv);

  if(isLogged) {
    var badge = document.createElement('span'); badge.className = 'session-logged-badge';
    badge.textContent = '✅ Logged';
    card.appendChild(badge);
  }

  var countDiv = document.createElement('div'); countDiv.className = 'cond-count';
  countDiv.textContent = attendees.length > 0
    ? attendees.length + ' player' + (attendees.length !== 1 ? 's' : '')
    : 'No sign-ups';
  card.appendChild(countDiv);

  var attsDiv = document.createElement('div'); attsDiv.className = 'cond-attendees';
  if(attendees.length) {
    attendees.forEach(function(n) {
      var chip = document.createElement('span');
      chip.className = 'cond-attendee-chip' + (myName && n === myName ? ' mine' : '');
      chip.textContent = n;
      attsDiv.appendChild(chip);
    });
  } else {
    attsDiv.innerHTML = '<span style="color:#aaa;font-style:italic">No sign-ups</span>';
  }
  card.appendChild(attsDiv);

  if(!isPast) {
    // Sign-up / leave controls
    if(myName) {
      var signBtn = document.createElement('button');
      signBtn.className = 'cond-signup-btn ' + (isMine ? 'leave' : 'join');
      signBtn.textContent = isMine ? "✓ I'm Out" : "+ I'm In";
      signBtn.setAttribute('data-sid', s.id); signBtn.setAttribute('data-n', myName);
      signBtn.setAttribute('data-mine', isMine ? '1' : '0');
      signBtn.addEventListener('click', function() {
        if(this.getAttribute('data-mine') === '1') condLeave(this.getAttribute('data-sid'), this.getAttribute('data-n'));
        else condJoin(this.getAttribute('data-sid'), this.getAttribute('data-n'));
      });
      // Also add remove button on chips for this player
      attsDiv.querySelectorAll && attsDiv.querySelectorAll('.cond-attendee-chip.mine').forEach(function(chip){
        if(!chip.querySelector('button')) {
          var rmBtn = document.createElement('button');
          rmBtn.title = 'Remove me'; rmBtn.textContent = '✕';
          rmBtn.setAttribute('data-sid', s.id); rmBtn.setAttribute('data-n', myName);
          rmBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            condLeave(this.getAttribute('data-sid'), this.getAttribute('data-n'));
          });
          chip.appendChild(rmBtn);
        }
      });
      card.appendChild(signBtn);
    } else {
      var noNameDiv = document.createElement('div');
      noNameDiv.style.cssText = 'font-size:.72rem;color:#aaa;font-style:italic;text-align:center';
      noNameDiv.textContent = 'Set your name above to sign up';
      card.appendChild(noNameDiv);
    }
  }
  var detBtn = document.createElement('button');
  detBtn.className = 'btn-details';
  if(isPast) detBtn.style.cssText = 'pointer-events:auto;filter:none';
  detBtn.textContent = '📋 Details';
  detBtn.setAttribute('data-sid', s.id);
  detBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    openSessionDetail(this.getAttribute('data-sid'));
  });
  card.appendChild(detBtn);
  return card;
}

function condJoin(sessionId, name) {
  if(!name){showToast('Set your name first.'); return;}
  db.collection('conditioning').doc(sessionId).set(
    {attendees: firebase.firestore.FieldValue.arrayUnion(name)},
    {merge: true}
  ).then(function(){showToast('Signed up for '+sessionId.slice(5)+' ✓');})
  .catch(function(e){showToast('Error: '+e.message);});
}
function condLeave(sessionId, name) {
  if(!name) return;
  db.collection('conditioning').doc(sessionId).set(
    {attendees: firebase.firestore.FieldValue.arrayRemove(name)},
    {merge: true}
  ).then(function(){showToast('Removed from '+sessionId.slice(5));})
  .catch(function(e){showToast('Error: '+e.message);});
}

// ===================== MINI CAMPS =====================
const MINI_CAMPS = [
  {
    id:'minicamp-jul14',
    start:'2026-07-14',
    name:'Mini Camp 1',
    dates:'July 14 & 15, 2026',
    days:'Tuesday & Wednesday',
    time:'6:00 – 8:30 PM',
    location:'GA Field 11',
    note:'2-day camp · Bring water & cleats'
  },
  {
    id:'minicamp-jul30',
    start:'2026-07-30',
    name:'Mini Camp 2',
    dates:'July 30 & 31, 2026',
    days:'Thursday & Friday',
    time:'6:00 – 8:00 PM',
    location:'GA Field 1 (Sisters)',
    note:'2-day camp · Bring water & cleats'
  }
];

function renderCampGrid() {
  var grid = document.getElementById('camp-grid');
  if(!grid) return;
  var myName = getCondName();
  grid.innerHTML = MINI_CAMPS.map(function(camp) {
    var attendees = condData[camp.id] || [];
    var isMine = myName && attendees.indexOf(myName) !== -1;
    var chipsHtml = attendees.map(function(n) {
      var mine = myName && n === myName;
      return '<span class="cond-attendee-chip' + (mine?' mine':'') + '">'
        + n
        + (mine ? ' <button onclick="condLeave(\''+camp.id+'\',\''+n.replace(/\'/g,'')+'\')" title="Remove me">✕</button>' : '')
        + '</span>';
    }).join('');
    return '<div class="cond-camp-card">'
      + '<span class="cond-camp-badge">Mini Camp</span>'
      + '<div class="cond-camp-name">'+camp.name+'</div>'
      + '<div class="cond-camp-dates">📅 '+camp.dates+'</div>'
      + '<div class="cond-camp-details">'
        + '🕕 '+camp.time+'<br>'
        + '📍 Germantown Academy &mdash; '+camp.location+'<br>'
        + '📋 '+camp.note
      + '</div>'
      + '<div class="cond-camp-count">'+(attendees.length > 0 ? attendees.length+' player'+(attendees.length!==1?'s':'')+ ' signed up' : 'No sign-ups yet — be first!')+'</div>'
      + '<div class="cond-camp-attendees">'+(chipsHtml||'<span style="color:#aaa;font-style:italic;font-size:.75rem">None yet</span>')+'</div>'
      + (myName
          ? '<button class="cond-signup-btn '+(isMine?'leave':'join')+'" onclick="cond'+(isMine?'Leave':'Join')+'(\''+camp.id+'\',\''+myName.replace(/\'/g,'')+'\')">'
            + (isMine ? '✓ Remove Me' : '+ Sign Me Up')
            + '</button>'
          : '<div style="font-size:.72rem;color:#aaa;font-style:italic;text-align:center;padding:6px 0">Set your name above to sign up</div>')
      + '</div>';
  }).join('');
}

// ===================== PLAYER ROSTER =====================
const PLAYERS = [
  {name:'John',   testTime:'5:32', testSecs:332, group:1},
  {name:'Liam',   testTime:'5:35', testSecs:335, group:1},
  {name:'Tucker', testTime:'5:40', testSecs:340, group:1},
  {name:'Cullen', testTime:'5:54', testSecs:354, group:1},
  {name:'Grayson',testTime:'6:00', testSecs:360, group:2},
  {name:'Oliver', testTime:'6:03', testSecs:363, group:2, isGuest:true},
  {name:'Miles',  testTime:'6:18', testSecs:378, group:2},
  {name:'Tyler',  testTime:'6:33', testSecs:393, group:3},
  {name:'Dylan',  testTime:null, testSecs:null, group:null},
  {name:'Nathan', testTime:null, testSecs:null, group:null},
  {name:'Evan',   testTime:null, testSecs:null, group:null},
  {name:'Mithul', testTime:null, testSecs:null, group:null},
  {name:'Riley',  testTime:null, testSecs:null, group:null},
  {name:'Wesley', testTime:null, testSecs:null, group:null},
  {name:'Pedro',  testTime:null, testSecs:null, group:null},
  {name:'Gavin',  testTime:null, testSecs:null, group:null},
  {name:'Mason',  testTime:null, testSecs:null, group:null},
  {name:'Kullen', testTime:null, testSecs:null, group:null},
  {name:'Connor', testTime:null, testSecs:null, group:null},
  {name:'Elijah', testTime:null, testSecs:null, group:null},
  {name:'Lance',  testTime:null, testSecs:null, group:null},
  {name:'Ishy',   testTime:null, testSecs:null, group:null}
];

// G1 = fastest, G4 = slowest
const GROUP_TARGETS = {
  1: {tue:550, thu:260},
  2: {tue:510, thu:242},
  3: {tue:475, thu:225},
  4: {tue:440, thu:210}
};

// ─── Global vars for new features ───
let sessionLogData = {};
let playerGroupEditMode = false;
let openSessionId = null;

// ─── Attendance entry helper (backward-compat: old format=bool, new=object) ───
function getAttEntry(att, name) {
  if(!att || att[name] === undefined || att[name] === null) return {present:undefined, groupOverride:null, note:''};
  var v = att[name];
  if(typeof v === 'boolean') return {present:v, groupOverride:null, note:''};
  return {present:!!v.present, groupOverride:v.groupOverride||null, note:v.note||''};
}
function effectiveGroup(player, sessionId) {
  var log = sessionLogData[sessionId];
  if(log && log.attendance) {
    var entry = getAttEntry(log.attendance, player.name);
    if(entry.groupOverride) return entry.groupOverride;
  }
  return player.group;
}

// ===================== COACH LOGIN (Firebase Auth) =====================
function coachLogin() {
  var email = (document.getElementById('coach-email-input') || { value: '' }).value.trim();
  var pw = (document.getElementById('coach-pin-input') || { value: '' }).value;
  authSignIn(email, pw);
}
function coachSignOut() {
  authSignOut();
  if(openSessionId) renderSessionModalContent(openSessionId);
}
function renderCoachBar() {
  var loginBar = document.getElementById('coach-login-bar');
  var activeBar = document.getElementById('coach-active-bar');
  var activeName = document.getElementById('coach-active-name');
  var pinInput = document.getElementById('coach-pin-input');
  if(coachName) {
    if(loginBar) loginBar.style.display = 'none';
    if(activeBar) activeBar.style.display = 'flex';
    if(activeName) activeName.textContent = 'Coaching as: ' + coachName;
    if(pinInput) pinInput.value = '';
  } else {
    if(loginBar) loginBar.style.display = 'flex';
    if(activeBar) activeBar.style.display = 'none';
  }
}

