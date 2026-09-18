function initShop(){
renderTopbar(document.getElementById("topbar-slot"));
renderNavbar(document.getElementById("navbar-slot"),"shop");
const game=Store.getGame();
const ver=(game&&game.config&&game.config.moduleVersions&&game.config.moduleVersions.shop)||"0.b";
document.getElementById("stub-version").textContent="v"+ver;
}
initShop();
