let GAME=null,SELECTEDCARD=null,SELECTEDTEAM=null,SELECTEDLEAGUE=null,gateBusy=false;
document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("dragstart",e=>e.preventDefault());

const GUIDE_ASSETS={
char1:"https://tansumbasketballfc.github.io/update/ui/1_em.webp",
char2:"https://tansumbasketballfc.github.io/update/ui/2_em.webp"
};
function gEl(id){return document.getElementById(id)}
function guideHideAll(){
const layer=gEl("guidelayer");
if(!layer)return;
layer.classList.remove("show");
gEl("guidechar1").classList.remove("show");
gEl("guidechar2").classList.remove("show");
gEl("guidebar").classList.remove("show");
layer.onclick=null;
}
function guideStep(charNum,text,onNext){
const layer=gEl("guidelayer");
layer.classList.add("show");
gEl("guidechar1").classList.toggle("show",charNum===1||charNum===3);
gEl("guidechar2").classList.toggle("show",charNum===2||charNum===3);
gEl("guidetext").textContent=text;
gEl("guidebar").classList.add("show");
layer.onclick=e=>{
e.stopPropagation();
playSound("tap");
if(typeof onNext==="function")onNext();
};
}
function runGuide(steps,onDone){
let i=0;
function next(){
if(i>=steps.length){guideHideAll();if(typeof onDone==="function")onDone();return}
const s=steps[i];i++;
guideStep(s.char,s.text,next);
}
next();
}

function showScreen(id){
document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
document.getElementById(id).classList.add("active");
if(id!=="scr-reveal"){
const layer=document.getElementById("cutoutdrag");
if(layer)layer.classList.remove("show","dragging");
}
guideHideAll();
}

function applyGateBg(url){
if(!url)return;
if(isUrlBroken(url))return;
const bg=document.getElementById("gatebg");
const img=new Image();
img.onload=()=>{bg.style.backgroundImage=`url(${url})`};
img.src=url;
}

function grandFlash(revealFn,durationMs){
return new Promise(resolve=>{
const flash=document.createElement("div");
flash.className="screen flash bigflash active";
flash.style.zIndex="70";
document.getElementById("app").appendChild(flash);
setTimeout(()=>{
if(typeof revealFn==="function")revealFn();
},Math.round((durationMs||900)*0.35));
setTimeout(()=>{
flash.remove();
resolve();
},durationMs||900);
});
}

function playVideoRobust(v,tapBtn,onPlaying){
v.pause();
v.removeAttribute("src");
v.load();
v.playsInline=true;
v.muted=true;
v.defaultMuted=true;
v.setAttribute("muted","");
v.setAttribute("playsinline","");
v.src=v.dataset.src;
v.load();
let started=false,blobTried=false;
function markPlaying(){
if(started)return;
started=true;
v.classList.add("playing");
if(tapBtn)tapBtn.classList.add("hide");
if(typeof onPlaying==="function")onPlaying();
}
v.addEventListener("playing",markPlaying);
v.addEventListener("timeupdate",()=>{if(v.currentTime>0.05)markPlaying()});
function tryBlobFallback(){
if(blobTried||started)return;
blobTried=true;
fetch(v.dataset.src).then(r=>{if(!r.ok)throw new Error("bad status");return r.blob()}).then(blob=>{
if(started)return;
const url=URL.createObjectURL(blob);
v.src=url;
v.load();
v.play().catch(()=>{if(tapBtn)tapBtn.classList.remove("hide")});
}).catch(()=>{if(!started&&tapBtn)tapBtn.classList.remove("hide")});
}
function attemptPlay(){
const p=v.play();
if(p&&typeof p.then==="function"){
p.then(()=>{setTimeout(()=>{if(!started&&v.currentTime>0.05)markPlaying()},250)}).catch(()=>{
if(tapBtn)tapBtn.classList.remove("hide");
});
}
}
if(v.readyState>=2)attemptPlay();
v.addEventListener("canplay",attemptPlay);
v.addEventListener("loadeddata",attemptPlay);
v.addEventListener("error",tryBlobFallback);
setTimeout(()=>{if(!started)attemptPlay()},400);
setTimeout(()=>{if(!started)tryBlobFallback()},1200);
setTimeout(()=>{if(!started&&tapBtn)tapBtn.classList.remove("hide")},1800);
if(tapBtn){
tapBtn.onclick=e=>{
e.stopPropagation();
v.muted=true;
attemptPlay();
tryBlobFallback();
};
}
}

function maybeShowIntro(){
return new Promise(resolve=>{
if(Store.introShownThisSession()){resolve();return}
const v=document.getElementById("introvideo");
const introScr=document.getElementById("scr-intro");
const tapBtn=document.getElementById("introtap");
showScreen("scr-intro");
v.classList.remove("playing");
tapBtn.classList.add("hide");
v.dataset.src=tbfcRootPath()+"asset.funcgines.cloud/video/funcgines_intro.mp4";
let done=false;
function finish(){
if(done)return;
done=true;
Store.setIntroShownThisSession();
resolve();
}
playVideoRobust(v,tapBtn);
v.addEventListener("ended",finish,{once:true});
v.addEventListener("error",finish,{once:true});
introScr.addEventListener("click",e=>{if(e.target===tapBtn)return;finish()},{once:true});
setTimeout(finish,6000);
});
}

function waitForModalRetry(mountEl){
return new Promise(resolve=>{
showLoadIncompleteModal(mountEl,()=>resolve());
});
}

function waitForInternetRetry(mountEl){
return new Promise(resolve=>{
showNeedInternetModal(mountEl,()=>resolve());
});
}

async function ensureSynced(firstEver){
const updateSlot=document.getElementById("updatebar-slot");
const modalSlot=document.getElementById("modal-slot");
for(;;){
updateBarShow(updateSlot);
await sleep(250);
const result=await DataSync.syncWithProgress((pct,sub)=>updateBarSet(pct,sub));
await sleep(300);
updateBarHide();
await sleep(300);
const okForEntry=firstEver?(result.isRemote===true):(result.complete||result.bundle);
if(okForEntry)return result;
if(!navigator.onLine||!result.bundle&&!result.isRemote){
await waitForInternetRetry(modalSlot);
}else{
await waitForModalRetry(modalSlot);
}
}
}

async function boot(){
await maybeShowIntro();
showScreen("scr-loading");
const cached=Store.getGame();
if(cached&&cached.gateBg)applyGateBg(cached.gateBg);
GAME=cached||null;
const firstEver=!Store.isFirstDone();
const result=await ensureSynced(firstEver);
if(result.bundle)GAME=result.bundle;
if(GAME&&GAME.gateBg)applyGateBg(GAME.gateBg);
if(GAME&&GAME.config)Net.init(GAME.config);
await grandFlash(()=>showScreen("scr-gate"),950);
document.getElementById("gateenter").classList.remove("hide","pressed");
}

document.getElementById("gateenter").addEventListener("touchstart",function(){this.classList.add("pressed")},{passive:true});
document.getElementById("gateenter").addEventListener("touchend",function(){this.classList.remove("pressed")},{passive:true});
document.getElementById("gateenter").onclick=onGateEnter;

async function onGateEnter(){
if(gateBusy)return;
gateBusy=true;
playSound("tap");
gateBusy=false;
leaveGate();
}

function leaveGate(){
const gate=document.getElementById("scr-gate");
gate.classList.add("leaving");
setTimeout(()=>{
gate.classList.remove("leaving");
afterGate();
},1050);
}

function isOnboardingValid(){
if(!Store.isFirstDone())return true;
const setup=Store.getTeamSetup&&Store.getTeamSetup();
if(!setup||!setup.team||!setup.team.name)return false;
if(setup.team.isCustom&&!setup.team.logo)return false;
if(!setup.playerName)return false;
return true;
}

function playCorruptGlitch(cb){
const flash=document.createElement("div");
flash.className="glitchflash";
document.getElementById("app").appendChild(flash);
setTimeout(()=>{
flash.remove();
if(typeof cb==="function")cb();
},650);
}

function afterGate(){
if(!Store.isFirstDone()){
prepareAndPlayPromo();
}else if(!isOnboardingValid()){
Store.resetOnboarding&&Store.resetOnboarding();
playCorruptGlitch(prepareAndPlayPromo);
}else{
goHome();
}
}

function goHome(){
location.href="game.funcgines.tbfc.data/home.html";
}

async function prepareAndPlayPromo(){
const v=document.getElementById("promovideo");
v.dataset.src=tbfcRootPath()+"asset.funcgines.cloud/video/firsttimepromo.mp4";
v.classList.remove("playing");
showFlashThenPromo(v);
}

function showFlashThenPromo(v){
const promo=document.getElementById("scr-promo");
showScreen("scr-promo");
const flash=document.createElement("div");
flash.className="screen flash active";
promo.after(flash);
promo.style.opacity="0";
setTimeout(()=>{
flash.remove();
promo.style.opacity="";
playPromo(v);
},1100);
}

function playPromo(v){
const promoScr=document.getElementById("scr-promo"),skipBtn=document.getElementById("promoskip"),flashEl=document.getElementById("skipflash"),tapBtn=document.getElementById("promotap");
let finished=false,skipRevealed=false;
tapBtn.classList.add("hide");
function finishPromo(){
if(finished)return;
finished=true;
Store.setFirstDone();
showCardPicker();
}
function revealSkip(){
if(skipRevealed)return;
skipRevealed=true;
playSound("tap");
skipBtn.classList.add("show");
}
playVideoRobust(v,tapBtn,revealSkip);
promoScr.addEventListener("touchstart",revealSkip,{passive:true});
promoScr.addEventListener("click",revealSkip);
v.addEventListener("ended",finishPromo);
v.addEventListener("error",()=>{revealSkip()});
setTimeout(revealSkip,4500);
skipBtn.onclick=e=>{
e.stopPropagation();
flashEl.classList.add("go");
playSound("confirm");
setTimeout(finishPromo,420);
};
}

function cardOvr(c){
if(c.ovr)return c.ovr;
const s=c.stats||{};
return Math.round(((s.shoot||0)+(s.pass||0)+(s.defense||0)+(s.speed||0))/4);
}
function showCardPicker(){
showScreen("scr-picker");
gEl("guidechar1").src=GUIDE_ASSETS.char1;
gEl("guidechar2").src=GUIDE_ASSETS.char2;
runGuide([
{char:1,text:"ยินดีต้อนรับผู้เล่นครับ"},
{char:2,text:"ไงยินดีต้อนรับเช่นกัน เรามาเลือกการ์ด 1 ใน 3 นี้กัน"}
]);
const cards=(GAME&&GAME.starterCards)||[];
const list=document.getElementById("pickerlist");
list.innerHTML="";
const confirmBtn=document.getElementById("pickerconfirm");
let picked=cards[0]||null;
confirmBtn.classList.toggle("ready",!!picked);
cards.forEach((c,i)=>{
const el=document.createElement("div");
el.className="pcard cardin"+(i===0?" selected":"");
el.style.animationDelay=(i*90)+"ms";
const art=document.createElement("div");
art.className="pcard__art";
const bgImg=document.createElement("img");
bgImg.className="bg";
const cutoutImg=document.createElement("img");
cutoutImg.className="cutout";
art.appendChild(bgImg);
if(c.cutout)art.appendChild(cutoutImg);
el.appendChild(art);
setImgWithFallback(bgImg,c.bg||c.img||"",art);
if(c.cutout)setImgWithFallback(cutoutImg,c.cutout,art);
el.insertAdjacentHTML("beforeend",`
<div class="pcard__ovr"><span>OVR</span><b>${cardOvr(c)}</b></div>
<div class="pcard__name">${c.name||""}</div>
`);
el.onclick=()=>{
playSound("select");
document.querySelectorAll(".pcard").forEach(p=>p.classList.remove("selected"));
el.classList.add("selected");
picked=c;
confirmBtn.classList.add("ready");
};
list.appendChild(el);
});
confirmBtn.onclick=()=>{
if(!picked)return;
playSound("confirm");
SELECTEDCARD=picked;
Store.setCard(picked);
showReveal(picked);
};
}

let panelOpened=false,cardState="named";
const cutoutFree={active:false,x:0,y:0,justDragged:false};
function updateCardFace(){
const cardEl=document.getElementById("revealcard");
cardEl.classList.toggle("state-clean",cardState==="clean");
cardEl.classList.toggle("state-cutout",cardState==="cutout");
document.getElementById("revealbadge").classList.toggle("show",panelOpened&&cardState==="named");
syncCutoutDrag();
}
function resetCutoutDrag(){
cutoutFree.active=false;
cutoutFree.x=0;
cutoutFree.y=0;
const layer=document.getElementById("cutoutdrag");
layer.classList.remove("show","dragging");
document.getElementById("revealcard").classList.remove("floatactive");
}
function syncCutoutDrag(){
const layer=document.getElementById("cutoutdrag");
const cardImg=document.getElementById("revealcutout");
if(cardState!=="cutout"&&!cutoutFree.active)return;
if(!cutoutFree.active&&cardState==="cutout"){
const rect=cardImg.getBoundingClientRect();
if(rect.width>0){
cutoutFree.x=rect.left;
cutoutFree.y=rect.top;
layer.style.width=rect.width+"px";
layer.style.height=rect.height+"px";
}
}
layer.style.transform=`translate(${cutoutFree.x}px,${cutoutFree.y}px)`;
layer.classList.add("show");
layer.classList.toggle("draggable",cardState==="cutout");
document.getElementById("revealcard").classList.add("floatactive");
}
function initCutoutDrag(){
const layer=document.getElementById("cutoutdrag");
let dragging=false,startX=0,startY=0,baseX=0,baseY=0,moved=false;
layer.addEventListener("pointerdown",e=>{
if(cardState!=="cutout")return;
dragging=true;
moved=false;
startX=e.clientX;
startY=e.clientY;
baseX=cutoutFree.x;
baseY=cutoutFree.y;
layer.classList.add("dragging");
layer.setPointerCapture(e.pointerId);
});
layer.addEventListener("pointermove",e=>{
if(!dragging)return;
const dx=e.clientX-startX,dy=e.clientY-startY;
if(Math.abs(dx)>4||Math.abs(dy)>4)moved=true;
const w=layer.offsetWidth,h=layer.offsetHeight;
cutoutFree.x=Math.min(Math.max(baseX+dx,-w*0.3),window.innerWidth-w*0.7);
cutoutFree.y=Math.min(Math.max(baseY+dy,-h*0.3),window.innerHeight-h*0.7);
layer.style.transform=`translate(${cutoutFree.x}px,${cutoutFree.y}px)`;
});
function endDrag(e){
if(!dragging)return;
dragging=false;
layer.classList.remove("dragging");
if(moved){
cutoutFree.active=true;
cutoutFree.justDragged=true;
setTimeout(()=>{cutoutFree.justDragged=false},50);
}
}
layer.addEventListener("pointerup",endDrag);
layer.addEventListener("pointercancel",endDrag);
layer.addEventListener("click",e=>{
if(cutoutFree.justDragged){e.stopPropagation();return}
if(cardState==="cutout"){e.stopPropagation();cardState="named";updateCardFace();playSound("select")}
});
}
function onRevealCardTap(){
if(cutoutFree.justDragged)return;
if(!panelOpened){
panelOpened=true;
cardState="named";
document.getElementById("revealarea").classList.add("panelopen");
document.getElementById("revealname").classList.remove("show");
document.getElementById("revealovr").classList.remove("show");
updateCardFace();
populatePanel(SELECTEDCARD);
playSound("select");
runGuide([
{char:2,text:"ลองดูสถิติของนักบาสดีคุณเลือกนะ ดูดีเลยหล่ะ"},
{char:2,text:"คุณสามารถกดที่ตัวการ์ดเพื่อดูนักบาสได้หลากหลายมุมมอง และสามารถเคลื่อนย้ายนักบาสของคุณให้ปั่นป่วนได้"}
]);
return;
}
cardState=cardState==="named"?"clean":cardState==="clean"?"cutout":"named";
updateCardFace();
playSound(cardState==="cutout"?"confirm":cardState==="clean"?"tap":"select");
}
function populatePanel(card){
document.getElementById("panelname").textContent=card.name||"";
document.getElementById("panelsub").textContent=[card.position,card.rarity].filter(Boolean).join(" · ");
const idRows=IDENTITY_FIELDS.filter(([key])=>card[key]!=null&&card[key]!=="").map(([key,label])=>[label,card[key]]);
document.getElementById("panelidgrid").innerHTML=idRows.map(([label,value],i)=>`<div class="reveal__inforow" style="animation-delay:${i*40}ms"><span>${label}</span><b>${value}</b></div>`).join("");
const stats=card.stats||{};
const attrs=card.attributes||{};
const ovr=card.ovr||Math.round(((stats.shoot||0)+(stats.pass||0)+(stats.defense||0)+(stats.speed||0))/4);
const rows=[["OVR",ovr]];
Object.keys(stats).forEach(k=>rows.push([STAT_LABELS[k]||k,stats[k]]));
Object.keys(attrs).forEach(k=>rows.push([STAT_LABELS[k]||k,attrs[k]]));
document.getElementById("panelstatgrid").innerHTML=rows.map(([label,value],i)=>`<div class="reveal__statrow" style="animation-delay:${(idRows.length+i)*40}ms"><span>${label}</span><b>${value}</b></div>`).join("");
document.getElementById("panelskills").innerHTML=(card.skills||[]).map(s=>`<span class="reveal__skillchip">${s}</span>`).join("");
}
function showReveal(card){
showScreen("scr-reveal");
const cardEl=document.getElementById("revealcard"),nameEl=document.getElementById("revealname"),ovrEl=document.getElementById("revealovr"),confirmEl=document.getElementById("revealconfirm"),badge=document.getElementById("revealbadge");
cardEl.classList.remove("fly");
void cardEl.offsetWidth;
const frontSide=document.getElementById("revealbg").closest(".reveal__side");
const backSide=document.getElementById("revealbgback").closest(".reveal__side");
setImgWithFallback(document.getElementById("revealbg"),card.bg||card.img||"",frontSide);
setImgWithFallback(document.getElementById("revealcutout"),card.cutout||"",frontSide);
setImgWithFallback(document.getElementById("revealbgback"),card.bg||card.img||"",backSide);
setImgWithFallback(document.getElementById("revealcleancutout"),card.cutout||"",backSide);
nameEl.textContent=card.name;
const ovr=card.ovr||Math.round(((card.stats.shoot||0)+(card.stats.pass||0)+(card.stats.defense||0)+(card.stats.speed||0))/4);
ovrEl.textContent="OVR "+ovr;
document.getElementById("revealbadgename").textContent=card.name;
document.getElementById("revealbadgeovr").textContent="OVR "+ovr;
panelOpened=false;
cardState="named";
document.getElementById("revealarea").classList.remove("panelopen");
cardEl.classList.remove("state-clean","state-cutout");
badge.classList.remove("show");
nameEl.classList.remove("show");
ovrEl.classList.remove("show");
confirmEl.classList.remove("show");
playSound("reveal");
cardEl.classList.add("fly");
setTimeout(()=>{
nameEl.classList.add("show");
ovrEl.classList.add("show");
confirmEl.classList.add("show");
badge.classList.add("show");
runGuide([{char:1,text:"ว้าว คุณเลือกได้ดีมาก เราลองมาทำความรู้จักนักบาสคนนี้กันเถอะ โดยการกดที่ตัวการ์ด"}]);
},500);
cardEl.onclick=onRevealCardTap;
resetCutoutDrag();
document.getElementById("cutoutdragimg").src=card.cutout||"";
confirmEl.onclick=()=>{
playSound("confirm");
showLeague();
};
}

let leagueIndex=0,leagueTeamPicked=null,leagueStatusTimer=null,leagueRetryBusy=false;
const railDrag={active:false,startY:0,startX:0,moved:false,pid:null,pointerType:null};
const LEAGUE_STATUS_MSGS=["กำลังเสาะหาดาวรุ่ง...","กำลังวอร์มอัฟ...","กำลังจัดสรรทีม...","กำลังเช็คสภาพสนาม...","กำลังปรับสมดุลทีม...","กำลังโหลดข้อมูลนักบาส...","กำลังตรวจสอบสัญญาทีม...","กำลังจัดคิวผู้เล่น...","กำลังเช็คโลโก้ทีม...","กำลังปัดฝุ่นสนาม...","กำลังคำนวณฟอร์มทีม...","กำลังซิงค์ข้อมูลลีก...","กำลังจัดแสงในสนาม...","กำลังนับถอยหลังเกมส์...","กำลังเตรียมทีมในตำนาน...","กำลังปลุกพลังนักบาส..."];
function startLeagueStatusTicker(){
stopLeagueStatusTicker();
const el=gEl("leaguestatustext");
if(!el)return;
let idx=0;
function tick(){
el.classList.remove("fadein");
void el.offsetWidth;
el.textContent=LEAGUE_STATUS_MSGS[idx%LEAGUE_STATUS_MSGS.length];
el.classList.add("fadein");
idx++;
}
tick();
leagueStatusTimer=setInterval(tick,2400);
}
function stopLeagueStatusTicker(){
if(leagueStatusTimer){clearInterval(leagueStatusTimer);leagueStatusTimer=null}
}
function playLeagueWipe(onMid){
const wipe=gEl("leaguewipe");
if(!wipe){onMid();return}
wipe.classList.remove("play");
void wipe.offsetWidth;
wipe.classList.add("play");
setTimeout(onMid,240);
setTimeout(()=>wipe.classList.remove("play"),680);
}
function selectLeague(i){
const leagues=(GAME&&GAME.leagues)||[];
if(!leagues.length)return;
i=((i%leagues.length)+leagues.length)%leagues.length;
if(i===leagueIndex)return;
leagueIndex=i;
playSound("select");
playLeagueWipe(()=>{
renderLeagueRail();
renderLeagueTeams();
});
}
function getLeagues(){return(GAME&&Array.isArray(GAME.leagues))?GAME.leagues:[]}
function wireLeagueRailSwipe(){
const rail=gEl("leaguerail");
if(!rail||rail.dataset.swipeWired)return;
rail.dataset.swipeWired="1";
rail.style.touchAction="none";
function start(x,y){
railDrag.active=true;
railDrag.moved=false;
railDrag.startY=y;
railDrag.startX=x;
}
function move(x,y){
if(!railDrag.active)return;
const dy=y-railDrag.startY,dx=x-railDrag.startX;
if(Math.abs(dy)>10||Math.abs(dx)>10)railDrag.moved=true;
}
function end(y){
if(!railDrag.active)return;
railDrag.active=false;
const dy=y-railDrag.startY;
const leagues=getLeagues();
if(Math.abs(dy)>32&&leagues.length>1){
const dir=dy<0?1:-1;
selectLeague(leagueIndex+dir);
}
}
rail.addEventListener("pointerdown",e=>{railDrag.pointerType=e.pointerType;start(e.clientX,e.clientY);try{rail.setPointerCapture(e.pointerId)}catch(err){}});
rail.addEventListener("pointermove",e=>{if(railDrag.pointerType==="touch")return;move(e.clientX,e.clientY)});
rail.addEventListener("pointerup",e=>{if(railDrag.pointerType==="touch")return;end(e.clientY)});
rail.addEventListener("pointercancel",()=>{railDrag.active=false});
rail.addEventListener("touchstart",e=>{const t=e.touches[0];if(t)start(t.clientX,t.clientY)},{passive:true});
rail.addEventListener("touchmove",e=>{const t=e.touches[0];if(t)move(t.clientX,t.clientY)},{passive:true});
rail.addEventListener("touchend",e=>{const t=e.changedTouches[0];if(t)end(t.clientY)},{passive:true});
rail.addEventListener("click",e=>{
if(railDrag.moved){e.stopPropagation();e.preventDefault();railDrag.moved=false}
},true);
let wheelLock=false;
rail.addEventListener("wheel",e=>{
if(wheelLock)return;
const leagues=getLeagues();
if(leagues.length<=1)return;
wheelLock=true;
selectLeague(leagueIndex+(e.deltaY>0?1:-1));
setTimeout(()=>{wheelLock=false},260);
},{passive:true});
}
function wireLeagueArrows(){
const up=gEl("leaguenavup"),down=gEl("leaguenavdown");
if(up&&!up.dataset.wired){
up.dataset.wired="1";
up.onclick=()=>{playSound("tap");selectLeague(leagueIndex-1)};
}
if(down&&!down.dataset.wired){
down.dataset.wired="1";
down.onclick=()=>{playSound("tap");selectLeague(leagueIndex+1)};
}
}
function wireTeamCardTilt(el){
if(!el||el.dataset.tiltWired)return;
el.dataset.tiltWired="1";
function apply(clientX,clientY){
const r=el.getBoundingClientRect();
const px=(clientX-r.left)/r.width-0.5,py=(clientY-r.top)/r.height-0.5;
el.style.transform=`perspective(600px) rotateX(${(-py*10).toFixed(2)}deg) rotateY(${(px*10).toFixed(2)}deg)`;
}
function reset(){el.style.transform=""}
el.addEventListener("pointermove",e=>{if(e.pointerType==="mouse")apply(e.clientX,e.clientY)});
el.addEventListener("pointerleave",reset);
el.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse")apply(e.clientX,e.clientY)});
el.addEventListener("pointerup",reset);
el.addEventListener("pointercancel",reset);
}
function wireLeagueBgParallax(){
const stage=gEl("scr-league");
if(!stage||stage.dataset.parallaxWired)return;
stage.dataset.parallaxWired="1";
stage.addEventListener("pointermove",e=>{
if(e.pointerType!=="mouse")return;
const px=(e.clientX/window.innerWidth-0.5)*10,py=(e.clientY/window.innerHeight-0.5)*10;
["leaguebg","leaguebgnext"].forEach(id=>{
const el=gEl(id);
if(el)el.style.transform=`scale(1.08) translate(${px}px,${py}px)`;
});
});
}
function setBgRobust(el,url,fallbackUrl){
if(!el)return;
const useUrl=url||fallbackUrl;
if(!useUrl)return;
const img=new Image();
img.onload=()=>{el.style.backgroundImage=`url(${useUrl})`};
img.onerror=()=>{if(fallbackUrl&&fallbackUrl!==useUrl)el.style.backgroundImage=`url(${fallbackUrl})`};
img.src=useUrl;
}
function crossfadeLeagueBg(url){
const cur=gEl("leaguebg"),next=gEl("leaguebgnext");
const fallback=(GAME&&GAME.loadingBg)||"";
const useUrl=url||fallback;
if(!cur||!next||!useUrl)return;
if(!cur.style.backgroundImage||cur.style.backgroundImage==="none"){
cur.style.backgroundImage=`url(${useUrl})`;
}
next.style.backgroundImage=`url(${useUrl})`;
next.classList.add("show");
cur.classList.remove("punch");
next.classList.remove("punch");
void next.offsetWidth;
cur.classList.add("punch");
next.classList.add("punch");
setTimeout(()=>{
cur.style.backgroundImage=`url(${useUrl})`;
next.classList.remove("show");
},420);
setTimeout(()=>{cur.classList.remove("punch");next.classList.remove("punch")},560);
}
function renderLeagueRail(){
const rail=gEl("leaguerail");
if(!rail)return;
const leagues=getLeagues();
rail.innerHTML="";
leagues.forEach((lg,i)=>{
const el=document.createElement("div");
el.className="league__railitem"+(i===leagueIndex?" active pop":"");
const img=document.createElement("img");
setImgWithFallback(img,lg.icon||lg.bg||"",el);
el.appendChild(img);
el.onclick=()=>selectLeague(i);
rail.appendChild(el);
});
const idxEl=gEl("leaguerailindex");
if(idxEl){
idxEl.textContent=leagues.length?`${leagueIndex+1}/${leagues.length}`:"";
idxEl.classList.remove("tick");
void idxEl.offsetWidth;
idxEl.classList.add("tick");
}
rail.classList.toggle("swipeable",leagues.length>1);
const up=gEl("leaguenavup"),down=gEl("leaguenavdown");
if(up)up.classList.toggle("hide",leagues.length<=1);
if(down)down.classList.toggle("hide",leagues.length<=1);
const nameEl=gEl("leaguename");
if(nameEl){
const lg=leagues[leagueIndex];
nameEl.textContent=lg?(lg.name||""):"";
nameEl.classList.remove("swapping");
void nameEl.offsetWidth;
nameEl.classList.add("swapping");
}
}
function burstSparkle(cardEl,count){
const n=count||7;
for(let i=0;i<n;i++){
const s=document.createElement("i");
s.className="league__sparkle";
const ang=Math.random()*360,dist=26+Math.random()*30;
s.style.setProperty("--ang",ang+"deg");
s.style.setProperty("--dist",dist+"px");
s.style.left="50%";
s.style.top="50%";
s.style.animationDelay=(Math.random()*80)+"ms";
cardEl.appendChild(s);
setTimeout(()=>{if(s.parentNode)s.parentNode.removeChild(s)},900);
}
}
function wireCardIdleSparkle(el){
if(el.dataset.idleSparkle)return;
el.dataset.idleSparkle="1";
const timer=setInterval(()=>{
if(!el.classList.contains("selected")||!el.isConnected){clearInterval(timer);return}
burstSparkle(el,1);
},650);
}
function letterSpanify(text){
return text.split("").map((ch,i)=>`<span class="league__teamnamechar" style="animation-delay:${i*28}ms">${ch===" "?"&nbsp;":ch}</span>`).join("");
}
function renderLeagueTeams(){
const leagues=getLeagues();
const lg=leagues[leagueIndex];
const wrap=gEl("leagueteams");
if(!lg||!wrap)return;
wrap.classList.remove("sweepin");
void wrap.offsetWidth;
wrap.classList.add("sweepin");
wrap.innerHTML="";
const teams=lg.teams||[];
leagueTeamPicked=teams[0]||null;
crossfadeLeagueBg((leagueTeamPicked&&leagueTeamPicked.bg)||lg.bg);
const confirmBtn=gEl("leagueconfirm");
if(confirmBtn)confirmBtn.classList.toggle("ready",!!leagueTeamPicked);
teams.forEach((t,i)=>{
const el=document.createElement("div");
el.className="league__teamcard"+(i===0?" selected":"");
el.style.animationDelay=(i*60)+"ms";
el.style.setProperty("--teamcolor",t.themeColor||"#ff8a3d");
const logoWrap=document.createElement("div");
logoWrap.className="league__teamlogo loading"+(t.isCreate?" iscreate":"");
const img=document.createElement("img");
img.addEventListener("load",()=>logoWrap.classList.remove("loading"),{once:true});
img.addEventListener("error",()=>logoWrap.classList.remove("loading"),{once:true});
setImgWithFallback(img,t.logo||"",logoWrap);
logoWrap.appendChild(img);
el.appendChild(logoWrap);
el.insertAdjacentHTML("beforeend",`<div class="league__teamname">${letterSpanify(t.name||"")}</div>`);
el.onclick=()=>{
playSound("select");
wrap.querySelectorAll(".league__teamcard").forEach(p=>p.classList.remove("selected"));
el.classList.add("selected");
leagueTeamPicked=t;
crossfadeLeagueBg(t.bg||lg.bg);
burstSparkle(el,9);
wireCardIdleSparkle(el);
if(confirmBtn)confirmBtn.classList.add("ready");
};
wireTeamCardTilt(el);
if(i===0)wireCardIdleSparkle(el);
wrap.appendChild(el);
});
}
function setLeagueEmptyState(show){
const empty=gEl("leagueempty");
const rail=gEl("leaguerail");
const teams=gEl("leagueteams");
if(!empty)return;
empty.classList.toggle("show",!!show);
if(rail)rail.classList.toggle("hide",!!show);
if(teams)teams.classList.toggle("hide",!!show);
}
async function retryLeagueLoad(){
if(leagueRetryBusy)return;
leagueRetryBusy=true;
const retryBtn=gEl("leagueretrybtn");
if(retryBtn)retryBtn.classList.add("busy");
try{
const result=await DataSync.syncWithProgress(()=>{});
if(result&&result.bundle)GAME=result.bundle;
}catch(e){}
leagueRetryBusy=false;
if(retryBtn)retryBtn.classList.remove("busy");
renderLeagueScreen();
}
function renderLeagueScreen(){
const leagues=getLeagues();
if(!leagues.length){
setLeagueEmptyState(true);
return;
}
setLeagueEmptyState(false);
if(leagueIndex>=leagues.length)leagueIndex=0;
renderLeagueRail();
renderLeagueTeams();
}
function showLeague(){
showScreen("scr-league");
const stage=gEl("scr-league");
if(stage){
stage.classList.remove("enter");
void stage.offsetWidth;
stage.classList.add("enter");
}
leagueIndex=0;
renderLeagueScreen();
wireLeagueRailSwipe();
wireLeagueArrows();
wireLeagueBgParallax();
spawnParticles("leagueparticles",14);
startLeagueStatusTicker();
const retryBtn=gEl("leagueretrybtn");
if(retryBtn&&!retryBtn.dataset.wired){
retryBtn.dataset.wired="1";
retryBtn.onclick=()=>{playSound("tap");retryLeagueLoad()};
}
if(!getLeagues().length)retryLeagueLoad();
wireRipple(gEl("leagueconfirm"));
gEl("leagueconfirm").onclick=()=>{
if(!leagueTeamPicked)return;
stopLeagueStatusTicker();
playSound("confirm");
const leagues=getLeagues();
SELECTEDLEAGUE=leagues[leagueIndex]||null;
if(leagueTeamPicked.isCreate){
showTeamCreate();
}else{
SELECTEDTEAM=leagueTeamPicked;
Store.setTeamSetup&&Store.setTeamSetup({league:SELECTEDLEAGUE&&SELECTEDLEAGUE.id,team:SELECTEDTEAM});
showName();
}
};
runGuide([{char:1,text:"เรามาเลือกทีมกันเถอะ เลือกทีมที่ใช่ของคุณจากลีก Tansum Basketball League แล้วกดยืนยันได้เลย"}]);
}

function spawnParticles(containerId,count){
const wrap=gEl(containerId);
if(!wrap)return;
wrap.innerHTML="";
for(let i=0;i<count;i++){
const p=document.createElement("i");
p.className="particle";
p.style.left=Math.random()*100+"%";
p.style.animationDuration=(6+Math.random()*7)+"s";
p.style.animationDelay=(-Math.random()*10)+"s";
p.style.setProperty("--drift",(Math.random()*60-30)+"px");
p.style.width=p.style.height=(2+Math.random()*4)+"px";
wrap.appendChild(p);
}
}
function shakeEl(el){
el.classList.remove("shake");
void el.offsetWidth;
el.classList.add("shake");
}
let teamLogoDataUrl=null;
function showTeamCreate(){
stopLeagueStatusTicker();
showScreen("scr-teamcreate");
teamLogoDataUrl=null;
gEl("teamcreatelogoimg").removeAttribute("src");
gEl("teamcreatelogoimg").classList.remove("show");
gEl("teamcreatelogoplus").classList.remove("hide");
gEl("teamcreatelogo").classList.remove("filled");
gEl("teamcreatename").value="";
gEl("teamcreateabbr").value="";
gEl("teamcreateerr").textContent="";
const teamcreatebg=gEl("teamcreatebg");
if(teamcreatebg&&SELECTEDLEAGUE)teamcreatebg.style.backgroundImage=`url(${SELECTEDLEAGUE.bg||""})`;
spawnParticles("teamcreateparticles",16);
const fileInput=gEl("teamcreatefile");
gEl("teamcreatelogo").onclick=()=>fileInput.click();
fileInput.onchange=()=>{
const file=fileInput.files&&fileInput.files[0];
if(!file)return;
const img=new Image();
const url=URL.createObjectURL(file);
img.onload=()=>{
if(img.naturalWidth!==512||img.naturalHeight!==512){
gEl("teamcreateerr").textContent="ไอคอนทีมต้องมีขนาด 512×512 พิกเซลเท่านั้น กรุณาเลือกไฟล์ใหม่";
playSound("alert");
URL.revokeObjectURL(url);
return;
}
teamLogoDataUrl=url;
gEl("teamcreatelogoimg").src=url;
gEl("teamcreatelogoimg").classList.add("show");
gEl("teamcreatelogoplus").classList.add("hide");
gEl("teamcreatelogo").classList.add("filled");
gEl("teamcreateerr").textContent="";
playSound("select");
};
img.onerror=()=>{gEl("teamcreateerr").textContent="ไม่สามารถอ่านไฟล์รูปนี้ได้"};
img.src=url;
};
gEl("teamcreateabbr").oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)};
gEl("teamcreatename").oninput=e=>{e.target.value=e.target.value.replace(/[^A-Za-z_ ]/g,"")};
gEl("teamcreateconfirm").onclick=()=>{
const name=gEl("teamcreatename").value.trim();
const abbr=gEl("teamcreateabbr").value.trim();
const letters=(name.match(/[A-Za-z]/g)||[]).length;
if(!teamLogoDataUrl){
gEl("teamcreateerr").textContent="กรุณาอัปโหลดโลโก้ทีมก่อน จะไปต่อไม่ได้ถ้ายังไม่มีโลโก้";
playSound("alert");
shakeEl(gEl("teamcreatelogo"));
return;
}
if(letters<3||name.length>12){
gEl("teamcreateerr").textContent="ชื่อทีมต้องมีตัวอักษรอังกฤษอย่างน้อย 3 ตัว และยาวไม่เกิน 12 ตัวอักษร";
playSound("alert");
shakeEl(gEl("teamcreatename"));
return;
}
if(abbr.length!==3){
gEl("teamcreateerr").textContent="ชื่อย่อทีมต้องเป็นตัวอักษรอังกฤษพิมพ์ใหญ่ 3 ตัว";
playSound("alert");
shakeEl(gEl("teamcreateabbr"));
return;
}
playSound("confirm");
SELECTEDTEAM={id:"custom_"+Date.now(),name,abbr,logo:teamLogoDataUrl||"",isCustom:true};
Store.setTeamSetup&&Store.setTeamSetup({league:SELECTEDLEAGUE&&SELECTEDLEAGUE.id,team:SELECTEDTEAM});
showName();
};
}

function wireRipple(btn){
if(!btn||btn.dataset.rippleWired)return;
btn.dataset.rippleWired="1";
btn.addEventListener("pointerdown",e=>{
const r=btn.getBoundingClientRect();
const s=document.createElement("span");
s.className="btnripple";
s.style.left=(e.clientX-r.left)+"px";
s.style.top=(e.clientY-r.top)+"px";
btn.appendChild(s);
setTimeout(()=>{if(s.parentNode)s.parentNode.removeChild(s)},650);
});
}
function showName(){
stopLeagueStatusTicker();
showScreen("scr-name");
const namebg=gEl("namebg");
const fallbackBg=(GAME&&GAME.loadingBg)||"";
setBgRobust(namebg,(SELECTEDTEAM&&SELECTEDTEAM.bg)||(SELECTEDLEAGUE&&SELECTEDLEAGUE.bg),fallbackBg);
spawnParticles("namepageparticles",16);
gEl("playername").value="";
gEl("namepageerr").textContent="";
gEl("playername").oninput=e=>{e.target.value=e.target.value.replace(/[^A-Za-z0-9_-]/g,"").slice(0,12)};
wireRipple(gEl("namepageconfirm"));
gEl("namepageconfirm").onclick=()=>{
const name=gEl("playername").value.trim();
if(!name||name.length>12){
gEl("namepageerr").textContent="กรุณาตั้งชื่อ ไม่เกิน 12 ตัวอักษร";
playSound("alert");
shakeEl(gEl("playername"));
return;
}
playSound("confirm");
const btn=gEl("namepageconfirm");
btn.classList.add("success");
Store.setFirstDone&&Store.setFirstDone();
const setup=(Store.getTeamSetup&&Store.getTeamSetup())||{};
setup.playerName=name;
Store.setTeamSetup&&Store.setTeamSetup(setup);
setTimeout(()=>goHome(),360);
};
runGuide([{char:3,text:"เรามาทำความรู้จักกันเถอะนะ"}]);
}

initCutoutDrag();
gEl("guidechar1").src=GUIDE_ASSETS.char1;
gEl("guidechar2").src=GUIDE_ASSETS.char2;
boot();
