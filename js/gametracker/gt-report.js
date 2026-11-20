// ---------- FULL POST-GAME EXCEL REPORT ----------
// ExcelJS is loaded only on export; the game record is never changed.
var gtExcelLoading = null;
var gtReportBusy = false;
function gtReportText(value) { return value == null ? '' : String(value); }
function gtReportLink(value) {
  var text = gtReportText(value).trim();
  // All other user content stays literal text, including strings beginning '='.
  return /^https?:\/\/[^\s]+$/i.test(text) ? { text: text, hyperlink: text } : text;
}
function gtReportPlayer(pid) { return pid ? gtPlayerName(pid) : ''; }
function gtReportJersey(pid) {
  var p = gtP(pid);
  return p && p.jersey_number != null ? gtReportText(p.jersey_number) : '';
}
function gtReportTime(g, entry) {
  var p = Number(entry.period), sec = entry.game_clock_seconds;
  var validPeriod = Number.isInteger(p) && p > 0;
  var validTime = typeof sec === 'number' && isFinite(sec) && sec >= 0;
  var n = g.num_periods || 2;
  var label = !validPeriod ? 'Not recorded' : p > n ? 'Overtime ' + (p - n) :
    n === 2 ? (p === 1 ? '1st Half' : '2nd Half') : 'Period ' + p;
  var clock = !validPeriod || !validTime ? 'Not recorded' : p > n ?
    'OT' + (p - n) + ' ' + gtFmtMMSS(sec) : gtFmtMMSS(gtDisplayCumSec(g, p, sec));
  return { period: label, clock: clock, seconds: validTime ? sec : '' };
}
function gtReportOrder(a, b) {
  // Period first keeps first-half stoppage time ahead of second-half kickoff.
  function period(e) { return Number(e.period) > 0 ? Number(e.period) : Infinity; }
  function seconds(e) { return typeof e.game_clock_seconds === 'number' && isFinite(e.game_clock_seconds) && e.game_clock_seconds >= 0 ? e.game_clock_seconds : Infinity; }
  return (period(a) - period(b)) || (seconds(a) - seconds(b)) || (gtTsMillis(a.created_at) - gtTsMillis(b.created_at)) || 0;
}
function gtBuildGameReport(gid) {
  var g = gtGame(gid);
  if (!g) throw new Error('Game not found.');
  var us = gtReportText(gtOurName(g)), them = gtReportText(gtTheirName(g));
  var date = gtGameDateStr(g) || 'Date not recorded';
  var starters = gtStarters(gid), startMap = {};
  starters.forEach(function(s){ startMap[s.pid] = s; });
  var events = gtGameEventsForStats(gid);
  var subs = gtGameSubs(gid).slice().sort(gtReportOrder);
  var minutes = gtMinutesMap(gid);
  var season = GT.seasons.find(function(s){ return s.id === g.season_id; });
  var tournament = GT.tournaments.find(function(t){ return t.id === g.tournament_id; });
  var result = g.status === 'complete' ? ({ W: 'Win', L: 'Loss', D: 'Draw' }[gtResult(g)] || '') : 'Game not complete';
  var title = us + ' ' + gtOurScore(g) + ' - ' + gtTheirScore(g) + ' ' + them;
  var report = {
    title: title,
    subtitle: date + ' | ' + (tournament ? tournament.name : season ? season.name : g.game_type || 'Game'),
    filename: (us + '_vs_' + them).replace(/[^a-z0-9]+/gi, '_').slice(0, 110) + '_' + date + '_Post_Game_Report.xlsx',
    sheets: []
  };
  function add(name, headers, widths, rows, note, formats) {
    report.sheets.push({ name: name, headers: headers, widths: widths, rows: rows, note: note, formats: formats || {} });
  }
  var reviewUrl = typeof window !== 'undefined' && window.location ? window.location.origin + window.location.pathname + '#/gametracker/review/' + encodeURIComponent(gid) : '';
  var summary = [
    ['Team', us], ['Opponent', them], ['Date', date], ['Kickoff', g.kickoff_time ? gtFmtKickoff(g.kickoff_time) : 'Not recorded'],
    ['Status', gtReportText(g.status)], ['Result', result], ['Our score', gtOurScore(g)], ['Opponent score', gtTheirScore(g)],
    ['Home team', gtReportText(gtHomeName(g))], ['Away team', gtReportText(gtAwayName(g))],
    ['Game type', gtReportText(g.game_type)], ['Season / league', season ? gtReportText(season.name) : ''],
    ['Tournament', tournament ? gtReportText(tournament.name) : ''], ['Round', gtReportText(g.round)],
    ['Venue', gtReportText(g.venue)], ['Field', gtReportText(g.field)],
    ['Address', [g.venue_address, g.venue_city, g.venue_state, g.venue_zip].filter(Boolean).join(', ')],
    ['Players per side', g.players_per_side || 'Not recorded'],
    ['Regulation format', (g.num_periods || 2) + ' periods of ' + (g.period_duration_minutes || 0) + ' minutes'],
    ['Recorded playing time', gtTotalSeconds(g) > 0 ? gtFmtMMSS(gtTotalSeconds(g)) : 'Not recorded'],
    ['Starters recorded', starters.length], ['Early finish reason', gtReportText(g.end_reason)],
    ['Game review', gtReportLink(reviewUrl)], ['Report generated', new Date().toISOString()],
    ['Stats included', 'Coach records and published family stats. Private notes and pending submissions are excluded.'],
    ['Minutes', 'Calculated from the recorded game clock, starters and substitutions; manual adjustments take precedence. Missing starter selections can make legacy minutes estimates.'],
    ['Stat definitions', 'Counts follow GameTracker: shots and shots on target, and passes and completed passes, are separate recorded categories. Shootout kicks do not count as goals.'],
    ['Timeline clocks', 'Regulation uses the match clock; overtime uses OT1, OT2, etc. with time within that period. These are game times, not video offsets. Existing video-link timestamps are preserved.'],
    ['Record completeness', 'Only recorded information can be exported. Blank fields or “Not recorded” indicate missing data; no starters or events are reconstructed.']
  ];
  if (gtPkKicks(g).length || g.pk_winner) {
    var pk = gtPkScore(g);
    summary.splice(8, 0, ['Shootout score (us - opponent)', pk.us + ' - ' + pk.them], ['Shootout winner', g.pk_winner ? (g.pk_winner === 'us' ? us : them) : 'Not decided']);
  }
  add('Match Summary', ['Detail', 'Value'], [29, 100], summary, 'Post-game report · Score is separate from any penalty shootout.');
  add('Starting XI', ['Jersey', 'Player', 'Position', 'Player type'], [12, 30, 20, 16], starters.map(function(s){
    var p = gtP(s.pid);
    return [gtReportJersey(s.pid), gtReportPlayer(s.pid), gtReportText(s.pos), p && p.is_guest ? 'Guest' : 'Regular'];
  }), starters.length ? starters.length + ' recorded starters' + (g.players_per_side ? ' · ' + g.players_per_side + ' players per side' : '') + ' · Positions are as recorded at kickoff.' : 'No starting lineup was recorded for this game.');
  var ids = gtWhoPlayedIds(gid).slice().sort(function(a, b){
    var pa = gtP(a), pb = gtP(b);
    return ((pa && pa.jersey_number != null ? Number(pa.jersey_number) : 999) - (pb && pb.jersey_number != null ? Number(pb.jersey_number) : 999)) || gtReportPlayer(a).localeCompare(gtReportPlayer(b));
  });
  add('Player Stats', ['Jersey', 'Player', 'Player type', 'Starter', 'Starting position', 'Minutes', 'Playing time', 'Minutes source', 'Goals', 'Assists', 'Shots on target', 'Shots', 'Saves', 'Tackles', 'Passes', 'Completed passes', 'Yellow cards', 'Red cards', 'Own goals', 'Highlights'],
    [10, 28, 14, 15, 18, 12, 15, 29, 10, 10, 14, 10, 10, 10, 10, 15, 13, 13, 12, 12], ids.map(function(pid){
      var p = gtP(pid), st = gtStatLine(pid, events), s = startMap[pid];
      var manual = gtMinutesOverridden(gid, pid);
      var knownMinutes = minutes[pid] != null && (manual || gtTotalSeconds(g) > 0);
      return [gtReportJersey(pid), gtReportPlayer(pid), p && p.is_guest ? 'Guest' : 'Regular', s ? 'Yes' : starters.length ? 'No' : 'Not recorded',
        s ? gtReportText(s.pos) : '', knownMinutes ? minutes[pid] / 60 : '', knownMinutes ? gtFmtMMSS(minutes[pid]) : 'Not recorded',
        manual ? 'Manually adjusted' : !knownMinutes ? 'Not recorded' : starters.length ? 'Game clock / substitutions' : 'Legacy estimate (no starters)',
        st.goal, st.assist, st.shot_on_target, st.shot, st.save, st.tackle, st.pass, st.pass_comp, st.yellow_card, st.red_card, st.own_goal, st.highlight];
    }), 'Game-specific players, including guests and players found in recorded events/substitutions. Minutes retain manual adjustments; being listed does not guarantee playing time.', { 6: '0.00' });

  var timeline = [];
  gtGameEvents(gid).forEach(function(e){ timeline.push({ entry: e, type: e.event_type, label: gtEventType(e.event_type).label, notes: gtReportText(e.notes), video: gtReportText(e.youtube_url), source: 'Coach record' }); });
  // Use original public entries to retain missing timestamps and published notes.
  // The stat adapter defaults missing clocks to zero and omits non-stat entries.
  gtPublicParentEvents(gid).forEach(function(e){
    var t = gtParentType(e.type);
    timeline.push({ entry: e, type: t.stat || e.type, label: t.label, notes: gtReportText(e.text) + (e.type === 'in_play' ? ' (' + gtInplayLabel(e.outcome) + ')' : ''), video: gtReportText(e.youtube_url), source: 'Published family ' + (t.stat ? 'stat' : 'note') });
  });
  subs.forEach(function(s){
    timeline.push({ entry: s, type: 'substitution', label: 'Substitution', notes: (s.player_in_id ? 'On: ' + gtReportPlayer(s.player_in_id) : '') + (s.player_out_id ? (s.player_in_id ? '; ' : '') + 'Off: ' + gtReportPlayer(s.player_out_id) : '') + (s.position ? '; Position: ' + s.position : ''), video: '', source: 'Coach record' });
  });
  timeline.sort(function(a, b){ return gtReportOrder(a.entry, b.entry); });
  function eventRow(item) {
    var e = item.entry, time = gtReportTime(g, e), opponent = /^opponent_/.test(item.type);
    return [time.period, time.clock, gtReportText(item.label), opponent ? them : us, gtReportJersey(e.player_id), gtReportPlayer(e.player_id), item.notes, gtReportLink(item.video), item.source, time.seconds];
  }
  var eventHeaders = ['Period', 'Match clock', 'Event', 'Team', 'Jersey', 'Player', 'Notes', 'Video', 'Source', 'Period seconds'];
  var eventWidths = [18, 17, 22, 26, 10, 28, 65, 45, 26, 15];
  add('Timeline', eventHeaders, eventWidths, timeline.map(eventRow), 'All recorded events and substitutions, plus published family stats/notes, in period order. Missing times appear last within their period.');
  var highlights = timeline.filter(function(item){ return /^(goal|opponent_goal|own_goal|opponent_own_goal|assist|save|highlight|yellow_card|red_card|opponent_yellow_card|opponent_red_card)$/.test(item.type) || item.video; });
  add('Highlights', eventHeaders, eventWidths, highlights.map(eventRow), 'Goals, assists, saves, cards, tagged highlights and linked clips. Links open the recorded video URL; game clocks do not imply a video offset.');
  add('Substitutions', ['Period', 'Match clock', 'Player on', 'Jersey on', 'Player off', 'Jersey off', 'Position', 'Period seconds'], [18, 17, 28, 12, 28, 12, 18, 15], subs.map(function(s){
    var time = gtReportTime(g, s);
    return [time.period, time.clock, gtReportPlayer(s.player_in_id), gtReportJersey(s.player_in_id), gtReportPlayer(s.player_out_id), gtReportJersey(s.player_out_id), gtReportText(s.position), time.seconds];
  }), 'Each recorded change is included, including changes with only a player on or off. Positions refer to the incoming player.');
  if (gtPkKicks(g).length) {
    var ours = 0, theirs = 0;
    add('Penalty Shootout', ['Kick', 'Team', 'Player', 'Outcome', 'Our score', 'Opponent score'], [10, 28, 28, 18, 14, 18], gtPkKicks(g).map(function(k, i){
      if (k.outcome === 'goal') { if (k.team === 'us') ours++; else theirs++; }
      return [i + 1, k.team === 'us' ? us : them, gtReportPlayer(k.player_id), ({ goal: 'Goal', saved: 'Saved', missed: 'Missed' })[k.outcome] || gtReportText(k.outcome), ours, theirs];
    }), 'Kicks are in recorded order. Shootout goals are separate from match and player goals; kick timestamps are not recorded.');
  }
  return report;
}

function gtReportWorkbook(report, Excel) {
  var book = new Excel.Workbook();
  book.creator = 'GameTracker'; book.title = 'Post-game report: ' + report.title;
  book.created = new Date();
  report.sheets.forEach(function(data){
    var sheet = book.addWorksheet(data.name, {
      properties: { tabColor: { argb: 'FF7431B5' } },
      views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' }
    });
    sheet.columns = data.widths.map(function(width){ return { width: width }; });
    var count = data.headers.length;
    [report.title, report.subtitle, data.note].forEach(function(text, i){
      sheet.mergeCells(i + 1, 1, i + 1, count);
      var cell = sheet.getCell(i + 1, 1);
      cell.value = text;
      cell.font = { name: 'Calibri', size: i === 0 ? 17 : 11, bold: i === 0, color: { argb: i === 0 ? 'FFFFFFFF' : 'FF535568' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (i === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF52217F' } };
      sheet.getRow(i + 1).height = i === 0 ? 38 : i === 1 ? 24 : 42;
    });
    sheet.addRow(data.headers);
    sheet.getRow(4).height = 32;
    sheet.getRow(4).eachCell(function(cell){
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7431B5' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    data.rows.forEach(function(values, i){
      var row = sheet.addRow(values), lines = 1;
      row.eachCell({ includeEmpty: true }, function(cell, column){
        cell.font = { name: 'Calibri', size: 11, color: { argb: cell.value && cell.value.hyperlink ? 'FF1760A5' : 'FF24283B' }, underline: !!(cell.value && cell.value.hyperlink) };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEF9' } };
        if (data.formats[column]) cell.numFmt = data.formats[column];
        var text = cell.value && cell.value.text ? cell.value.text : gtReportText(cell.value);
        var estimated = text.split('\n').reduce(function(total, line){ return total + Math.max(1, Math.ceil(line.length / Math.max(8, data.widths[column - 1] - 3))); }, 0);
        lines = Math.max(lines, estimated);
      });
      row.height = Math.min(409, Math.max(26, lines * 16 + 8));
    });
    if (data.rows.length) sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: sheet.rowCount, column: count } };
    else {
      sheet.mergeCells(5, 1, 5, count);
      sheet.getCell('A5').value = data.name === 'Starting XI' ? 'No starting lineup recorded.' : 'No records for this game.';
      sheet.getCell('A5').font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF535568' } };
      sheet.getRow(5).height = 28;
    }
  });
  return book;
}
function gtEnsureExcel() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!gtExcelLoading) gtExcelLoading = new Promise(function(resolve, reject){
    var script = document.createElement('script');
    var timer = setTimeout(function(){ finish(new Error('The Excel tool took too long to load. Please try again.')); }, 20000);
    function finish(error) {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); gtExcelLoading = null; reject(error); }
      else resolve(window.ExcelJS);
    }
    script.src = 'js/vendor/exceljs-4.4.0.min.js';
    script.onload = function(){ finish(window.ExcelJS ? null : new Error('Could not load the Excel tool. Please try again.')); };
    script.onerror = function(){ finish(new Error('Could not load the Excel tool. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return gtExcelLoading;
}
async function gtExportGameExcel(gid, button) {
  if (gtReportBusy) { showToast('Your Excel report is being prepared…'); return; }
  if (['games', 'players', 'events', 'subs', 'avail', 'parentEvents', 'seasons', 'tournaments'].some(function(key){ return !GT.loaded[key]; })) {
    showToast('Game details are still loading. Please try the report again in a moment.'); return;
  }
  gtReportBusy = true;
  var oldLabel = button && button.textContent;
  if (button) { button.disabled = true; button.textContent = 'Preparing Excel report…'; }
  showToast('Preparing your full game report…');
  try {
    var Excel = await gtEnsureExcel();
    var report = gtBuildGameReport(gid);
    var buffer = await gtReportWorkbook(report, Excel).xlsx.writeBuffer();
    var url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var link = document.createElement('a');
    link.href = url; link.download = report.filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    showToast('Excel report downloaded.');
  } catch (e) {
    showToast(e.message || 'Could not create the Excel report. Please try again.');
  } finally {
    gtReportBusy = false;
    if (button) { button.disabled = false; button.textContent = oldLabel; }
  }
}
