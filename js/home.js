let betaSlideIndex=0,betaAutoTimer=null,betaUserTouching=false;

function betaResolveBg(url){
const fallback="../asset.funcgines.cloud/bg/beta2026.webp";
if(!url)return fallback;
if(isUrlBroken(url))return fallback;
return url;
}

function buildBetaCarousel(images){
const track=document.getElementById("betahome-track");
const dotsWrap=document.getElementById("betahome-dots");
track.innerHTML="";
dotsWrap.innerHTML="";
images.forEach((url,i)=>{
const slide=document.createElement("div");
slide.className="betahome__slide";
slide.style.backgroundImage=`url(${betaResolveBg(url)})`;
track.appendChild(slide);
if(images.length>1){
const d=document.createElement("div");
d.className="betahome__dot"+(i===0?" active":"");
dotsWrap.appendChild(d);
}
});
betaSlideIndex=0;
if(images.length>1)startBetaAuto(images.length);
}

function goToBetaSlide(i,total){
betaSlideIndex=((i%total)+total)%total;
const track=document.getElementById("betahome-track");
track.scrollTo({left:betaSlideIndex*track.clientWidth,behavior:"smooth"});
document.querySelectorAll(".betahome__dot").forEach((d,idx)=>d.classList.toggle("active",idx===betaSlideIndex));
}

function startBetaAuto(total){
if(betaAutoTimer)clearInterval(betaAutoTimer);
betaAutoTimer=setInterval(()=>{
if(betaUserTouching)return;
goToBetaSlide(betaSlideIndex+1,total);
},5000);
}

function wireBetaSwipe(total){
const track=document.getElementById("betahome-track");
let scrollTimer=null;
track.addEventListener("touchstart",()=>{betaUserTouching=true},{passive:true});
track.addEventListener("touchend",()=>{
setTimeout(()=>{betaUserTouching=false},600);
},{passive:true});
track.addEventListener("scroll",()=>{
if(scrollTimer)clearTimeout(scrollTimer);
scrollTimer=setTimeout(()=>{
const idx=Math.round(track.scrollLeft/track.clientWidth);
betaSlideIndex=((idx%total)+total)%total;
document.querySelectorAll(".betahome__dot").forEach((d,i)=>d.classList.toggle("active",i===betaSlideIndex));
},80);
},{passive:true});
}

function initHome(){
const game=Store.getGame();
GAME=game||null;
if(game){
document.getElementById("betahome-gamename").textContent=(game.team&&game.team.name)||"Tansum Basketball FC";
const images=(game.season&&Array.isArray(game.season.bgList)&&game.season.bgList.length)
?game.season.bgList
:(game.season?[game.season.bgDay,game.season.bgNight].filter(Boolean):[]);
const finalImages=images.length?images:["../asset.funcgines.cloud/bg/beta2026.webp"];
buildBetaCarousel(finalImages);
wireBetaSwipe(finalImages.length);
if(game.config)Net.init(game.config);
}else{
buildBetaCarousel(["../asset.funcgines.cloud/bg/beta2026.webp"]);
wireBetaSwipe(1);
}
DataSync.syncWithProgress(()=>{}).then(res=>{
if(res&&res.bundle)GAME=res.bundle;
}).catch(()=>{});
}

initHome();
