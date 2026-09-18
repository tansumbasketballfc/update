const TBFC_CFG={
REMOTE_DATA_URL:"https://tansumbasketballfc.github.io/update/data.json",
ASSET_CACHE_NAME:"tbfc26-ota-assets-update",
ASSET_EXT_RE:/\.(png|webp|jpg|jpeg|gif|mp4|webm|ogg|mp3|wav)(\?.*)?$/i,
IMG_EXT_RE:/\.(png|webp|jpg|jpeg|gif)(\?.*)?$/i,
VIDEO_EXT_RE:/\.(mp4|webm)(\?.*)?$/i,
AUDIO_EXT_RE:/\.(mp3|wav|ogg)(\?.*)?$/i,
PRELOAD_TIMEOUT_MS:20000
};

function tbfcRootPath(){
return location.pathname.includes("/game.funcgines.tbfc.data/")?"../":"./";
}
function localDataUrl(){
return tbfcRootPath()+"asset.funcgines.cloud/data/data.json";
}

const Store=(()=>{
const K={
ver:"tbfc_remote_version",data:"tbfc_remote_data",resetToken:"tbfc_reset_token",
coin:"tbfc_coin",card:"tbfc_card",firstDone:"tbfc_first_done",
gateOnce:"tbfc_gate_once",lastLoadingBg:"tbfc_last_loadingbg",lastGateBg:"tbfc_last_gatebg",
introShown:"tbfc_intro_shown_session"
};
return{
K,
getGame(){try{return JSON.parse(localStorage.getItem(K.data)||"null")}catch(e){return null}},
setGame(obj){localStorage.setItem(K.data,JSON.stringify(obj))},
getVersion(){return localStorage.getItem(K.ver)},
setVersion(v){localStorage.setItem(K.ver,String(v))},
getResetToken(){return localStorage.getItem(K.resetToken)},
setResetToken(v){localStorage.setItem(K.resetToken,String(v))},
getCoin(){return parseInt(localStorage.getItem(K.coin)||"0",10)},
setCoin(v){localStorage.setItem(K.coin,v)},
getCard(){try{return JSON.parse(localStorage.getItem(K.card)||"null")}catch(e){return null}},
setCard(c){localStorage.setItem(K.card,JSON.stringify(c))},
isFirstDone(){return!!localStorage.getItem(K.firstDone)},
setFirstDone(){localStorage.setItem(K.firstDone,"1")},
setTeamSetup(obj){localStorage.setItem("tbfc_team_setup",JSON.stringify(obj))},
getTeamSetup(){try{return JSON.parse(localStorage.getItem("tbfc_team_setup")||"null")}catch(e){return null}},
wipeAll(keepProgress){
const keep={};
if(keepProgress){
keep.coin=localStorage.getItem(K.coin);
keep.card=localStorage.getItem(K.card);
keep.firstDone=localStorage.getItem(K.firstDone);
}
Object.values(K).forEach(k=>{if(k!==K.introShown)localStorage.removeItem(k)});
if(keepProgress){
if(keep.coin!=null)localStorage.setItem(K.coin,keep.coin);
if(keep.card!=null)localStorage.setItem(K.card,keep.card);
if(keep.firstDone!=null)localStorage.setItem(K.firstDone,keep.firstDone);
}
},
introShownThisSession(){return sessionStorage.getItem(K.introShown)==="1"},
setIntroShownThisSession(){sessionStorage.setItem(K.introShown,"1")}
};
})();

const SOUND_FILES={tap:"touch.ogg",select:"select.ogg",reveal:"cam_start.ogg",confirm:"cam_stop.ogg",score:"bock.ogg",sync:"charger_connection.ogg",alert:"tox.ogg"};
const _audioCache={};
function playSound(name){
const file=SOUND_FILES[name];
if(!file)return;
try{
let base=_audioCache[name];
if(!base){base=new Audio(tbfcRootPath()+"asset.funcgines.cloud/sound/"+file);base.preload="auto";_audioCache[name]=base}
const node=base.cloneNode(true);
node.volume=1;
node.play().catch(()=>{});
}catch(e){}
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function collectAssetUrls(obj,out){
out=out||new Set();
if(!obj)return out;
if(typeof obj==="string"){
if(TBFC_CFG.ASSET_EXT_RE.test(obj))out.add(obj);
return out;
}
if(Array.isArray(obj)){obj.forEach(v=>collectAssetUrls(v,out));return out}
if(typeof obj==="object"){Object.values(obj).forEach(v=>collectAssetUrls(v,out));return out}
return out;
}

function isSameOrigin(url){
try{return new URL(url,location.href).origin===location.origin}catch(e){return false}
}

function verifyImageReady(img){
if(!(img.naturalWidth>0&&img.naturalHeight>0))return Promise.resolve(false);
if(typeof img.decode==="function")return img.decode().then(()=>true).catch(()=>true);
return Promise.resolve(true);
}
function verifyVideoReady(v){
return Promise.resolve(v.readyState>=2);
}
function preloadAttempt(url){
return new Promise(resolve=>{
let done=false;
function finish(ok){
if(done)return;
done=true;
clearTimeout(timer);
resolve(ok);
}
const timer=setTimeout(()=>finish(false),TBFC_CFG.PRELOAD_TIMEOUT_MS);
if(TBFC_CFG.IMG_EXT_RE.test(url)){
const img=new Image();
img.onload=()=>verifyImageReady(img).then(finish);
img.onerror=()=>finish(false);
img.src=url;
if(img.complete&&img.naturalWidth>0)verifyImageReady(img).then(finish);
}else if(TBFC_CFG.VIDEO_EXT_RE.test(url)){
const v=document.createElement("video");
v.preload="auto";v.muted=true;v.playsInline=true;
v.oncanplaythrough=()=>verifyVideoReady(v).then(finish);
v.onloadeddata=()=>verifyVideoReady(v).then(finish);
v.onerror=()=>finish(false);
v.src=url;
v.load();
}else if(TBFC_CFG.AUDIO_EXT_RE.test(url)){
const a=new Audio();
a.preload="auto";
a.oncanplaythrough=()=>finish(true);
a.onerror=()=>finish(false);
a.src=url;
a.load();
}else{
fetch(url,{cache:"no-store"}).then(r=>finish(!!r&&r.ok)).catch(()=>{
fetch(url,{cache:"no-store",mode:"no-cors"}).then(()=>finish(true)).catch(()=>finish(false));
});
}
});
}
async function preloadOne(url,attempts){
attempts=attempts||3;
for(let i=0;i<attempts;i++){
const ok=await preloadAttempt(url);
if(ok)return{url,ok:true};
if(i<attempts-1)await sleep(260*(i+1));
}
return{url,ok:false};
}

function backgroundCache(urls){
if(!("caches" in window)||!urls.length)return;
caches.open(TBFC_CFG.ASSET_CACHE_NAME).then(cache=>{
urls.forEach(url=>{
cache.match(url).then(hit=>{
if(hit)return;
const opts=isSameOrigin(url)?{cache:"reload"}:{mode:"no-cors",cache:"no-store"};
fetch(url,opts).then(res=>{cache.put(url,res)}).catch(()=>{});
});
});
}).catch(()=>{});
}

const AssetCache={
async precache(urls,onProgress){
if(!urls.length){if(onProgress)onProgress(0,0,0);return{failed:0,brokenUrls:[]}}
let done=0,failed=0;
const brokenUrls=[];
const okUrls=[];
await Promise.all(urls.map(async url=>{
const res=await preloadOne(url);
if(res.ok)okUrls.push(url);else{failed++;brokenUrls.push(url)}
done++;
if(onProgress)onProgress(done,urls.length,failed);
}));
backgroundCache(okUrls);
return{failed,brokenUrls};
}
};

const DataSync=(()=>{
async function fetchJson(url){
const res=await fetch(url,{cache:"no-store"});
if(!res.ok)throw new Error("bad status "+res.status);
return res.json();
}

async function fetchLocalBundle(){
const merged=await fetchJson(localDataUrl());
merged.version=merged.version||"local";
merged.resetToken=merged.resetToken||"0";
merged.__source="local";
return merged;
}

function collectAssetUrlsFromManifest(manifest){
const set=new Set();
if(manifest&&manifest.critical)manifest.critical.forEach(a=>a.url&&set.add(a.url));
if(manifest&&manifest.lazy)manifest.lazy.forEach(a=>a.url&&set.add(a.url));
return Array.from(set);
}

async function fetchRemoteBundle(onProgress){
if(onProgress)onProgress(10,"กำลังเชื่อมต่อ...");
const merged=await fetchJson(TBFC_CFG.REMOTE_DATA_URL);
if(!merged||typeof merged!=="object"||!Object.keys(merged).length)throw new Error("empty remote data");
if(onProgress)onProgress(20,"ได้รับข้อมูลแล้ว");
const manifest=merged.assetsManifest||null;
const manifestUrls=collectAssetUrlsFromManifest(manifest);
merged.__source="remote";
merged.__dataFailed=0;
merged.__criticalUrls=(manifest&&manifest.critical)?manifest.critical.map(a=>a.url).filter(Boolean):[];
merged.__assetUrls=Array.from(new Set([...collectAssetUrls(merged),...manifestUrls]));
return merged;
}

async function load(){
const cachedVer=Store.getVersion();
const cachedData=Store.getGame();
if(cachedVer&&cachedData)return cachedData;
try{return await fetchRemoteBundle()}
catch(e){try{return await fetchLocalBundle()}catch(e2){return null}}
}

async function syncWithProgress(onProgress){
let bundle,isRemote=false;
try{
bundle=await fetchRemoteBundle((pct,sub)=>{
if(onProgress)onProgress(pct,sub);
});
isRemote=true;
}catch(e){
const cached=Store.getGame();
if(cached){
if(onProgress)onProgress(100,"ใช้ข้อมูลที่มีอยู่ (ออฟไลน์)");
return{bundle:cached,complete:true,offlineFallback:true,isRemote:false};
}
try{
bundle=await fetchLocalBundle();
if(onProgress)onProgress(100,"ออฟไลน์ - ใช้ข้อมูลเริ่มต้น");
return{bundle,complete:true,offlineFallback:true,isRemote:false};
}catch(e2){
if(onProgress)onProgress(100,"ไม่สามารถเชื่อมต่อได้");
return{bundle:null,complete:false,offlineFallback:false,isRemote:false};
}
}
const localResetToken=Store.getResetToken();
if(bundle.resetToken&&localResetToken&&bundle.resetToken!==localResetToken){
const wipePlayer=!!(bundle.config&&bundle.config.wipePlayerProgress);
Store.wipeAll(!wipePlayer);
if("caches" in window){
try{
const keys=await caches.keys();
await Promise.all(keys.map(k=>caches.delete(k)));
}catch(e){}
}
}
const urls=bundle.__assetUrls||Array.from(collectAssetUrls(bundle));
const criticalSet=new Set(bundle.__criticalUrls||[]);
const precacheResult=await AssetCache.precache(urls,(done,total,failed)=>{
const pct=20+Math.round((done/Math.max(total,1))*78);
if(onProgress)onProgress(Math.min(pct,98),`กำลังโหลดทรัพยากร... (${done}/${total})`);
});
if(onProgress)onProgress(99,"กำลังจัดเรียง...");
const dataFailed=bundle.__dataFailed||0;
const assetsFailed=precacheResult.failed||0;
bundle.__brokenUrls=precacheResult.brokenUrls||[];
delete bundle.__assetUrls;
delete bundle.__criticalUrls;
delete bundle.__dataFailed;
const complete=isRemote&&dataFailed===0;
if(bundle.version){
Store.setVersion(bundle.version);
Store.setGame(bundle);
}
if(bundle.resetToken)Store.setResetToken(bundle.resetToken);
if(onProgress)onProgress(100,complete?"พร้อมแล้ว":"โหลดไม่ครบ");
return{bundle,complete,offlineFallback:false,isRemote,dataFailed,assetsFailed,criticalCount:criticalSet.size};
}

return{load,syncWithProgress,fetchRemoteBundle,fetchLocalBundle};
})();

function isUrlBroken(url){
return!!(typeof GAME!=="undefined"&&GAME&&GAME.__brokenUrls&&url&&GAME.__brokenUrls.indexOf(url)!==-1);
}

function setImgWithFallback(imgEl,url,containerEl){
if(!imgEl)return;
if(containerEl)containerEl.classList.remove("imgbroken");
imgEl.onerror=null;
imgEl.onload=null;
if(!url||isUrlBroken(url)){
imgEl.removeAttribute("src");
imgEl.style.display="none";
if(containerEl)containerEl.classList.add("imgbroken");
return;
}
imgEl.style.display="";
imgEl.onload=()=>{imgEl.style.display=""};
imgEl.onerror=()=>{
imgEl.style.display="none";
if(containerEl)containerEl.classList.add("imgbroken");
};
imgEl.src=url;
}

const STAT_LABELS={
shoot:"ยิง",pass:"จ่าย",defense:"ป้องกัน",speed:"ความเร็ว",agility:"ความคล่องตัว",
stamina:"พลังงาน",offenseIQ:"เกมรุก",defenseIQ:"เกมรับ",condition:"สภาพร่างกาย",
jump:"กระโดด",jumpPower:"พลังในการกระโดด",spinMove:"การพลิกตัว",findGap:"การหาช่อง",
powerPass:"การส่งลูกแรง",bouncePass:"การส่งลูกเด้ง",hook:"การฮุค",dribbling:"การเลี้ยงบอล",
block:"การบล็อก",steal:"การขโมยบอล",rebound:"การรีบาวด์",freeThrow:"การยิงโทษ",
midRange:"ยิงกลาง",threePoint:"ยิง 3 แต้ม",closeShot:"ยิงใกล้",layup:"เลย์อัพ",
dunk:"ดังก์",passAccuracy:"ความแม่นยำการส่ง",reaction:"ปฏิกิริยาตอบสนอง",balance:"การทรงตัว",vision:"การมองเกม"
};

const IDENTITY_FIELDS=[
["id","รหัสนักเตะ"],
["nickname","ชื่อเล่น"],
["firstName","ชื่อจริง"],
["lastName","นามสกุล"],
["position","ตำแหน่ง"],
["age","อายุ (ปี)"],
["height","ส่วนสูง (ซ.ม.)"],
["weight","น้ำหนัก (ก.ก.)"]
];

const NAV_ITEMS=[
{id:"team",label:"ทีมของฉัน",page:"team.html",icon:'<path d="M12 2l7 3v6c0 5-3.2 8.4-7 10.5C8.2 19.4 5 16 5 11V5l7-3z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4.5" stroke-linecap="round" stroke-linejoin="round"/>'},
{id:"home",label:"หลัก",page:"home.html",icon:'<path d="M4 11.5 12 5l8 6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8.5" stroke-linecap="round" stroke-linejoin="round"/>'},
{id:"match",label:"แมตช์",page:"match.html",icon:'<rect x="3" y="5" width="18" height="14" rx="1.5"/><line x1="12" y1="5" x2="12" y2="19"/><circle cx="12" cy="12" r="3"/>',fab:true},
{id:"shop",label:"ร้านค้า",page:"shop.html",icon:'<circle cx="12" cy="9.5" r="3.6"/><path d="M4.5 19c1.2-3.4 4-5.2 7.5-5.2s6.3 1.8 7.5 5.2" stroke-linecap="round"/>'}
];

function renderTopbar(mountEl){
if(!mountEl)return;
mountEl.innerHTML=`
<div class="topbar__coin"><span id="tb-coin">${Store.getCoin()}</span> บาท</div>
<div class="topbar__net" id="tb-net"></div>
`;
const netEl=mountEl.querySelector("#tb-net");
function updateNet(){netEl.className="topbar__net "+(navigator.onLine?"online":"offline")}
updateNet();
window.addEventListener("online",updateNet);
window.addEventListener("offline",updateNet);
}

function renderNavbar(mountEl,activeId){
if(!mountEl)return;
mountEl.innerHTML=NAV_ITEMS.map(item=>`
<button class="navbtn ${item.id===activeId?"active":""}" data-page="${item.page}">
${item.fab?`<span class="navbtn__fab"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${item.icon}</svg></span>`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${item.icon}</svg>`}
<span>${item.label}</span>
</button>`).join("");
mountEl.querySelectorAll(".navbtn").forEach(btn=>{
btn.addEventListener("touchstart",()=>btn.classList.add("pressed"),{passive:true});
btn.addEventListener("touchend",()=>btn.classList.remove("pressed"),{passive:true});
btn.addEventListener("click",()=>{
playSound("tap");
const target=btn.dataset.page;
if(activeId&&btn.classList.contains("active"))return;
location.href=target;
});
});
}

function updateBarShow(mountEl){
mountEl.innerHTML=`
<div class="updatebar" id="tbfc-updatebar">
<div class="updatebar__title">กำลังเสาะหาดาวรุ่ง...</div>
<div class="updatebar__sub" id="tbfc-updatebar-sub">กำลังเตรียมความพร้อม...</div>
<div class="updatebar__bar"><div class="updatebar__fill" id="tbfc-updatebar-fill"></div></div>
<div class="updatebar__pct" id="tbfc-updatebar-pct">0%</div>
</div>`;
requestAnimationFrame(()=>mountEl.querySelector(".updatebar").classList.add("show"));
}
function updateBarSet(pct,sub){
const fill=document.getElementById("tbfc-updatebar-fill"),pctEl=document.getElementById("tbfc-updatebar-pct"),subEl=document.getElementById("tbfc-updatebar-sub");
if(fill)fill.style.width=pct+"%";
if(pctEl)pctEl.textContent=pct+"%";
if(subEl&&sub)subEl.textContent=sub;
}
function updateBarHide(){
const el=document.getElementById("tbfc-updatebar");
if(el)el.classList.remove("show");
}

function showInfoModal(mountEl,title,body){
mountEl.innerHTML=`
<div class="modal active" id="tbfc-modal">
<div class="modal__box">
<div class="modal__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13" stroke-linecap="round"/><circle cx="12" cy="16.2" r=".9" fill="currentColor" stroke="none"/></svg></div>
<div class="modal__title">${title}</div>
<p>${body}</p>
<button id="tbfc-modal-close">ตกลง</button>
</div>
</div>`;
mountEl.querySelector("#tbfc-modal-close").onclick=()=>{mountEl.innerHTML=""};
}

function showNeedInternetModal(mountEl,onRetry){
mountEl.innerHTML=`
<div class="modal active" id="tbfc-modal">
<div class="modal__box">
<div class="modal__icon warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8.5c5.5-5 14.5-5 20 0M5.5 12c3.7-3.3 9.3-3.3 13 0M9 15.5c2-1.7 4-1.7 6 0" stroke-linecap="round"/><line x1="3" y1="3" x2="21" y2="21" stroke-linecap="round"/></svg></div>
<div class="modal__title">ต้องเชื่อมต่ออินเทอร์เน็ต</div>
<p>การเข้าใช้งานครั้งแรกต้องเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลและทรัพยากรที่จำเป็นเสมอ กรุณาเปิดใช้งานอินเทอร์เน็ตแล้วลองอีกครั้ง</p>
<button id="tbfc-modal-retry">ลองอีกครั้ง</button>
</div>
</div>`;
mountEl.querySelector("#tbfc-modal-retry").onclick=()=>{
mountEl.innerHTML="";
if(typeof onRetry==="function")onRetry();
};
}

function showLoadIncompleteModal(mountEl,onRetry){
mountEl.innerHTML=`
<div class="modal active" id="tbfc-modal">
<div class="modal__box">
<div class="modal__icon warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13" stroke-linecap="round"/><circle cx="12" cy="16.2" r=".9" fill="currentColor" stroke="none"/></svg></div>
<div class="modal__title">โหลดข้อมูลไม่ครบ</div>
<p>การเชื่อมต่อไม่เสถียรพอให้โหลดข้อมูล กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
<button id="tbfc-modal-retry">ลองอีกครั้ง</button>
</div>
</div>`;
mountEl.querySelector("#tbfc-modal-retry").onclick=()=>{
mountEl.innerHTML="";
if(typeof onRetry==="function")onRetry();
};
}
