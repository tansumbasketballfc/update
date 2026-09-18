function initTeam(){
renderTopbar(document.getElementById("topbar-slot"));
renderNavbar(document.getElementById("navbar-slot"),"team");
const game=Store.getGame();
const ver=(game&&game.config&&game.config.moduleVersions&&game.config.moduleVersions.team)||"0.b";
document.getElementById("stub-version").textContent="v"+ver;
}
initTeam();
