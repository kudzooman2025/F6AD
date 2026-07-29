// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', function() {
  var urlVoter=new URLSearchParams(window.location.search).get('voter');
  if(urlVoter&&urlVoter.trim()&&!getVoterName()) saveVoterName(urlVoter.trim());
  renderVoterBar();
  renderCondNameRow();
  renderCondGrid();
  renderCampGrid();
  renderCoachBar();
  renderSummerOverview();
  startCondListeners();
  renderConfirmedSummer();
  renderSummerGrid();
  // If the default season flipped (e.g. Fall on/after Sep 1), select that tab on load.
  if (typeof activeSeason !== 'undefined' && activeSeason !== 'summer') {
    var _stab = document.getElementById('stab-' + activeSeason);
    if (_stab && typeof switchSeason === 'function') switchSeason(activeSeason, _stab);
  }
  startListeners();
  gtListen();
  window.addEventListener('hashchange', gtRoute);
  gtRoute();
});
