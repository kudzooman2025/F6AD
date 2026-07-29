// ---- FC Delco conflict detection ----
function parseDateRange(str) {
  var m = String(str || '').match(/([A-Z][a-z]{2})\s*(\d{1,2})\s*(?:[-\u2013]\s*(\d{1,2}))?,?\s*(\d{4})/);
  if (!m) return null;
  var months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  var mo = months[m[1]];
  if (mo === undefined) return null;
  var y = parseInt(m[4], 10), d1 = parseInt(m[2], 10), d2 = m[3] ? parseInt(m[3], 10) : d1;
  return { s: new Date(y, mo, d1, 0, 0, 0), e: new Date(y, mo, d2, 23, 59, 59) };
}
function fcDelcoConflict(t) {
  if (!t || t.club === 'FC Delco' || typeof FC_DELCO_EVENTS === 'undefined') return null;
  var r = parseDateRange(t.dates);
  if (!r) return null;
  for (var i = 0; i < FC_DELCO_EVENTS.length; i++) {
    var fe = FC_DELCO_EVENTS[i];
    var fs = new Date(fe.start + 'T00:00:00'), feEnd = new Date(fe.end + 'T23:59:59');
    if (r.s <= feEnd && r.e >= fs) return fe;
  }
  return null;
}
function fcConflictBanner(t) {
  var c = fcDelcoConflict(t);
  return c ? '<div class="t-conflict">\u26a0\ufe0f Conflict with FC Delco scheduled event \u2014 ' + c.name + ' (' + c.dates + ')</div>' : '';
}
function fcConflictClass(t) { return fcDelcoConflict(t) ? ' conflict' : ''; }

// ===================== VOTER =====================
function setVoter() {
  const n=document.getElementById('voter-name-input').value.trim();
  if(!n){showToast('Please enter your name.'); return;}
  saveVoterName(n);
  ['fall','winter','spring','summer27'].forEach(s=>initSeasonCredits(s));
  renderVoterBar();
  if(activeSeason!=='summer') renderSeasonGrid(activeSeason);
  updateCreditDisplay();
}
function changeVoter() {
  saveVoterName('');
  renderVoterBar();
  if(activeSeason!=='summer') renderSeasonGrid(activeSeason);
  updateCreditDisplay();
}
function renderVoterBar() {
  const name=getVoterName();
  document.getElementById('voter-setup').style.display=name?'none':'flex';
  document.getElementById('voter-active').style.display=name?'flex':'none';
  if(name) document.getElementById('voter-display-name').textContent=name;
  const cr=document.getElementById('credits-remaining-display');
  const sh=document.querySelector('.btn-share');
  const isVoting=(activeSeason!=='summer');
  var soBtn=document.getElementById('btn-signout'); if(soBtn) soBtn.style.display=name?'block':'none';
  if(cr) cr.style.display=(name&&isVoting)?'':'none';
  if(sh) sh.style.display=(name&&isVoting)?'':'none';
}

// ===================== SEASON SWITCHING =====================
function switchSeason(season, btn) {
  activeSeason=season;
  document.querySelectorAll('.season-tab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.season-panel').forEach(p=>p.classList.remove('active'));
  var panel=document.getElementById('season-panel-'+season);
  if(panel) panel.classList.add('active');
  renderVoterBar();
  updateCreditDisplay();
  if(season==='summer') renderSummerGrid();
  else renderSeasonGrid(season);
  // update credit display ids for summer27
  if(season==='summer27') updateCreditDisplay();
}

// ===================== DISTANCE FILTER FOR VOTING SEASONS =====================
var _seasonDistFilters = {fall:999, winter:999, spring:999, summer27:999};
function filterSeasonDist(season, maxDist, btn) {
  _seasonDistFilters[season] = maxDist;
  var panel = document.getElementById('season-panel-'+season);
  if(panel) panel.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  renderSeasonGrid(season);
}

// ===================== CONFIRMED SUMMER =====================
// Fuzzy-match a confirmed (constant) tournament to a GameTracker tournament by name,
// so we can surface the result we've logged in GameTracker on the main Tournaments page.
function gtNormName(x) {
  return String(x || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(annual|the|of|at|20\d\d|\d+(st|nd|rd|th))\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function gtMatchTournamentByName(name) {
  if (typeof GT === 'undefined' || !GT.tournaments || !GT.tournaments.length) return null;
  var n = gtNormName(name); if (!n) return null;
  var nTok = n.split(' ').filter(Boolean), best = null, bestScore = 0;
  GT.tournaments.forEach(function(t) {
    var m = gtNormName(t.name); if (!m) return;
    var score = 0;
    if (m === n) score = 100;
    else if (m.indexOf(n) >= 0 || n.indexOf(m) >= 0) score = 80;
    else { var mTok = m.split(' ').filter(Boolean); var ov = nTok.filter(function(x){ return mTok.indexOf(x) >= 0; }).length; score = ov >= 2 ? 40 + ov : 0; }
    if (score > bestScore) { bestScore = score; best = t; }
  });
  return bestScore >= 40 ? best : null;
}
function ccResultFooter(t) {
  if (t.club === 'FC Delco') return null;
  // Hard-coded overrides win first (events with no GameTracker record).
  if (typeof MANUAL_TOURNAMENT_RESULTS !== 'undefined' && MANUAL_TOURNAMENT_RESULTS[t.id]) {
    var mo = MANUAL_TOURNAMENT_RESULTS[t.id];
    return { manual: true, key: mo.key, text: ((mo.label || '\u2714 Played') + (mo.record ? ' \u00b7 ' + mo.record : '')).toUpperCase() };
  }
  var gt = gtMatchTournamentByName(t.name); if (!gt) return null;
  var pl = (typeof gtTournPlacement === 'function') ? gtTournPlacement(gt.id) : null;
  var complete = (typeof gtTournComplete === 'function') ? gtTournComplete(gt) : false;
  if (!pl && !complete) return null;
  var rec = (typeof gtTournRecordStr === 'function') ? gtTournRecordStr(gt.id) : '';
  return { gtId: gt.id, key: pl ? pl.key : 'done', text: ((pl ? pl.label : '\u2714 Played') + (rec ? ' \u00b7 ' + rec : '')).toUpperCase() };
}
function renderConfirmedSummer() {
  var confirmed=SUMMER_TOURNAMENTS.filter(function(t){return CONFIRMED_IDS.indexOf(t.id)!==-1;})
    .concat(typeof FC_DELCO_EVENTS !== 'undefined' ? FC_DELCO_EVENTS : []);
  var grid=document.getElementById('confirmed-grid');
  if(!grid) return;
  grid.innerHTML=confirmed.map(function(t){
    var fd=t.fee==='TBD'?'Fee TBD':t.fee.split('(')[0].trim();
    var isFC = t.club === 'FC Delco';
    var rf = ccResultFooter(t);
    return '<div class="confirmed-card'+(isFC?' fcdelco':'')+'">'
      +'<div class="cc-head"><div class="cc-name">'+t.name+(isFC?' <span class="fc-badge">FC DELCO</span>':'')+'</div>'
      +'<div class="cc-meta"><span>'+t.dates+'</span><span>'+t.location+'</span>'+(isFC?'':'<span>'+t.distance+' mi</span>')+'</div></div>'
      +'<div class="cc-body"><div class="cc-fee">'+fd+'</div>'
      +'<div style="font-size:.75rem;color:#444;margin-bottom:8px">Format: '+t.format+'</div>'
      +'<button class="cc-notes-toggle" onclick="toggleCC('+t.id+')">Show details</button>'
      +'<div class="cc-notes" id="ccn-'+t.id+'">'
      +'<strong>Host:</strong> '+t.host+'<br><strong>Deadline:</strong> '+t.deadline+'<br><br>'
      +'<em>'+t.notes+'</em><br><br>'
      +'<strong>Website:</strong> <a href="https://'+t.website+'" target="_blank" style="color:#16a34a;word-break:break-all">'+t.website+'</a>'
      +'</div></div>'
      +(isFC
        ?'<div class="cc-footer" style="background:#991b1b">FC DELCO EVENT &nbsp;&#183;&nbsp; Club commitment \u2014 not F6AD</div>'
        :POSSIBILITY_IDS.indexOf(t.id)!==-1
        ?'<div class="cc-footer" style="background:#d97706">POSSIBILITY &nbsp;&#183;&nbsp; Registration likely but not yet confirmed</div>'
        :rf&&rf.manual
        ?'<div class="cc-footer cc-'+rf.key+'">'+rf.text+'</div>'
        :rf
        ?'<div class="cc-footer cc-'+rf.key+'" style="cursor:pointer" onclick="location.hash=\'#/gametracker/tournament/'+rf.gtId+'\'">'+rf.text+' &nbsp;&#183;&nbsp; View in GameTracker &#8594;</div>'
        :'<div class="cc-footer">CONFIRMED &nbsp;&#183;&nbsp; Registration locked in</div>')
      +'</div>';
  }).join('');
}
function toggleCC(id) {
  var el=document.getElementById('ccn-'+id), btn=el.previousElementSibling;
  el.classList.toggle('open');
  btn.textContent=el.classList.contains('open')?'Hide details':'Show details';
}

// ===================== SUMMER GRID (browse only) =====================
function filterSummer(f, btn) {
  _summerFilter=f;
  document.querySelectorAll('#season-panel-summer .filter-btn').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  renderSummerGrid();
}
function sortSummer(s) { _summerSort=s; renderSummerGrid(); }
function renderSummerGrid() {
  var list=SUMMER_TOURNAMENTS.filter(function(t){return CONFIRMED_IDS.indexOf(t.id)===-1;});
  if(_summerFilter==='nearby') list=list.filter(function(t){return t.distance<=50;});
  if(_summerSort==='date') list.sort(function(a,b){return parseDate(a.dates)-parseDate(b.dates);});
  if(_summerSort==='distance') list.sort(function(a,b){return a.distance-b.distance;});
  if(_summerSort==='fee') list.sort(function(a,b){return parseFee(a.fee)-parseFee(b.fee);});
  var grid=document.getElementById('summer-grid');
  if(!grid) return;
  grid.innerHTML=list.map(function(t){
    var fd=t.fee==='TBD'?'<span style="color:var(--muted);font-size:.85rem">Fee TBD</span>':'<span class="t-fee">'+t.fee.split('(')[0].trim()+'</span>';
    return '<div class="t-card no-vote'+fcConflictClass(t)+'">'
      +'<div class="t-card-head"><div class="t-card-row1"><span class="t-name">'+t.name+'</span></div>'
      +'<div class="t-meta"><span class="t-tag highlight">'+t.dates+'</span>'
      +'<span class="t-tag">'+t.location+'</span><span class="t-tag">'+t.distance+' mi</span></div>'
      +fcConflictBanner(t)+'</div>'
      +'<div class="t-body"><div class="t-fee-row">'+fd+'<span class="t-deadline">Deadline: '+t.deadline+'</span></div>'
      +'<button class="t-notes-toggle" onclick="toggleBN('+t.id+')">Show details</button>'
      +'<div class="t-notes" id="bn-'+t.id+'">'
      +'<strong>Host:</strong> '+t.host+'<br><strong>Format:</strong> '+t.format+'<br><em>'+t.notes+'</em><br><br>'
      +'<strong>Website:</strong> <a href="https://'+t.website+'" target="_blank" class="t-website">'+t.website+'</a>'
      +'</div></div></div>';
  }).join('');
}
function toggleBN(id) {
  var el=document.getElementById('bn-'+id), btn=el.previousElementSibling;
  el.classList.toggle('open'); btn.textContent=el.classList.contains('open')?'Hide details':'Show details';
}

// ===================== SEASON GRID (voting) =====================
function sortSeason(season, s) { seasonSorts[season]=s; renderSeasonGrid(season); }
function renderSeasonGrid(season) {
  var voterName=getVoterName();
  var maxDist=(_seasonDistFilters&&_seasonDistFilters[season])||999;
  var tournaments=getSeasonTournaments(season).filter(function(t){return t.distance<=maxDist;});
  var allVotes=getSeasonVotes(season);
  var allNotes=getSeasonNotes(season);
  var lc=getSeasonCredits(season);
  var list=tournaments.slice();
  var s=seasonSorts[season];
  if(s==='date') list.sort(function(a,b){return parseDate(a.dates)-parseDate(b.dates);});
  if(s==='distance') list.sort(function(a,b){return a.distance-b.distance;});
  if(s==='fee') list.sort(function(a,b){return parseFee(a.fee)-parseFee(b.fee);});

  var tally={};
  tournaments.forEach(function(t){tally[t.id]={credits:0,voterCount:0};});
  Object.keys(allVotes).forEach(function(voter){
    var vv=allVotes[voter];
    Object.keys(vv).forEach(function(tid){
      var id=parseInt(tid), v=vv[tid];
      if(tally[id]&&typeof v==='number'&&v>0){tally[id].credits+=v;tally[id].voterCount++;}
    });
  });

  var pubNotes={};
  tournaments.forEach(function(t){pubNotes[t.id]=[];});
  Object.keys(allNotes).forEach(function(voter){
    var vn=allNotes[voter];
    Object.keys(vn).forEach(function(tid){
      var id=parseInt(tid), note=vn[tid];
      if(pubNotes[id]!==undefined&&note&&note.trim()){
        var cr=(allVotes[voter]||{})[id];
        pubNotes[id].push({voter:voter,note:note.trim(),credits:typeof cr==='number'?cr:0});
      }
    });
  });

  var remaining=getSeasonRemaining(season);
  var grid=document.getElementById(season+'-grid');
  if(!grid) return;

  grid.innerHTML=list.map(function(t){
    var myCredits=lc[t.id]||0;
    var cardClass=myCredits>0?'has-credits':'';
    var fd=t.fee==='TBD'?'<span class="t-fee tbd">Fee TBD</span>':'<span class="t-fee">'+t.fee.split('(')[0].trim()+'</span>';
    var tc=tally[t.id];
    var myNote=voterName?((allNotes[voterName]||{})[t.id]||''):'';
    var notes=pubNotes[t.id]||[];
    var liveHtml=tc.credits>0
      ?'<span style="color:var(--purple);font-weight:700">'+tc.credits+' credits</span> &middot; <span style="font-size:.7rem;color:var(--muted)">'+tc.voterCount+' voter'+(tc.voterCount!==1?'s':'')+'</span>'
      :'<span style="font-size:.72rem;color:var(--muted)">No credits yet</span>';
    var canAdd=remaining>0&&myCredits<MAX_PER_TOURNAMENT;
    var allocHtml=voterName
      ?'<div class="credit-alloc-row">'
        +'<button class="credit-adj-btn" id="cm-'+season+'-'+t.id+'" onclick="adjustCredits(\''+season+'\','+t.id+',-25)" '+(myCredits<=0?'disabled':'')+'>&#8722;</button>'
        +'<input type="number" class="credit-input-field" id="ci-'+season+'-'+t.id+'" value="'+myCredits+'" min="0" max="'+Math.min(myCredits+remaining,MAX_PER_TOURNAMENT)+'" oninput="handleCreditInput(\''+season+'\','+t.id+')" onblur="handleCreditInput(\''+season+'\','+t.id+')" />'
        +'<button class="credit-adj-btn" id="cp-'+season+'-'+t.id+'" onclick="adjustCredits(\''+season+'\','+t.id+',25)" '+(!canAdd?'disabled':'')+'>+</button>'
        +'<span class="credit-label">credits (max 200)</span>'
        +'<span class="credit-pct" id="cpct-'+season+'-'+t.id+'">'+(myCredits>0?(Math.round(myCredits/TOTAL_CREDITS*100)+'% of budget'):'')+'</span>'
        +'</div>'
      :'<div style="padding:10px 18px;font-size:.8rem;color:var(--muted);font-style:italic">Enter your name above to allocate credits</div>';
    var noteHtml=(voterName&&myCredits>0)
      ?'<div class="vote-note-wrap">'
        +'<span class="vote-note-label">Your note (shared with all families)</span>'
        +'<textarea class="vote-note-textarea" id="ni-'+season+'-'+t.id+'" placeholder="Why are you putting credits here?">'+myNote+'</textarea>'
        +'<div class="vote-note-actions">'
          +'<button class="vote-note-save" onclick="saveNote(\''+season+'\','+t.id+')">Save Note</button>'
          +'<span class="vote-note-saved" id="ns-'+season+'-'+t.id+'">Saved!</span>'
        +'</div></div>'
      :'';
    var pubHtml=notes.length
      ?'<div class="public-notes-wrap">'
        +'<button class="public-notes-toggle" onclick="togglePN(\''+season+'\','+t.id+')">'+notes.length+' note'+(notes.length>1?'s':'')+' from families</button>'
        +'<div class="public-notes-list" id="pn-'+season+'-'+t.id+'" style="display:none">'
        +notes.map(function(n){return '<div class="public-note-item"><div class="public-note-author">'+n.voter+(n.credits>0?' ('+n.credits+' credits)':'')+'</div><div class="public-note-text">'+n.note+'</div></div>';}).join('')
        +'</div></div>'
      :'';
    return '<div class="t-card '+cardClass+fcConflictClass(t)+'" id="card-'+season+'-'+t.id+'">'
      +'<div class="t-card-head"><div class="t-card-row1"><span class="t-name">'+t.name+'</span></div>'
      +'<div class="t-meta"><span class="t-tag highlight">'+t.dates+'</span><span class="t-tag">'+t.location+'</span><span class="t-tag">'+t.distance+' mi</span></div>'
      +fcConflictBanner(t)+'</div>'
      +'<div class="t-body"><div class="t-fee-row">'+fd+'<span class="t-deadline">Deadline: '+t.deadline+'</span></div>'
      +'<div style="font-size:.78rem;color:var(--muted);margin-bottom:6px">Format: '+t.format+'</div>'
      +'<button class="t-notes-toggle" onclick="toggleSN(\''+season+'\','+t.id+')">Show notes &amp; details</button>'
      +'<div class="t-notes" id="sn-'+season+'-'+t.id+'">'
      +'<strong>Host:</strong> '+t.host+'<br><em>'+t.notes+'</em><br><br>'
      +'<strong>Website:</strong> <a href="https://'+t.website+'" target="_blank" class="t-website">'+t.website+'</a>'
      +'</div></div>'
      +'<div class="t-footer"><div style="margin-bottom:8px">'+liveHtml+'</div>'+allocHtml+noteHtml+pubHtml+'</div>'
      +'</div>';
  }).join('');
}
function toggleSN(season, id) {
  var el=document.getElementById('sn-'+season+'-'+id), btn=el.previousElementSibling;
  el.classList.toggle('open'); btn.textContent=el.classList.contains('open')?'Hide notes & details':'Show notes & details';
}
function togglePN(season, id) {
  var el=document.getElementById('pn-'+season+'-'+id);
  if(el) el.style.display=el.style.display==='none'?'flex':'none';
}

// ===================== SHARE VOTES =====================
function shareVotes() {
  var name=getVoterName();
  if(!name){showToast('Set your name first.'); return;}
  if(activeSeason==='summer'){showToast('Use the Fall/Winter/Spring tabs to vote.'); return;}
  var season=activeSeason;
  var tournaments=getSeasonTournaments(season);
  var lc=getSeasonCredits(season);
  var allocated=[], unallocated=[];
  tournaments.forEach(function(t){var cr=lc[t.id]||0; if(cr>0) allocated.push({name:t.name,credits:cr}); else unallocated.push(t.name);});
  allocated.sort(function(a,b){return b.credits-a.credits;});
  var used=allocated.reduce(function(s,x){return s+x.credits;},0);
  var label={fall:'Fall 2026',winter:'Winter 2026',spring:'Spring 2027'}[season];
  var text='F6AD '+label.toUpperCase()+' CREDITS -- '+name+'\n'+Array(49).join('=')+'\n'+used+'/'+TOTAL_CREDITS+' credits used\n';
  if(allocated.length) text+='\nALLOCATED:\n'+allocated.map(function(x){return '  '+x.name+' -- '+x.credits;}).join('\n');
  if(unallocated.length) text+='\n\nNO CREDITS:\n'+unallocated.map(function(x){return '  '+x;}).join('\n');
  navigator.clipboard.writeText(text).then(function(){showToast('Credits summary copied!');});
}

// ===================== UTILS =====================
function parseDate(dateStr) {
  var m=dateStr.match(/(\w+)\s+(\d+)/);
  if(!m) return new Date('2027-12-31');
  var months={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  var mo=months[m[1]]||6;
  var year=mo<=5?2027:2026;
  return new Date(year,mo-1,parseInt(m[2]));
}
function parseFee(feeStr) {
  var m=feeStr.replace(/,/g,'').match(/\$(\d+)/);
  return m?parseInt(m[1]):99999;
}

// ===================== CREDIT SYSTEM =====================
function initSeasonCredits(season) {
  var name=getVoterName();
  if(!name){ setSeasonCredits(season,{}); return; }
  var v=getSeasonVotes(season)[name]||{};
  var cr={};
  getSeasonTournaments(season).forEach(function(t){
    var key=season+'-'+t.id;
    if(!pendingCreditSaves.has(key)){
      var val=v[t.id];
      cr[t.id]=(typeof val==='number'&&val>=0)?Math.min(Math.round(val),MAX_PER_TOURNAMENT):0;
    }
  });
  setSeasonCredits(season,cr);
}
function getSeasonTotalUsed(season){ return Object.values(getSeasonCredits(season)).reduce(function(s,v){return s+(parseInt(v)||0);},0); }
function getSeasonRemaining(season){ return TOTAL_CREDITS-getSeasonTotalUsed(season); }

function updateCreditDisplay() {
  var season=activeSeason, name=getVoterName();
  var badge=document.getElementById('credits-remaining-display');
  if(badge){
    if(!name||season==='summer'){badge.style.display='none'; return;}
    var rem=getSeasonRemaining(season);
    badge.style.display='';
    badge.textContent=rem+' credits remaining';
    badge.className='credits-remaining-display'+(rem===0?' empty':rem<200?' warn':'');
  }
  if(season!=='summer'){
    var bar=document.getElementById('vote-summary-bar-'+season);
    if(bar){ bar.style.display=name?'flex':'none';
      var used=TOTAL_CREDITS-getSeasonRemaining(season);
      var cu=document.getElementById('count-used-'+season); if(cu) cu.textContent=used;
      var cr=document.getElementById('count-remaining-'+season);
      if(cr) cr.textContent=getSeasonRemaining(season)>0?'&#183; '+getSeasonRemaining(season)+' remaining':'&#183; All credits allocated!';
    }
    getSeasonTournaments(season).forEach(function(t){
      var lc=getSeasonCredits(season);
      var card=document.getElementById('card-'+season+'-'+t.id); if(!card) return;
      var credits=lc[t.id]||0;
      if(credits>0) card.classList.add('has-credits'); else card.classList.remove('has-credits');
      var inp=document.getElementById('ci-'+season+'-'+t.id); if(inp) inp.value=credits;
      var minus=document.getElementById('cm-'+season+'-'+t.id); if(minus) minus.disabled=credits<=0;
      var plus=document.getElementById('cp-'+season+'-'+t.id); if(plus) plus.disabled=(getSeasonRemaining(season)<=0&&credits<MAX_PER_TOURNAMENT)||credits>=MAX_PER_TOURNAMENT;
      var pct=document.getElementById('cpct-'+season+'-'+t.id); if(pct) pct.textContent=credits>0?(Math.round(credits/TOTAL_CREDITS*100)+'% of budget'):'';
    });
  }
}
function handleCreditInput(season, tournId) {
  var el=document.getElementById('ci-'+season+'-'+tournId); if(!el) return;
  var lc=getSeasonCredits(season);
  var val=parseInt(el.value)||0;
  val=Math.max(0,Math.min(val,(lc[tournId]||0)+getSeasonRemaining(season),MAX_PER_TOURNAMENT));
  el.value=val; lc[tournId]=val;
  updateCreditDisplay(); scheduleCreditSave(season,tournId);
}
function adjustCredits(season, tournId, delta) {
  var lc=getSeasonCredits(season);
  var cur=lc[tournId]||0;
  lc[tournId]=Math.max(0,Math.min(cur+delta,cur+getSeasonRemaining(season),MAX_PER_TOURNAMENT));
  updateCreditDisplay(); scheduleCreditSave(season,tournId);
}
function scheduleCreditSave(season, tournId) {
  var key=season+'-'+tournId;
  pendingCreditSaves.add(key);
  clearTimeout(creditSaveTimers[key]);
  creditSaveTimers[key]=setTimeout(function(){saveCreditAllocation(season,tournId);},700);
}
function saveCreditAllocation(season, tournId) {
  var name=getVoterName(); if(!name) return;
  var key=season+'-'+tournId;
  var lc=getSeasonCredits(season);
  var myVotes=Object.assign({},(getSeasonVotes(season)[name]||{}));
  myVotes[tournId]=lc[tournId]||0;
  db.collection(getSeasonCollection(season)).doc(name).set({name:name,votes:myVotes,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})
    .then(function(){pendingCreditSaves.delete(key);})
    .catch(function(e){showToast('Error saving: '+e.message);});
}

// ===================== NOTES =====================
function saveNote(season, tournId) {
  var name=getVoterName(); if(!name) return;
  var el=document.getElementById('ni-'+season+'-'+tournId); if(!el) return;
  var note=el.value.trim();
  var myNotes=Object.assign({},(getSeasonNotes(season)[name]||{}));
  myNotes[tournId]=note;
  db.collection(getSeasonCollection(season)).doc(name).set({notes:myNotes},{merge:true})
    .then(function(){ var s=document.getElementById('ns-'+season+'-'+tournId); if(s){s.style.display='inline';setTimeout(function(){s.style.display='none';},2200);} })
    .catch(function(e){showToast('Error: '+e.message);});
}

