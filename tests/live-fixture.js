// Synthetic game shared by the UI preview and regression tests. No Firebase access.
function setupLiveFixture(target) {
  var players = [
    { id: 'alex', name: 'Alexander Robinson', jersey_number: 8 },
    { id: 'jordan', name: 'Jordan Williams', jersey_number: 12 },
    { id: 'sam', name: 'Samuel Hernandez', jersey_number: 6 },
    { id: 'chris', name: 'Christopher Bennett', jersey_number: 4 },
    { id: 'max', name: 'Max Thompson', jersey_number: 10 },
    { id: 'leo', name: 'Leonardo Martinez', jersey_number: 3 }
  ];
  var game = { id: 'demo', status: 'between_periods', current_period: 2, num_periods: 2, period_duration_minutes: 35, players_per_side: 3, home_score: 1, away_score: 0 };
  var avail = players.map(function(p, i){ return { player_id: p.id, available: true, started: i < 3 }; });
  var fixture = { game: game, players: players, messages: [], offline: false, writes: [], view: { innerHTML: '' } };
  var sequence = 0;
  Object.assign(target, {
    GT: { subs: [], events: [], loaded: {}, clockTimer: 1 },
    gtGame: function(){ return game; }, gtCanEdit: function(){ return true; },
    gtGameAvail: function(){ return avail; }, gtGameAvailEntry: function(gid, pid){ return avail.find(function(a){ return a.player_id === pid; }); },
    gtAvailIds: function(){ return players.map(function(p){ return p.id; }); },
    gtP: function(pid){ return players.find(function(p){ return p.id === pid; }); },
    gtPlayerName: function(pid){ return (target.gtP(pid) || {}).name || ''; },
    gtPlayerShort: function(pid){ return target.gtPlayerName(pid).split(' ')[0]; },
    gtOnField: function(){
      var on = {}; avail.forEach(function(a){ on[a.player_id] = a.started; });
      target.GT.subs.forEach(function(s){ if (s.player_out_id) on[s.player_out_id] = false; if (s.player_in_id) on[s.player_in_id] = true; });
      return on;
    },
    gtPlayerRedInfo: function(){ return null; }, gtLastPosition: function(){ return ''; },
    gtGameSubs: function(){ return target.GT.subs; }, gtGameEvents: function(){ return []; }, gtStatLine: function(){ return {}; },
    gtIsPK: function(){ return false; }, gtIsOT: function(){ return false; }, gtIsGK: function(){ return false; },
    gtLockBanner: function(){ return ''; }, gtGameCanceled: function(){ return false; }, gtClockCollapsed: function(){ return true; },
    gtPeriodLabel: function(){ return '2nd half'; }, gtFmtDisplayClock: function(){ return '35:00'; },
    gtHomeName: function(){ return 'Sample team'; }, gtAwayName: function(){ return 'Visitors'; },
    gtManDownHtml: function(){ return ''; }, gtStartingXiHtml: function(){ return ''; }, gtChatPanelHtml: function(){ return ''; }, gtParentPanelHtml: function(){ return ''; },
    gtClockSeconds: function(){ return 0; }, gtDisplayCumSec: function(){ return 2100; }, gtFmtMMSS: function(){ return '35:00'; },
    gtSubRowText: function(s){ return target.gtPlayerName(s.player_out_id) + ' OFF → ' + target.gtPlayerName(s.player_in_id) + ' ON'; },
    gtEsc: function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); },
    showToast: function(message){ fixture.messages.push(message); },
    firebase: { firestore: { FieldValue: { serverTimestamp: function(){ return 1; } } } },
    tdb: function(collection){ return { doc: function(id){
      id = id || 'swap-' + (++sequence);
      return { id: id,
        set: function(data){
          fixture.writes.push({ collection: collection, id: id, data: data });
          if (fixture.failWrite) return Promise.reject(new Error('Test failure'));
          target.GT.subs.push(Object.assign({ id: id }, data));
          return fixture.offline ? new Promise(function(){}) : Promise.resolve();
        },
        delete: function(){
          fixture.writes.push({ collection: collection, id: id, deleted: true });
          target.GT.subs = target.GT.subs.filter(function(s){ return s.id !== id; });
          return fixture.offline ? new Promise(function(){}) : Promise.resolve();
        }
      };
    } }; },
    gtRerender: function(){
      var view = (target.document && target.document.getElementById('preview-view')) || fixture.view;
      target.gtRenderLive(view, game.id);
      fixture.view = view;
    }
  });
  if (!target.document) target.document = { getElementById: function(){ return null; } };
  return fixture;
}
if (typeof module !== 'undefined') module.exports = setupLiveFixture;
