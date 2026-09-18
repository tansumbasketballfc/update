const Net=(()=>{
let mode="offline";
function init(config){
mode=(config&&config.netMode)||"offline";
return mode;
}
function getMode(){return mode}
async function connectOnline(_serverUrl){
throw new Error("Net.connectOnline not implemented");
}
async function hostLan(){
throw new Error("Net.hostLan not implemented");
}
async function joinLan(_hostAddress){
throw new Error("Net.joinLan not implemented");
}
return{init,getMode,connectOnline,hostLan,joinLan};
})();
