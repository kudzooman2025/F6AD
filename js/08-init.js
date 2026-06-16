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
  startListeners();
  window.addEventListener('hashchange', gtRoute);
  gtRoute();
});
