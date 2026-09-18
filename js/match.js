function initMatch(){
renderTopbar(document.getElementById("topbar-slot"));
renderNavbar(document.getElementById("navbar-slot"),"match");
const game=Store.getGame();
const ver=(game&&game.config&&game.config.moduleVersions&&game.config.moduleVersions.match)||"0.b";
document.getElementById("stub-version").textContent="v"+ver;
if(game&&game.config)Net.init(game.config);
}
initMatch();
