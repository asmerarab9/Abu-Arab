import React, { useState, useEffect, useRef } from "react";

/* ─── Brand tokens ─────────────────────────────────────────── */
const C = {
  ink:"#0b0b0d",ink2:"#111114",steel:"#17181b",steel2:"#1e2024",
  line:"rgba(200,155,60,0.18)",lineBright:"rgba(200,155,60,0.42)",
  gold:"#c89b3c",goldBright:"#e8c468",
  chrome:"#b7bcc4",chromeDim:"#5e636b",
  paper:"#f3efe6",paperDim:"#cfc9ba",
  good:"#4a7c59",goodBg:"rgba(74,124,89,0.14)",
  warn:"#a26b2e",warnBg:"rgba(162,107,46,0.14)",
  danger:"#8f3030",dangerBg:"rgba(143,48,48,0.14)",
  blue:"#3a6fa8",blueBg:"rgba(58,111,168,0.14)",
};

/* ─── Seed data ────────────────────────────────────────────── */
const SEED = {
  trailers:[
    {id:"T0",name:"22' Elite Concession Trailer",length:"22 ft",power:"12,000W Generator",kitchen:"36\" LP griddle, 2-burner table top, drawer heated holding cabinet, heated proofing cabinet, 6' vent hood w/ exhaust fan, fire suppression (Class K)",fridge:"Single-door reach-in (replaced if not working)",dailyRate:50,monthlyRate:1500,purchasePrice:60000,status:"rented",vin:"50ZBE2224PP044521",make:"QUAL"},
    {id:"T1",name:"16' Grill & Griddle Unit",length:"16 ft",power:"10kW Generator",kitchen:"Flat-top griddle, 2-burner range, exhaust hood",fridge:"6 cu ft reach-in",dailyRate:180,monthlyRate:2200,purchasePrice:28000,status:"rent-sale"},
    {id:"T2",name:"20' Fryer & Grill Combo",length:"20 ft",power:"14kW Generator",kitchen:"Double fryer, flat-top, 4-burner range",fridge:"8 cu ft + freezer",dailyRate:230,monthlyRate:2800,purchasePrice:36000,status:"rent-sale"},
    {id:"T3",name:"24' Full Pro Kitchen",length:"24 ft",power:"20kW Generator",kitchen:"Flat-top, fryer, 6-burner range, suppression",fridge:"10 cu ft + chest",dailyRate:295,monthlyRate:3400,purchasePrice:48000,status:"rent-sale"},
    {id:"T4",name:"16' Taco & Prep Unit",length:"16 ft",power:"10kW Generator",kitchen:"Plancha, steam table, prep counter",fridge:"6 cu ft reach-in",dailyRate:175,monthlyRate:2100,purchasePrice:26000,status:"rent-sale"},
    {id:"T5",name:"22' Smoker & BBQ Rig",length:"22 ft",power:"16kW Generator",kitchen:"Offset smoker, flat-top, warming drawers",fridge:"8 cu ft reach-in",dailyRate:260,monthlyRate:3100,purchasePrice:42000,status:"rent-sale"},
  ],
  tenants:[
    {id:"U0",name:"Shirley & Gaius Cameron",phone:"+1 (512) 585-0310",email:"pawpawsbbqtx@gmail.com",pin:"1234",trailerId:"T0",startDate:"2026-07-03",endDate:"2027-07-03",monthlyRate:1500,creditRate:26.7,zelleTag:"pawpawsbbqtx@gmail.com",secondLessee:"Gaius Paul Cameron",address:"1905 Golden Arrow Ave, Cedar Park, TX 78613",securityDeposit:1500,depositPaid:true,purchaseOptionPrice:60000,baseRent:1100,purchaseCreditPerMonth:400},
  ],
  payments:[
    {id:"P1",tenantId:"U1",amount:2800,date:"2026-06-01",method:"Zelle",status:"paid",note:"June 2026"},
    {id:"P2",tenantId:"U1",amount:2800,date:"2026-07-01",method:"Zelle",status:"paid",note:"July 2026"},
    {id:"P3",tenantId:"U1",amount:2800,date:"2026-08-01",method:"Zelle",status:"pending",note:"August 2026"},
  ],
  contracts:[],
  bookingRequests:[],
  maintenanceRequests:[],
  transportRequests:[],
  notifications:[],
};

/* ─── Storage ─────────────────────────────────────────────── */

const LOGO_URI = "/logo.png";


const OWNER_PHONE = "737-888-9096";
const OWNER_EMAIL = "aafoodt@gmail.com";
const OWNER_ZELLE = "737-888-9096"; // Zelle payments go to this number ONLY

// ── Stripe card payments ────────────────────────────────────
// Fee is passed on to the tenant (grossed up) so the FULL rent reaches you.
// After deploying the Stripe Cloud Function, paste its URL into STRIPE_CHECKOUT_URL.
const STRIPE_PCT = 0.029, STRIPE_FIXED = 0.30; // Stripe card fee: 2.9% + $0.30
const STRIPE_CHECKOUT_URL = ""; // e.g. "https://us-central1-abu-arab-trailers.cloudfunctions.net/createCheckout"
// Amount to charge the card so that, after Stripe's fee, you net exactly `net`.
const cardTotal = (net) => Math.round(((Number(net||0) + STRIPE_FIXED) / (1 - STRIPE_PCT)) * 100) / 100;
const cardFee = (net) => Math.round((cardTotal(net) - Number(net||0)) * 100) / 100;

// ── Firebase backend ────────────────────────────────────────
// Talks to Firestore via its REST API. This ONLY works when the app is
// hosted as a real standalone website (Vercel, Netlify, Firebase Hosting,
// etc.) — NOT inside a Claude artifact, which blocks all outbound network
// requests for security. See DEPLOY.md for hosting instructions.
const firebaseConfig={
  apiKey:"AIzaSyD6bXw9x5vkwIRFPRIahXT1M8X6gNtJTlc",
  authDomain:"abu-arab-trailers.firebaseapp.com",
  projectId:"abu-arab-trailers",
  storageBucket:"abu-arab-trailers.firebasestorage.app",
  messagingSenderId:"879447149688",
  appId:"1:879447149688:web:9d1d663df40331640a718d",
  measurementId:"G-ELFPJJJWXP"
};
const FIRESTORE_BASE=`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

async function load(key){
  try{
    const res=await fetch(`${FIRESTORE_BASE}/kv/${encodeURIComponent(key)}?key=${firebaseConfig.apiKey}`);
    if(res.status===404) return null;
    if(!res.ok) throw new Error("HTTP "+res.status);
    const json=await res.json();
    const raw=json.fields?.value?.stringValue;
    return raw!==undefined ? JSON.parse(raw) : null;
  }catch(err){ console.error("Firestore load failed for",key,err); return null; }
}
let lastSaveInfo=""; // human-readable detail of the most recent save failure
async function save(key,val){
  const payload=JSON.stringify(val);
  const kb=Math.round(payload.length/1024);
  try{
    const res=await fetch(`${FIRESTORE_BASE}/kv/${encodeURIComponent(key)}?key=${firebaseConfig.apiKey}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({fields:{value:{stringValue:payload},updatedAt:{integerValue:String(Date.now())}}})
    });
    if(!res.ok){
      let body=""; try{ body=(await res.text()).replace(/\s+/g," ").slice(0,180); }catch(e){}
      lastSaveInfo=`HTTP ${res.status} · ${kb} KB · ${body}`;
      console.error("Firestore save failed for",key,lastSaveInfo);
      return false;
    }
    lastSaveInfo=""; return true;
  }catch(err){ lastSaveInfo=`network error · ${kb} KB · ${err?.message||err}`; console.error("Firestore save failed for",key,err); return false; }
}
// Large binary files (PDF contracts, photos) go in the same "kv" collection,
// under their own key — separate from the main db doc.
async function saveFile(key,dataUri){
  try{
    const res=await fetch(`${FIRESTORE_BASE}/kv/${encodeURIComponent(key)}?key=${firebaseConfig.apiKey}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({fields:{value:{stringValue:dataUri},updatedAt:{integerValue:String(Date.now())}}})
    });
    if(!res.ok) throw new Error("HTTP "+res.status);
    return {ok:true};
  }catch(err){ console.error("Firestore file save failed for",key,err); return {ok:false,error:err?.message||String(err)}; }
}
async function loadFile(key){
  try{
    const res=await fetch(`${FIRESTORE_BASE}/kv/${encodeURIComponent(key)}?key=${firebaseConfig.apiKey}`);
    if(res.status===404) return null;
    if(!res.ok) throw new Error("HTTP "+res.status);
    const json=await res.json();
    return json.fields?.value?.stringValue ?? null;
  }catch{ return null; }
}
// Chunked storage: Firestore documents cap out around 1MB, so files are
// still split into safe pieces well under that cap.
const CHUNK_SIZE=700000; // ~700KB per chunk doc limit
async function saveFileChunked(baseKey,dataUri){
  const total=Math.ceil(dataUri.length/CHUNK_SIZE);
  for(let i=0;i<total;i++){
    const piece=dataUri.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
    const r=await saveFile(`${baseKey}:chunk:${i}`,piece);
    if(!r.ok) return {ok:false,error:`Chunk ${i+1} of ${total} failed: ${r.error}`};
  }
  const metaR=await saveFile(`${baseKey}:meta`,JSON.stringify({chunks:total}));
  if(!metaR.ok) return {ok:false,error:`Meta save failed: ${metaR.error}`};
  return {ok:true};
}
async function loadFileChunked(baseKey){
  try{
    const metaRaw=await loadFile(`${baseKey}:meta`);
    if(!metaRaw) return null;
    const meta=JSON.parse(metaRaw);
    let result="";
    for(let i=0;i<meta.chunks;i++){
      const piece=await loadFile(`${baseKey}:chunk:${i}`);
      if(piece===null) return null;
      result+=piece;
    }
    return result;
  }catch{ return null; }
}
// Resize/compress a photo client-side before storing, so phone photos (often 3-8MB)
// never come close to the per-key storage limit.
// ── Trailer photos live in their OWN Firestore docs (not the main db), so the
// main db stays well under Firestore's 1 MiB per-document limit. In memory the
// photo sits on trailer.photo as usual; on save it's replaced by a marker.
const PHOTO_MARK="__stored__";
const photoCache={}; // id -> { key, photos:[uri,...] }  (avoids re-fetching every poll)
// Each trailer can have MANY photos. They live in their own Firestore docs
// (trailer_photo:<id>:<index>), never in the main db. The main db only keeps
// photoCount + photoNames; in memory we attach trailer.photos[] and .photo (cover).

function stripForSave(db){
  const copy={...db};
  copy.trailers=(db.trailers||[]).map(t=>{ const {photos,photo,...rest}=t; return rest; }); // photos never saved in main db
  copy.maintenanceRequests=(db.maintenanceRequests||[]).map(r=>(r.photo&&r.photo.length>120000)?{...r,photo:null}:r);
  return copy;
}
async function saveDB(db){ return save("abus_db_v2", stripForSave(db)); }

async function attachTrailerPhotos(db){
  if(!db||!db.trailers) return db;
  await Promise.all(db.trailers.map(async t=>{
    const n=t.photoCount||0;
    const key=t.id+":"+n+":"+((t.photoNames||[]).join("|"));
    const ck=photoCache[t.id];
    if(ck && ck.key===key){ t.photos=ck.photos; t.photo=ck.photos[0]||null; return; }
    const arr=[];
    for(let i=0;i<n;i++){ const u=await loadFileChunked("trailer_photo:"+t.id+":"+i); if(u) arr.push(u); }
    t.photos=arr; t.photo=arr[0]||null; photoCache[t.id]={key,photos:arr};
  }));
  return db;
}
async function loadDBFull(){ const db=await load("abus_db_v2"); if(!db) return null; return attachTrailerPhotos(db); }

function compressImage(file, maxDim=1000, quality=0.75){
  return new Promise((resolve)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const img=new Image();
      img.onload=()=>{
        let {width,height}=img;
        if(width>height && width>maxDim){ height=Math.round(height*maxDim/width); width=maxDim; }
        else if(height>maxDim){ width=Math.round(width*maxDim/height); height=maxDim; }
        const canvas=document.createElement("canvas");
        canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg",quality));
      };
      img.onerror=()=>resolve(e.target.result); // fallback: use original if it fails
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
async function initDB(){
  const existing=await load("abus_db_v2");
  if(!existing){await save("abus_db_v2",SEED);return SEED;}
  const db=existing;
  // ── CLEANUP: strip any legacy base64 file blobs that older versions saved
  // inside the main db. These bloat the record past the storage limit and
  // make EVERY subsequent save fail. Files now live in their own chunked keys.
  if(db.contracts)db.contracts.forEach(ct=>{ if(ct.fileData){ delete ct.fileData; } });
  if(db.maintenanceRequests)db.maintenanceRequests.forEach(r=>{ if(r.photo&&r.photo.length>120000){ r.photo=null; } });
  // One-time migration: convert each trailer's single legacy photo into the new
  // multi-photo layout (trailer_photo:<id>:0 ...), and set photoCount.
  if(db.trailers){
    for(const t of db.trailers){
      if(t.photoCount===undefined){
        let first=null;
        if(t.photo&&typeof t.photo==="string"&&t.photo.startsWith("data:")) first=t.photo;
        if(!first){ first=await loadFileChunked("trailer_photo:"+t.id); } // legacy external single
        if(first){
          await saveFileChunked("trailer_photo:"+t.id+":0", first);
          t.photoCount=1; t.photoNames=[t.photoName||"photo"];
          photoCache[t.id]={key:t.id+":1:"+(t.photoName||"photo"),photos:[first]};
        } else { t.photoCount=0; t.photoNames=[]; }
        delete t.photo; delete t.photoName;
      }
      // Status remap: old statuses → new 5-state model
      const map={available:"rent-sale","rent-to-own":"rent-sale",maintenance:"rented",pending:"rented","not-available":"rented"};
      if(map[t.status]) t.status=map[t.status];
      if(!t.status) t.status="rent-sale";
      if(t.views===undefined) t.views=0;
    }
  }
  await saveDB(db); // persists the slimmed-down main db (photos now external)
  if(!db.maintenanceRequests)db.maintenanceRequests=[];
  if(!db.transportRequests)db.transportRequests=[];
  if(!db.notifications)db.notifications=[];
  if(!db.bookingRequests)db.bookingRequests=[];
  if(!db.applications)db.applications=[];
  if(!db.transactions)db.transactions=[];
  // ensure purchase prices
  db.trailers.forEach(t=>{if(!t.purchasePrice)t.purchasePrice=35000;if(!t.creditRate)t.creditRate=15;});
  db.tenants.forEach(t=>{if(!t.creditRate)t.creditRate=15;});
  return db;
}

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt$=n=>"$"+Number(n).toLocaleString();
const fmtDate=s=>s?new Date(s+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const uid=()=>Math.random().toString(36).slice(2,8).toUpperCase();
// Lease month math: total months in the lease term, months paid so far, months remaining.

function leaseMonths(tenant, payments){
  if(!tenant?.startDate||!tenant?.endDate) return {total:0,paid:0,remaining:0};
  const start=new Date(tenant.startDate+"T00:00:00");
  const end=new Date(tenant.endDate+"T00:00:00");
  const total=Math.max(0,(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth()));
  const paid=payments.filter(p=>p.tenantId===tenant.id&&p.status==="paid"&&p.amount>=(tenant.monthlyRate||0)).length;
  return {total, paid, remaining:Math.max(0,total-paid)};
}
const today=()=>new Date().toISOString().slice(0,10);
const addMonths=(isoDate,months)=>{ const d=isoDate?new Date(isoDate+"T00:00:00"):new Date(); if(!months) return ""; d.setMonth(d.getMonth()+Number(months)); return d.toISOString().slice(0,10); };

const GLOBAL_CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body{background:${C.ink};color:${C.paper};font-family:'Inter',sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;}
  input,select,textarea,button{font-family:inherit;font-size:inherit;}
  button{cursor:pointer;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-thumb{background:${C.line};}
  ::selection{background:${C.gold};color:${C.ink};}
  :focus-visible{outline:2px solid ${C.gold};outline-offset:2px;}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .fadein{animation:fadein 0.2s ease both;}
  /* Animated splash intro */
  .splash{position:fixed;inset:0;z-index:9999;background:radial-gradient(ellipse at center,#141417,#0b0b0d 70%);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:splashOut 0.6s ease 3.3s forwards;}
  .splash-inner{display:flex;flex-direction:column;align-items:center;gap:16px;position:relative;}
  .splash-word{font-family:'Oswald',sans-serif;font-size:clamp(40px,13vw,76px);font-weight:700;letter-spacing:0.04em;color:#f3efe6;display:flex;position:relative;line-height:1;}
  .splash-word .ch{display:inline-block;opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--dr)) scale(1.4);animation:chIn 0.7s cubic-bezier(.2,.9,.2,1) forwards;animation-delay:var(--d);
    background:linear-gradient(180deg,#fff 0%,#dfe4ea 42%,#9aa3ad 60%,#eef2f6 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
    filter:drop-shadow(0 2px 1px rgba(0,0,0,0.5));}
  .splash-word.glow .ch{animation:chIn 0.7s cubic-bezier(.2,.9,.2,1) forwards, chGlow 0.9s ease 1.5s;}
  .splash-sweep{position:absolute;top:-10%;left:-30%;width:28%;height:120%;pointer-events:none;
    background:linear-gradient(100deg,transparent,rgba(120,255,200,0.0) 20%,rgba(150,255,210,0.85) 50%,rgba(120,255,200,0.0) 80%,transparent);
    filter:blur(3px);opacity:0;transform:skewX(-14deg);animation:sweep 0.85s ease 1.45s;}
  .splash-sub{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.42em;color:#c89b3c;opacity:0;animation:wordIn 0.6s ease 1.9s both;padding-left:0.42em;text-align:center;}
  .splash-trailer{position:absolute;bottom:-60px;left:-40%;opacity:0;animation:driveIn 1.25s cubic-bezier(.25,.7,.25,1) 0.35s forwards;}
  .splash-logo{width:300px;max-width:82vw;height:auto;border-radius:14px;opacity:0;animation:logoReveal 0.8s ease 2.35s both;filter:drop-shadow(0 0 22px rgba(200,155,60,0.5));}
  .bm-animate{animation:markIn 1s cubic-bezier(.2,.8,.2,1) both;filter:drop-shadow(0 0 18px rgba(200,155,60,0.45));}
  @keyframes markIn{from{opacity:0;transform:rotate(-14deg) scale(0.55)}to{opacity:1;transform:none}}
  @keyframes chIn{to{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}
  @keyframes chGlow{0%{filter:drop-shadow(0 2px 1px rgba(0,0,0,0.5))}35%{filter:drop-shadow(0 0 14px rgba(150,255,210,0.95)) drop-shadow(0 0 26px rgba(120,255,190,0.6))}100%{filter:drop-shadow(0 2px 1px rgba(0,0,0,0.5))}}
  @keyframes sweep{0%{opacity:0;left:-30%}15%{opacity:1}85%{opacity:1}100%{opacity:0;left:120%}}
  @keyframes driveIn{0%{left:-40%;opacity:0}20%{opacity:1}72%{left:calc(50% - 46px);opacity:1}82%{left:calc(50% - 34px)}100%{left:calc(50% - 40px);opacity:0}}
  @keyframes logoReveal{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:none}}
  @keyframes wordIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes splashOut{to{opacity:0;visibility:hidden}}
  @media (prefers-reduced-motion: reduce){
    .splash-word .ch,.splash-sweep,.splash-trailer,.splash-sub,.splash-logo{animation-duration:0.01ms !important;animation-delay:0ms !important;opacity:1 !important;transform:none !important;}
  }
  /* Print: when a legal petition is open, print only it, on white paper */
  @media print{
    body{background:#fff !important;}
    body.printing-petition > *{visibility:hidden !important;}
    #petition-print, #petition-print *{visibility:visible !important;}
    #petition-print{position:absolute !important;left:0;top:0;width:100%;max-width:none !important;background:#fff !important;color:#000 !important;}
    .no-print{display:none !important;}
  }
`;

/* ─── Primitives ─────────────────────────────────────────── */
const s={
  app:{minHeight:"100vh",background:C.ink,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative"},
  card:{background:C.steel,border:`1px solid ${C.line}`,borderRadius:6,padding:"16px 18px"},
  goldCard:{background:C.steel,border:`1px solid ${C.lineBright}`,borderRadius:6,padding:"16px 18px"},
  label:{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:C.chromeDim,display:"block",marginBottom:6},
  input:{background:C.ink2,border:`1px solid ${C.line}`,borderRadius:4,padding:"11px 13px",color:C.paper,width:"100%",fontSize:15},
  btnGold:{background:C.gold,color:C.ink,border:"none",borderRadius:4,padding:"13px 20px",fontWeight:600,fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",width:"100%",cursor:"pointer"},
  btnOut:{background:"transparent",color:C.paper,border:`1px solid ${C.lineBright}`,borderRadius:4,padding:"11px 18px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"},
  mono:{fontFamily:"'JetBrains Mono',monospace"},
  heading:{fontFamily:"'Oswald',sans-serif",textTransform:"uppercase",letterSpacing:"0.03em"},
};

const Icon=({d,size=20,color="currentColor",...p})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d.split(" M").map((seg,i)=><path key={i} d={i===0?seg:"M"+seg}/>)}
  </svg>
);

const ICONS={
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  trailer:"M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  pay:"M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  contract:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  book:"M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  contact:"M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 M1 1l22 22",
  logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  download:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  check:"M20 6L9 17l-5-5",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  admin:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  plus:"M12 5v14 M5 12h14",
  trash:"M3 6h18 M8 6V4h8v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  close:"M18 6L6 18 M6 6l12 12",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  back:"M19 12H5 M12 19l-7-7 7-7",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  wrench:"M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  truck:"M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  credit:"M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z M1 10h22",
  img:"M21 15l-5-5L5 21 M21 3H3a2 2 0 00-2 2v14 M8.5 8.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
};

/* ── Notifications panel — a real openable list, not just a silent mark-all-read ── */
function NotificationsPanel({notifs, onClose, onMarkRead, onMarkAllRead, onDelete}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"70px 16px 16px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.steel,border:`1px solid ${C.lineBright}`,borderRadius:8,width:"100%",maxWidth:420,maxHeight:"75vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.03em"}}>Notifications</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.chromeDim,padding:4,cursor:"pointer"}}>
            <Icon d={ICONS.close} size={18}/>
          </button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {notifs.length===0 ? (
            <div style={{padding:"36px 20px",textAlign:"center",color:C.chromeDim,fontSize:13}}>No notifications yet.</div>
          ) : notifs.map(n=>(
            <div key={n.id}
              style={{padding:"12px 16px",borderBottom:`1px solid ${C.line}`,background:n.read?"transparent":C.blueBg,display:"flex",gap:10,alignItems:"flex-start"}}>
              <span onClick={()=>!n.read&&onMarkRead(n.id)} style={{fontSize:16,flexShrink:0,marginTop:1,cursor:n.read?"default":"pointer"}}>{n.read?"·":"🔔"}</span>
              <div onClick={()=>!n.read&&onMarkRead(n.id)} style={{flex:1,cursor:n.read?"default":"pointer"}}>
                <div style={{fontSize:13,fontWeight:n.read?400:600,color:n.read?C.chromeDim:C.paper}}>{n.title}</div>
                <div style={{fontSize:12,color:C.chromeDim,marginTop:2}}>{n.body}</div>
                <div style={{fontSize:10,...s.mono,color:C.chromeDim,marginTop:4}}>{fmtDate(n.date)}</div>
              </div>
              <button onClick={()=>onDelete(n.id)} title="Delete" style={{background:"none",border:"none",color:C.chromeDim,padding:4,cursor:"pointer",flexShrink:0}}>
                <Icon d={ICONS.trash} size={14}/>
              </button>
            </div>
          ))}
        </div>
        {notifs.length>0&&(
          <div style={{padding:"10px 16px",borderTop:`1px solid ${C.line}`,display:"flex",gap:8}}>
            {notifs.some(n=>!n.read)&&<button onClick={onMarkAllRead} style={{...s.btnOut,flex:1,padding:"9px"}}>Mark all as read</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin language support (English / Arabic) ───────────────
const TRANSLATIONS={
  overview:{en:"Overview",ar:"نظرة عامة"},
  tenants:{en:"Tenants",ar:"المستأجرين"},
  payments:{en:"Payments",ar:"الدفعات"},
  fleet:{en:"Fleet",ar:"الأسطول"},
  adminPanel:{en:"Admin Panel",ar:"لوحة التحكم"},
  add:{en:"Add",ar:"إضافة"},
  save:{en:"Save",ar:"حفظ"},
  cancel:{en:"Cancel",ar:"إلغاء"},
  delete:{en:"Delete",ar:"حذف"},
  back:{en:"Back",ar:"رجوع"},
  markPaid:{en:"Mark Paid",ar:"تعليم كمدفوع"},
  totalCollected:{en:"Total Collected",ar:"إجمالي المحصّل"},
  pendingPayments:{en:"Pending Payments",ar:"دفعات معلّقة"},
  availableTrailers:{en:"Available Trailers",ar:"التريلرات المتاحة"},
  leaseProgress:{en:"Lease Progress",ar:"تقدّم الإيجار"},
  recentPayments:{en:"Recent Payments",ar:"آخر الدفعات"},
  addTenant:{en:"Add Tenant",ar:"إضافة مستأجر"},
  bookingRequests:{en:"Booking Requests",ar:"طلبات الحجز"},
  contract:{en:"Contract",ar:"العقد"},
  securityDeposit:{en:"Security Deposit",ar:"وديعة التأمين"},
  markReceived:{en:"Mark as Received",ar:"تعليم كمستلَم"},
  monthsPaid:{en:"Months Paid",ar:"الأشهر المدفوعة"},
  monthsRemaining:{en:"Months Remaining",ar:"الأشهر المتبقية"},
  maintenanceRequests:{en:"Maintenance Requests",ar:"طلبات الصيانة"},
  transportRequests:{en:"Transport Requests",ar:"طلبات النقل"},
  approve:{en:"Approve",ar:"موافقة"},
  decline:{en:"Decline",ar:"رفض"},
  sendQuote:{en:"Send Price Quote",ar:"إرسال عرض سعر"},
  addTrailer:{en:"Add to Fleet",ar:"إضافة للأسطول"},
  deleteTrailer:{en:"Delete Trailer",ar:"حذف التريلر"},
  addPhoto:{en:"Add Trailer Photo",ar:"إضافة صورة"},
  changePhoto:{en:"Change Photo",ar:"تغيير الصورة"},
  notifications:{en:"Notifications",ar:"الإشعارات"},
  markAllRead:{en:"Mark all as read",ar:"تعليم الكل كمقروء"},
  refreshed:{en:"Refreshed",ar:"تم التحديث"},
  all:{en:"All",ar:"الكل"},
  available:{en:"Available",ar:"متاح"},
  rented:{en:"Rented",ar:"مؤجَّر"},
  "rent-to-own":{en:"Rent-to-Own",ar:"تملّك بالإيجار"},
  maintenance:{en:"Maintenance",ar:"صيانة"},
  pending:{en:"Pending",ar:"قيد الانتظار"},
  "not-available":{en:"Not Available",ar:"غير متاح"},
  sold:{en:"Sold",ar:"مباع"},
};
function t(key,lang){ return TRANSLATIONS[key]?.[lang] ?? TRANSLATIONS[key]?.en ?? key; }

// ── Tenant-facing languages ──────────────────────────────────
const LANGUAGES=[
  {code:"en",label:"English"},
  {code:"es",label:"Español"},
  {code:"hi",label:"हिन्दी"},
  {code:"ar",label:"العربية"},
  {code:"zh",label:"中文"},
  {code:"th",label:"ไทย"},
  {code:"de",label:"Deutsch"},
  {code:"ru",label:"Русский"},
  {code:"tr",label:"Türkçe"},
  {code:"ja",label:"日本語"},
];
const RTL_LANGS=["ar"];

Object.assign(TRANSLATIONS,{
  // ── nav / login ──
  home:{en:"Home",es:"Inicio",hi:"होम",ar:"الرئيسية",zh:"首页",th:"หน้าแรก",de:"Start",ru:"Главная",tr:"Ana Sayfa",ja:"ホーム"},
  tenantPortal:{en:"Tenant Portal",es:"Portal del Inquilino",hi:"किरायेदार पोर्टल",ar:"بوابة المستأجر",zh:"租户门户",th:"พอร์ทัลผู้เช่า",de:"Mieterportal",ru:"Портал арендатора",tr:"Kiracı Portalı",ja:"テナントポータル"},
  phoneOrEmail:{en:"Phone or Email",es:"Teléfono o Correo",hi:"फ़ोन या ईमेल",ar:"الهاتف أو البريد الإلكتروني",zh:"电话或邮箱",th:"โทรศัพท์หรืออีเมล",de:"Telefon oder E-Mail",ru:"Телефон или Email",tr:"Telefon veya E-posta",ja:"電話またはメール"},
  pin4digit:{en:"4-digit PIN",es:"PIN de 4 dígitos",hi:"4-अंकीय पिन",ar:"رمز مكون من ٤ أرقام",zh:"4位密码",th:"รหัส PIN 4 หลัก",de:"4-stellige PIN",ru:"4-значный PIN",tr:"4 haneli PIN",ja:"4桁のPIN"},
  signIn:{en:"Sign In",es:"Iniciar Sesión",hi:"साइन इन करें",ar:"تسجيل الدخول",zh:"登录",th:"เข้าสู่ระบบ",de:"Anmelden",ru:"Войти",tr:"Giriş Yap",ja:"サインイン"},
  troubleLogin:{en:"Trouble logging in? Contact Abu Arab directly.",es:"¿Problemas para iniciar sesión? Contacta a Abu Arab directamente.",hi:"लॉगिन करने में समस्या? सीधे अबू अरब से संपर्क करें।",ar:"مشكلة بتسجيل الدخول؟ تواصل مع أبو عرب مباشرة.",zh:"登录遇到问题？请直接联系Abu Arab。",th:"เข้าสู่ระบบไม่ได้? ติดต่อ Abu Arab โดยตรง",de:"Probleme beim Anmelden? Kontaktieren Sie Abu Arab direkt.",ru:"Проблемы со входом? Свяжитесь с Abu Arab напрямую.",tr:"Giriş sorunu mu? Doğrudan Abu Arab ile iletişime geçin.",ja:"ログインでお困りですか？Abu Arabに直接ご連絡ください。"},
  staffAccess:{en:"Staff access",es:"Acceso del personal",hi:"स्टाफ़ एक्सेस",ar:"دخول الموظفين",zh:"员工入口",th:"สำหรับเจ้าหน้าที่",de:"Mitarbeiterzugang",ru:"Доступ персонала",tr:"Personel erişimi",ja:"スタッフアクセス"},

  // ── tabs ──
  payments:{en:"Payments",es:"Pagos",hi:"भुगतान",ar:"الدفعات",zh:"付款",th:"การชำระเงิน",de:"Zahlungen",ru:"Платежи",tr:"Ödemeler",ja:"支払い"},
  credit:{en:"Credit",es:"Crédito",hi:"क्रेडिट",ar:"الرصيد",zh:"信用",th:"เครดิต",de:"Guthaben",ru:"Кредит",tr:"Kredi",ja:"クレジット"},
  services:{en:"Services",es:"Servicios",hi:"सेवाएं",ar:"الخدمات",zh:"服务",th:"บริการ",de:"Dienste",ru:"Услуги",tr:"Hizmetler",ja:"サービス"},
  contract:{en:"Contract",es:"Contrato",hi:"अनुबंध",ar:"العقد",zh:"合同",th:"สัญญา",de:"Vertrag",ru:"Договор",tr:"Sözleşme",ja:"契約"},

  // ── home ──
  welcomeBack:{en:"Welcome back",es:"Bienvenido de nuevo",hi:"वापसी पर स्वागत है",ar:"أهلاً فيك من جديد",zh:"欢迎回来",th:"ยินดีต้อนรับกลับ",de:"Willkommen zurück",ru:"С возвращением",tr:"Tekrar hoş geldiniz",ja:"おかえりなさい"},
  yourTrailer:{en:"Your Trailer",es:"Tu Remolque",hi:"आपका ट्रेलर",ar:"التريلر تبعك",zh:"您的拖车",th:"รถพ่วงของคุณ",de:"Ihr Anhänger",ru:"Ваш прицеп",tr:"Römorkunuz",ja:"あなたのトレーラー"},
  monthlyRate:{en:"Monthly Rate",es:"Tarifa Mensual",hi:"मासिक दर",ar:"الإيجار الشهري",zh:"月租",th:"ค่าเช่ารายเดือน",de:"Monatsrate",ru:"Ежемесячная плата",tr:"Aylık Ücret",ja:"月額料金"},
  daysLeft:{en:"Days Left",es:"Días Restantes",hi:"शेष दिन",ar:"الأيام المتبقية",zh:"剩余天数",th:"วันที่เหลือ",de:"Verbleibende Tage",ru:"Осталось дней",tr:"Kalan Gün",ja:"残り日数"},
  monthsPaidShort:{en:"Months Paid",es:"Meses Pagados",hi:"भुगतान किए महीने",ar:"الأشهر المدفوعة",zh:"已付月份",th:"เดือนที่จ่ายแล้ว",de:"Bezahlte Monate",ru:"Оплаченные месяцы",tr:"Ödenen Aylar",ja:"支払済み月数"},
  monthsLeft:{en:"Months Left",es:"Meses Restantes",hi:"शेष महीने",ar:"الأشهر المتبقية",zh:"剩余月份",th:"เดือนที่เหลือ",de:"Verbleibende Monate",ru:"Осталось месяцев",tr:"Kalan Ay",ja:"残り月数"},
  paymentDue:{en:"Payment Due",es:"Pago Pendiente",hi:"भुगतान देय",ar:"دفعة مستحقة",zh:"待付款",th:"ครบกำหนดชำระ",de:"Zahlung fällig",ru:"Платёж к оплате",tr:"Ödeme Tarihi",ja:"支払い期限"},
  payNow:{en:"Pay Now",es:"Pagar Ahora",hi:"अभी भुगतान करें",ar:"ادفع هلق",zh:"立即付款",th:"ชำระตอนนี้",de:"Jetzt bezahlen",ru:"Оплатить сейчас",tr:"Şimdi Öde",ja:"今すぐ支払う"},
  quickActions:{en:"Quick Actions",es:"Acciones Rápidas",hi:"त्वरित कार्य",ar:"إجراءات سريعة",zh:"快捷操作",th:"การดำเนินการด่วน",de:"Schnellaktionen",ru:"Быстрые действия",tr:"Hızlı İşlemler",ja:"クイックアクション"},

  // ── payments ──
  amountDueNow:{en:"Amount Due Now",es:"Monto a Pagar",hi:"अभी देय राशि",ar:"المبلغ المستحق الآن",zh:"当前应付金额",th:"จำนวนที่ต้องชำระตอนนี้",de:"Fälliger Betrag",ru:"Сумма к оплате",tr:"Şu An Ödenecek Tutar",ja:"現在の支払額"},
  payViaZelle:{en:"Pay via Zelle to:",es:"Pagar vía Zelle a:",hi:"Zelle के माध्यम से भुगतान करें:",ar:"ادفع عبر Zelle إلى:",zh:"通过Zelle付款至：",th:"ชำระผ่าน Zelle ไปที่:",de:"Über Zelle bezahlen an:",ru:"Оплатить через Zelle на:",tr:"Zelle ile ödeme yapın:",ja:"Zelleで支払う先："},
  openZelle:{en:"Open Zelle",es:"Abrir Zelle",hi:"Zelle खोलें",ar:"افتح Zelle",zh:"打开Zelle",th:"เปิด Zelle",de:"Zelle öffnen",ru:"Открыть Zelle",tr:"Zelle'yi Aç",ja:"Zelleを開く"},
  notifyAbuArab:{en:"I Sent the Payment — Notify Abu Arab",es:"Envié el Pago — Notificar a Abu Arab",hi:"मैंने भुगतान भेजा — अबू अरब को सूचित करें",ar:"بعثت الدفعة — بلّغ أبو عرب",zh:"我已付款——通知Abu Arab",th:"ฉันชำระเงินแล้ว — แจ้ง Abu Arab",de:"Zahlung gesendet — Abu Arab benachrichtigen",ru:"Я отправил платёж — уведомить Abu Arab",tr:"Ödemeyi Gönderdim — Abu Arab'ı Bilgilendir",ja:"支払いました — Abu Arabに通知"},
  paymentHistory:{en:"Payment History",es:"Historial de Pagos",hi:"भुगतान इतिहास",ar:"سجل الدفعات",zh:"付款记录",th:"ประวัติการชำระเงิน",de:"Zahlungsverlauf",ru:"История платежей",tr:"Ödeme Geçmişi",ja:"支払い履歴"},

  // ── credit ──
  creditBuyOption:{en:"Credit & Buy Option",es:"Crédito y Opción de Compra",hi:"क्रेडिट और खरीद विकल्प",ar:"الرصيد وخيار الشراء",zh:"信用与购买选项",th:"เครดิตและตัวเลือกซื้อ",de:"Guthaben & Kaufoption",ru:"Кредит и опция покупки",tr:"Kredi ve Satın Alma Seçeneği",ja:"クレジットと購入オプション"},
  readyToBuy:{en:"Ready to Buy?",es:"¿Listo para Comprar?",hi:"खरीदने के लिए तैयार?",ar:"جاهز تشتري؟",zh:"准备购买了吗？",th:"พร้อมซื้อหรือยัง?",de:"Bereit zu kaufen?",ru:"Готовы купить?",tr:"Satın Almaya Hazır mısınız?",ja:"購入の準備はできましたか？"},
  callAbuArab:{en:"Call Abu Arab",es:"Llamar a Abu Arab",hi:"अबू अरब को कॉल करें",ar:"اتصل بأبو عرب",zh:"致电Abu Arab",th:"โทรหา Abu Arab",de:"Abu Arab anrufen",ru:"Позвонить Abu Arab",tr:"Abu Arab'ı Ara",ja:"Abu Arabに電話"},

  // ── services ──
  bookATrailer:{en:"Book a Trailer",es:"Reservar un Remolque",hi:"ट्रेलर बुक करें",ar:"احجز تريلر",zh:"预订拖车",th:"จองรถพ่วง",de:"Anhänger buchen",ru:"Забронировать прицеп",tr:"Römork Rezerve Et",ja:"トレーラーを予約"},
  requestMaintenance:{en:"Request Maintenance",es:"Solicitar Mantenimiento",hi:"रखरखाव का अनुरोध करें",ar:"اطلب صيانة",zh:"申请维修",th:"ขอบำรุงรักษา",de:"Wartung anfordern",ru:"Запросить обслуживание",tr:"Bakım Talep Et",ja:"メンテナンスを依頼"},
  requestTransport:{en:"Request Transport",es:"Solicitar Transporte",hi:"परिवहन का अनुरोध करें",ar:"اطلب نقل",zh:"申请运输",th:"ขอการขนส่ง",de:"Transport anfordern",ru:"Запросить перевозку",tr:"Nakliye Talep Et",ja:"輸送を依頼"},

  // ── contract ──
  myContract:{en:"My Contract",es:"Mi Contrato",hi:"मेरा अनुबंध",ar:"عقدي",zh:"我的合同",th:"สัญญาของฉัน",de:"Mein Vertrag",ru:"Мой договор",tr:"Sözleşmem",ja:"私の契約"},
  viewBtn:{en:"View",es:"Ver",hi:"देखें",ar:"عرض",zh:"查看",th:"ดู",de:"Ansehen",ru:"Просмотр",tr:"Görüntüle",ja:"表示"},
  downloadPdf:{en:"Download PDF",es:"Descargar PDF",hi:"पीडीएफ डाउनलोड करें",ar:"تحميل PDF",zh:"下载PDF",th:"ดาวน์โหลด PDF",de:"PDF herunterladen",ru:"Скачать PDF",tr:"PDF İndir",ja:"PDFをダウンロード"},
  openContract:{en:"Open Contract",es:"Abrir Contrato",hi:"अनुबंध खोलें",ar:"افتح العقد",zh:"打开合同",th:"เปิดสัญญา",de:"Vertrag öffnen",ru:"Открыть договор",tr:"Sözleşmeyi Aç",ja:"契約を開く"},
  noContract:{en:"No contract uploaded yet. Contact Abu Arab if you need your lease document.",es:"Aún no se ha subido ningún contrato. Contacta a Abu Arab si necesitas tu documento de arrendamiento.",hi:"अभी तक कोई अनुबंध अपलोड नहीं हुआ। यदि आपको लीज़ दस्तावेज़ चाहिए तो अबू अरब से संपर्क करें।",ar:"ما في عقد مرفوع لهلق. تواصل مع أبو عرب إذا محتاج مستند الإيجار.",zh:"尚未上传合同。如需租赁文件，请联系Abu Arab。",th:"ยังไม่มีการอัปโหลดสัญญา ติดต่อ Abu Arab หากคุณต้องการเอกสารเช่า",de:"Noch kein Vertrag hochgeladen. Kontaktieren Sie Abu Arab, falls Sie Ihr Mietdokument benötigen.",ru:"Договор ещё не загружен. Свяжитесь с Abu Arab, если вам нужен документ аренды.",tr:"Henüz sözleşme yüklenmedi. Kira belgenize ihtiyacınız varsa Abu Arab ile iletişime geçin.",ja:"契約書はまだアップロードされていません。リース文書が必要な場合はAbu Arabにご連絡ください。"},
});

function Pill({color,children}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:99,fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em",background:color+"22",color,border:`1px solid ${color}44`}}>{children}</span>;
}

// ── Email notifications via EmailJS ─────────────────────────
// Needs a free EmailJS account (emailjs.com): create a Service + Template,
// then fill in these three values. Until they're filled in, email sending
// is silently skipped (everything else keeps working normally).
const EMAILJS_SERVICE_ID="service_6f09dtj";
const EMAILJS_TEMPLATE_ID="template_a00rod7";
const EMAILJS_PUBLIC_KEY="q4ojSHPXyAjOJLkx4";

async function sendEmail(toEmail, toName, subject, message){
  if(!EMAILJS_SERVICE_ID||!EMAILJS_TEMPLATE_ID||!EMAILJS_PUBLIC_KEY) return; // not configured yet
  if(!toEmail) return;
  try{
    await fetch("https://api.emailjs.com/api/v1.0/email/send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        service_id:EMAILJS_SERVICE_ID,
        template_id:EMAILJS_TEMPLATE_ID,
        user_id:EMAILJS_PUBLIC_KEY,
        template_params:{ to_email:toEmail, to_name:toName||"", subject, message }
      })
    });
  }catch(err){ console.error("Email send failed:",err); }
}

function addNotification(db,{forRole,title,body,link,forTenantId}){
  const n={id:"N"+uid(),forRole,title,body,link,forTenantId,date:today(),read:false};
  db.notifications=[...db.notifications,n];
  // Fire-and-forget email alongside the in-app notification, whenever this
  // notification is meant for a specific tenant who has an email on file.
  if(forTenantId){
    const t=(db.tenants||[]).find(x=>x.id===forTenantId);
    if(t?.email) sendEmail(t.email, t.name, title, body);
  }
  return db;
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAYMENT REMINDER + ESCALATION ENGINE                        */
/*  Runs when the admin opens the app (no server cron here).     */
/*  Sends each stage once per cycle (deduped via reminderLog).   */
/* ═══════════════════════════════════════════════════════════ */
const BRAND="Texan Food Trailers Solution";
// Stage thresholds in days relative to the due date (negative = before due)
const REMINDER_STAGES=[
  {id:"upcoming",threshold:-2,label:"Upcoming rent reminder"},
  {id:"due",     threshold:0, label:"Rent due today"},
  {id:"late",    threshold:5, label:"Late notice + late fee (5 days)"},
  {id:"demand",  threshold:14,label:"Formal demand (14 days)"},
];
const CURE_DAYS=10;

function parseYMD(s){ if(!s) return null; const [y,m,d]=s.split("-").map(Number); if(!y||!m||!d) return null; return new Date(y,m-1,d); }
function fmtDateObj(d){ return d? d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : ""; }
function daysDiff(a,b){ return Math.round((a-b)/86400000); }

// Due date for the current cycle, derived from the tenant's lease start day-of-month
function currentDueDate(tenant,ref){
  const start=parseYMD(tenant.startDate);
  const dueDay=start?start.getDate():1;
  return new Date(ref.getFullYear(),ref.getMonth(),Math.min(dueDay,28));
}
function isPaidForMonth(db,tenantId,dueDate){
  const ym=`${dueDate.getFullYear()}-${String(dueDate.getMonth()+1).padStart(2,"0")}`;
  return (db.payments||[]).some(p=>p.tenantId===tenantId && p.status==="paid" && (p.date||"").slice(0,7)===ym);
}
function reminderMessage(stage,{name,amount,trailerName,dueStr,overdue,lateFee}){
  const amt=fmt$(amount||0);
  const zelle=OWNER_ZELLE;
  const fee=Number(lateFee)||0;
  const totalDue=(Number(amount)||0)+fee;
  switch(stage){
    case "upcoming": return `Dear ${name},\n\nThis is a friendly reminder that your rent of ${amt} for ${trailerName} is due on ${dueStr}. Please make your payment on time via Zelle to ${zelle}.\n\nThank you,\n${BRAND}`;
    case "due": return `Dear ${name},\n\nYour rent of ${amt} for ${trailerName} is due today (${dueStr}). Please submit your payment via Zelle to ${zelle} to keep your account current.\n\nThank you,\n${BRAND}`;
    case "late": return `LATE RENT NOTICE\n\nDear ${name},\n\nOur records show your rent of ${amt} for ${trailerName}, due ${dueStr}, is now ${overdue} days past due.`
      + (fee>0
        ? ` Under the terms of your lease, a late fee of ${fmt$(fee)} now applies, bringing the total amount due to ${fmt$(totalDue)}.`
        : ` Please bring your account current as soon as possible.`)
      + ` Please submit payment via Zelle to ${zelle} without further delay to avoid additional action.\n\n${BRAND}`;
    case "demand": return `NOTICE OF DEFAULT & DEMAND FOR PAYMENT\n\nDear ${name},\n\nYour rent of ${amt} for ${trailerName} is now ${overdue} days overdue (originally due ${dueStr})`
      + (fee>0?`, plus a late fee of ${fmt$(fee)} (total ${fmt$(totalDue)})`:``)
      + `. This is a formal demand that the full balance be paid within ${CURE_DAYS} days of this notice.\n\nIf payment is not received within that period, we may pursue all available remedies, including recovery of the trailer and filing a claim in the Justice Court for the amount owed plus costs.\n\n${BRAND}`;
    default: return "";
  }
}

// Returns the stage object that currently applies, or null
function currentStage(diff){
  if(diff < -2) return null;
  let chosen=null;
  for(const st of REMINDER_STAGES){ if(diff>=st.threshold) chosen=st; }
  // before due but within 2 days → upcoming
  if(!chosen && diff>=-2) chosen=REMINDER_STAGES[0];
  return chosen;
}

async function runReminders(db,updateDB){
  const ref=new Date(); ref.setHours(0,0,0,0);
  const toLog=[]; // {tenantId, key, stageLabel, name}
  (db.tenants||[]).forEach(t=>{
    if(!t.trailerId || !t.monthlyRate) return; // only active, billed tenants
    const due=currentDueDate(t,ref);
    if(isPaidForMonth(db,t.id,due)) return;
    const diff=daysDiff(ref,due);
    const st=currentStage(diff);
    if(!st) return;
    const ym=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}`;
    const key=`${ym}:${st.id}`;
    if((t.reminderLog||[]).some(x=>x.key===key)) return; // already sent this stage
    toLog.push({tenantId:t.id,key,stage:st,due,diff,tenant:t});
  });
  if(toLog.length===0) return 0;
  // Record log + in-app notifications; the tenant email is sent by addNotification.
  const trailerName=(id)=>((db.trailers||[]).find(x=>x.id===id)||{}).name||"your trailer";
  updateDB(d=>{
    toLog.forEach(item=>{
      const t=d.tenants.find(x=>x.id===item.tenantId);
      if(!t) return;
      t.reminderLog=[...(t.reminderLog||[]),{key:item.key,date:today()}];
      addNotification(d,{forRole:"admin",title:"Reminder Sent",body:`${item.stage.label} sent to ${t.name}.`});
      addNotification(d,{forRole:"tenant",forTenantId:t.id,title:item.stage.id==="demand"?"Notice of Default":item.stage.id==="late"?"Late Rent Notice":"Rent Reminder",body:reminderMessage(item.stage.id,{name:t.name,amount:t.monthlyRate,trailerName:trailerName(t.trailerId),dueStr:fmtDateObj(item.due),overdue:item.diff,lateFee:t.lateFee})});
    });
    return d;
  });
  return toLog.length;
}

/* ── Brand mark (vector logo) + animated splash intro ──────── */
function BrandMark({size=120,animated=false}){
  return(
    <svg width={size} height={size} viewBox="0 0 120 120" className={animated?"bm-animate":""} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bmGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8c468"/><stop offset="1" stopColor="#c89b3c"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill="#111114" stroke="url(#bmGold)" strokeWidth="3"/>
      <circle cx="60" cy="60" r="49" fill="none" stroke="url(#bmGold)" strokeWidth="0.8" opacity="0.5"/>
      {/* Lone star */}
      <path d="M60 19 l3.8 9.3 10 0.8 -7.6 6.6 2.4 9.8 -8.6-5.3 -8.6 5.3 2.4-9.8 -7.6-6.6 10-0.8z" fill="url(#bmGold)"/>
      {/* Trailer body */}
      <rect x="31" y="60" width="46" height="23" rx="3" fill="url(#bmGold)"/>
      {/* Hitch */}
      <path d="M77 72 h13" stroke="url(#bmGold)" strokeWidth="3" strokeLinecap="round"/>
      {/* Serving window */}
      <rect x="37" y="65" width="21" height="8" rx="1.5" fill="#111114"/>
      {/* Awning */}
      <path d="M35 62 h26 l-5 -6 h-16 z" fill="#111114" opacity="0.55"/>
      {/* Wheels */}
      <circle cx="42" cy="86" r="6" fill="#111114" stroke="url(#bmGold)" strokeWidth="2.6"/>
      <circle cx="66" cy="86" r="6" fill="#111114" stroke="url(#bmGold)" strokeWidth="2.6"/>
    </svg>
  );
}
function Splash(){
  const word="TEXAN";
  // each letter flies in from a different corner/edge, then settles
  const origins=[
    {dx:"-70vw",dy:"-60vh",dr:"-40deg"},
    {dx:"60vw", dy:"-65vh",dr:"35deg"},
    {dx:"-65vw",dy:"62vh", dr:"30deg"},
    {dx:"68vw", dy:"58vh", dr:"-32deg"},
    {dx:"0vw",  dy:"-75vh",dr:"18deg"},
  ];
  return(
    <div className="splash">
      <div className="splash-inner">
        <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
          <div className="splash-word glow" aria-label="TEXAN">
            {word.split("").map((c,i)=>{
              const o=origins[i%origins.length];
              return <span key={i} className="ch" style={{"--dx":o.dx,"--dy":o.dy,"--dr":o.dr,"--d":`${0.15+i*0.14}s`}}>{c}</span>;
            })}
            <span className="splash-sweep"/>
          </div>
          <div className="splash-sub">FOOD&nbsp;TRAILER&nbsp;SOLUTION</div>
          {/* trailer drives in and parks under the wordmark */}
          <svg className="splash-trailer" width="92" height="56" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="spGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e7c05a"/><stop offset="1" stopColor="#b8862f"/></linearGradient></defs>
            <rect x="10" y="16" width="86" height="34" rx="4" fill="#15151a" stroke="url(#spGold)" strokeWidth="2.4"/>
            <rect x="20" y="24" width="34" height="16" rx="2" fill="#2a2a31" stroke="url(#spGold)" strokeWidth="1.4"/>
            <path d="M54 24 h18 l-4 -8 h-10 z" fill="#1c1c22" stroke="url(#spGold)" strokeWidth="1.2"/>
            <circle cx="96" cy="33" r="3" fill="url(#spGold)"/>
            <path d="M96 50 h14" stroke="url(#spGold)" strokeWidth="2.4" strokeLinecap="round"/>
            <circle cx="36" cy="56" r="7" fill="#111114" stroke="url(#spGold)" strokeWidth="2.6"/>
            <circle cx="70" cy="56" r="7" fill="#111114" stroke="url(#spGold)" strokeWidth="2.6"/>
          </svg>
          <img src={LOGO_URI} alt="Texan Food Trailer Solution" className="splash-logo"/>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ROOT APP                                                    */
/* ═══════════════════════════════════════════════════════════ */

export default function App(){
  const [db,setDb]=useState(null);
  const [session,setSession]=useState(null);
  const [view,setView]=useState("public"); // public | login
  const [connStatus,setConnStatus]=useState("Connecting to database…");
  const [showSplash,setShowSplash]=useState(true);
  useEffect(()=>{ const tm=setTimeout(()=>setShowSplash(false),4000); return ()=>clearTimeout(tm); },[]);

  useEffect(()=>{
    (async()=>{
      const testKey="connection_test";
      const testVal={ping:Date.now()};
      const ok=await save(testKey,testVal);
      if(!ok){ setConnStatus("⚠ Save failed — check console for details"); return; }
      const back=await load(testKey);
      if(back && back.ping===testVal.ping){ setConnStatus("✓ Connected to Firebase successfully"); }
      else{ setConnStatus("⚠ Read-back failed"); }
    })();
  },[]);

  useEffect(()=>{
    const style=document.createElement("style");
    style.textContent=GLOBAL_CSS;
    document.head.appendChild(style);
    // The home-screen / favicon icons are set in index.html (square PNGs in
    // public/: favicon.png, apple-touch-icon.png, icon-192/512.png via manifest).
    try{ document.title="Texan Food Trailers Solution"; }catch{}
    initDB().then(d=>setDb(d));
    // Sync via polling — REST calls only (no SDK), so this works reliably
    // even in sandboxed environments that block external script loading.
    const pull=async()=>{
      const fresh=await loadDBFull();
      if(fresh) setDb(prev=>JSON.stringify(fresh)!==JSON.stringify(prev)?fresh:prev);
    };
    const interval=setInterval(pull,5000);
    const onFocus=()=>pull();
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pull(); });
    return ()=>{ clearInterval(interval); window.removeEventListener("focus",onFocus); };
  },[]);

  const refreshNow=async()=>{
    const fresh=await loadDBFull();
    if(fresh) setDb(fresh);
  };

  const updateDB=async(updater)=>{
    setDb(prev=>{
      const next=updater(JSON.parse(JSON.stringify(prev)));
      saveDB(next).then(ok=>{
        if(!ok) alert("⚠ Data save failed.\n\nDetails: "+(lastSaveInfo||"unknown")+"\n\nPlease screenshot this and send it so it can be fixed.");
      });
      return next;
    });
  };

  let content;
  if(!db) content=(
    <div style={{...s.app,alignItems:"center",justifyContent:"center",gap:12,padding:24,textAlign:"center"}}>
      <div style={{width:40,height:40,border:`2px solid ${C.line}`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <span style={{...s.mono,fontSize:11,color:C.chromeDim}}>Loading…</span>
      <span style={{...s.mono,fontSize:10,color:connStatus.startsWith("✓")?C.good:connStatus.startsWith("⚠")?C.danger:C.chromeDim,marginTop:16,wordBreak:"break-word",maxWidth:340}}>{connStatus}</span>
    </div>
  );
  else if(!session){
    content = view==="login"
      ? <LoginScreen db={db} onLogin={setSession} connStatus={connStatus} onBack={()=>setView("public")}/>
      : <PublicLanding db={db} updateDB={updateDB} onLogin={()=>setView("login")}/>;
  }
  else if(session.role==="admin") content=<AdminApp db={db} updateDB={updateDB} onLogout={()=>{setSession(null);setView("public");}} refreshNow={refreshNow}/>;
  else content=<TenantApp db={db} updateDB={updateDB} tenantId={session.id} onLogout={()=>{setSession(null);setView("public");}} refreshNow={refreshNow}/>;

  return <>{showSplash&&<Splash/>}{content}</>;
}

/* ═══════════════════════════════════════════════════════════ */
/*  PUBLIC LANDING (public-facing website — shown before login) */
/* ═══════════════════════════════════════════════════════════ */
const WA_NUMBER=OWNER_PHONE.replace(/\D/g,"").replace(/^1?/,"1"); // US → 1XXXXXXXXXX for wa.me
// New 5-state model
const PUBLIC_STATUS={
  "rent":     {label:"For Rent",       col:C.good},
  "sale":     {label:"For Sale",       col:C.blue},
  "rent-sale":{label:"Rent or Sale",   col:C.gold},
  "rented":   {label:"Not Available",  col:C.chromeDim},
  "sold":     {label:"Sold",           col:C.danger},
};
// which statuses are still "open" to the public (apply + see pricing)
const isRentable=(st)=>st==="rent"||st==="rent-sale";
const isForSale =(st)=>st==="sale"||st==="rent-sale";
const isOpen    =(st)=>isRentable(st)||isForSale(st); // rent / sale / rent-sale
const PUBLIC_SERVICES=[
  {icon:ICONS.trailer,title:"Trailer Rental",desc:"Fully-equipped food trailers by the day or month — generator, kitchen, and refrigeration included."},
  {icon:ICONS.credit,title:"Rent-to-Own",desc:"Lease now and apply your payments toward ownership. Ask us about current rent-to-own units."},
  {icon:ICONS.truck,title:"Trailer Transport",desc:"We deliver and relocate trailers to your site. Request a transport quote any time."},
  {icon:ICONS.wrench,title:"Repair & Inspection",desc:"On-site maintenance, equipment repair, and pre-event inspections for your food trailer."},
];

/* ── 3D configurator options (scalable — shared by every trailer) ── */
const BODY_COLORS=[
  {id:"white", label:"Classic White",   hex:"#e8e6e0", up:0},
  {id:"silver",label:"Brushed Silver",  hex:"#9ea3aa", up:200},
  {id:"black", label:"Matte Black",      hex:"#1a1a1d", up:300},
  {id:"red",   label:"Texan Red",        hex:"#8f2d2d", up:300},
  {id:"gold",  label:"Desert Gold",      hex:"#c89b3c", up:450},
];
const EQUIP_OPTIONS=[
  {id:"griddle",label:"Flat-top Griddle",       up:0,    color:"#3a3a40"},
  {id:"range",  label:"6-Burner Range",         up:1500, color:"#2e2f33"},
  {id:"fryer",  label:"Double Fryer",           up:1200, color:"#45474d"},
  {id:"fridge", label:"Reach-in Refrigerator",  up:900,  color:"#c9ccd2"},
  {id:"hood",   label:"Vent Hood + Suppression",up:1800, color:"#55575d"},
];

/* ── Interactive 3D trailer viewer (Three.js, loaded from index.html) ──
   Builds an accurately-proportioned trailer from the unit's REAL length,
   recolors the body live, and shows the interior equipment the customer
   selects. If a real GLB model URL is set on the trailer it loads that
   instead. Falls back to a photo/message if the 3D engine can't load.     */
function Trailer3DViewer({trailer,color,equip,interior}){
  const mountRef=useRef(null);
  const ctxRef=useRef({});
  const [ready,setReady]=useState(typeof window!=="undefined" && !!window.THREE);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    if(window.THREE){setReady(true);return;}
    let n=0; const iv=setInterval(()=>{
      if(window.THREE){setReady(true);clearInterval(iv);}
      else if(++n>50){setFailed(true);clearInterval(iv);}
    },200);
    return ()=>clearInterval(iv);
  },[]);

  // scene setup (once)
  useEffect(()=>{
    if(!ready||!mountRef.current||!window.THREE) return;
    const THREE=window.THREE, mount=mountRef.current;
    let W=mount.clientWidth||360, H=340;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b0b0d);
    const camera=new THREE.PerspectiveCamera(45,W/H,0.1,1000);
    let renderer;
    try{ renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); }
    catch(e){ setFailed(true); return; }
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x1a1a1a,0.95));
    const d1=new THREE.DirectionalLight(0xffffff,0.85); d1.position.set(12,20,10); scene.add(d1);
    const d2=new THREE.DirectionalLight(0xc89b3c,0.25); d2.position.set(-10,6,-12); scene.add(d2);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(40,48),new THREE.MeshStandardMaterial({color:0x141417,roughness:1}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-0.01; scene.add(ground);
    scene.add(new THREE.GridHelper(60,60,0x2a2a2e,0x17171a));
    const controls=new THREE.OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=0.08;
    controls.minDistance=6; controls.maxDistance=55; controls.maxPolarAngle=Math.PI/2.03;
    const group=new THREE.Group(); scene.add(group);
    const Lft=parseFloat((trailer.length||"").match(/[\d.]+/)?.[0])||20;
    camera.position.set(Lft*1.0,Lft*0.6,Lft*1.05); controls.target.set(0,2.5,0);
    ctxRef.current={THREE,scene,camera,renderer,controls,group,mount};
    let raf; const loop=()=>{ raf=requestAnimationFrame(loop); controls.update(); renderer.render(scene,camera); }; loop();
    const onResize=()=>{ const w=mount.clientWidth||360; camera.aspect=w/H; camera.updateProjectionMatrix(); renderer.setSize(w,H); };
    window.addEventListener("resize",onResize);
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",onResize); try{controls.dispose();renderer.dispose();if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);}catch(e){} };
  },[ready]);

  // (re)build the trailer whenever config changes
  useEffect(()=>{
    const ctx=ctxRef.current; if(!ctx.THREE||!ctx.group) return;
    const THREE=ctx.THREE, group=ctx.group;
    while(group.children.length){ const c=group.children.pop(); if(c.geometry&&c.geometry.dispose)c.geometry.dispose(); }
    const mat=(hex,o)=>new THREE.MeshStandardMaterial(Object.assign({color:new THREE.Color(hex),roughness:0.55,metalness:0.18},o||{}));
    const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

    if(trailer.modelUrl && THREE.GLTFLoader){
      try{ new THREE.GLTFLoader().load(trailer.modelUrl,(g)=>group.add(g.scene),undefined,()=>buildParametric()); return; }
      catch(e){ /* fall through */ }
    }
    buildParametric();

    function buildParametric(){
      const Lft=parseFloat((trailer.length||"").match(/[\d.]+/)?.[0])||20;
      const L=Lft, Wd=8, Ht=7, axle=2.2;
      const bodyHex=(BODY_COLORS.find(c=>c.id===color)||BODY_COLORS[0]).hex;
      const chassis=box(L+1,0.5,Wd-0.6,mat("#232327",{metalness:0.5,roughness:0.5})); chassis.position.y=axle; group.add(chassis);
      const body=box(L,Ht,Wd,mat(bodyHex,{roughness:0.45,metalness:0.15})); body.position.y=axle+Ht/2+0.3; group.add(body);
      const roof=box(L-0.3,0.3,Wd-0.3,mat("#d8d8d8",{roughness:0.4})); roof.position.y=axle+Ht+0.45; group.add(roof);
      const stripe=box(L+0.02,0.9,0.03,mat("#c89b3c",{metalness:0.4,roughness:0.3})); stripe.position.set(0,axle+Ht*0.2,Wd/2+0.02); group.add(stripe);
      const win=box(L*0.55,Ht*0.4,0.12,mat("#11141a",{metalness:0.3,roughness:0.15})); win.position.set(-L*0.05,axle+Ht*0.62,Wd/2+0.07); group.add(win);
      const awning=box(L*0.6,0.08,2.2,mat(bodyHex)); awning.position.set(-L*0.05,axle+Ht*0.88,Wd/2+1.1); awning.rotation.x=-0.5; group.add(awning);
      const door=box(0.12,Ht*0.8,Wd*0.4,mat("#2a2d33")); door.position.set(-L/2-0.02,axle+Ht*0.45,0); group.add(door);
      const hitch=box(3,0.25,0.25,mat("#1b1b1e",{metalness:0.6})); hitch.position.set(L/2+1.4,axle-0.25,0); group.add(hitch);
      const wheelGeo=new THREE.CylinderGeometry(1.0,1.0,0.6,24), wheelMat=mat("#0e0e10",{roughness:0.9,metalness:0});
      [[L*0.22,Wd/2],[L*0.22,-Wd/2],[-L*0.16,Wd/2],[-L*0.16,-Wd/2]].forEach(([x,z])=>{ const w=new THREE.Mesh(wheelGeo,wheelMat); w.rotation.x=Math.PI/2; w.position.set(x,1.0,z); group.add(w); });
      if(interior){
        body.material.transparent=true; body.material.opacity=0.16; roof.visible=false; win.visible=false;
        const floorY=axle+0.55; let x=-L/2+1.5;
        const addUnit=(w,h,d,hex,z)=>{ const u=box(w,h,d,mat(hex,{metalness:0.5,roughness:0.4})); u.position.set(x+w/2,floorY+h/2,z); group.add(u); x+=w+0.5; };
        EQUIP_OPTIONS.forEach(op=>{
          if(!equip.includes(op.id)) return;
          if(op.id==="fridge") addUnit(2.2,4.2,2,op.color,Wd/2-1.3);
          else if(op.id==="hood"){ const h=box(L*0.5,0.5,2.6,mat(op.color)); h.position.set(-L*0.05,axle+Ht-0.55,Wd/2-1.4); group.add(h); }
          else addUnit(2.6,2.2,2.2,op.color,Wd/2-1.3);
        });
        const counter=box(L-2,2.0,1.5,mat("#8a8d93",{metalness:0.3,roughness:0.5})); counter.position.set(0,floorY+1.0,-Wd/2+1.0); group.add(counter);
      }
    }
  },[ready,trailer.id,trailer.modelUrl,color,equip.join(","),interior]);

  if(failed) return(
    <div style={{height:340,borderRadius:10,border:`1px solid ${C.line}`,background:C.ink2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,textAlign:"center",padding:20}}>
      {trailer.photo
        ? <img src={trailer.photo} alt={trailer.name} style={{maxWidth:"100%",maxHeight:200,borderRadius:8,objectFit:"cover"}}/>
        : <Icon d={ICONS.trailer} size={46} color={C.line}/>}
      <div style={{fontSize:12,color:C.chromeDim,maxWidth:300,lineHeight:1.5}}>3D view couldn't load here (needs an internet connection). It works on the live website.</div>
    </div>
  );
  return(
    <div style={{position:"relative"}}>
      <div ref={mountRef} style={{width:"100%",height:340,borderRadius:10,overflow:"hidden",border:`1px solid ${C.lineBright}`,background:C.ink,touchAction:"none"}}/>
      {!ready && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><span style={{...s.mono,fontSize:10,color:C.chromeDim}}>Loading 3D…</span></div>}
      <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
        <span style={{...s.mono,fontSize:9.5,color:C.chromeDim,background:"rgba(11,11,13,0.6)",padding:"4px 10px",borderRadius:99}}>drag to rotate · pinch/scroll to zoom</span>
      </div>
    </div>
  );
}

function PhotoCarousel({photos,alt}){
  const [i,setI]=useState(0);
  if(!photos||photos.length===0) return null;
  const go=(d)=>setI(x=>(x+d+photos.length)%photos.length);
  return(
    <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:`1px solid ${C.lineBright}`,background:C.ink2}}>
      <img src={photos[i]} alt={alt} style={{width:"100%",height:260,objectFit:"cover",display:"block"}}/>
      {photos.length>1&&(<>
        <button onClick={()=>go(-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",border:"none",color:"#fff",width:36,height:36,borderRadius:99,cursor:"pointer",fontSize:18}}>‹</button>
        <button onClick={()=>go(1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",border:"none",color:"#fff",width:36,height:36,borderRadius:99,cursor:"pointer",fontSize:18}}>›</button>
        <div style={{position:"absolute",bottom:10,left:0,right:0,display:"flex",gap:5,justifyContent:"center"}}>
          {photos.map((_,x)=><span key={x} onClick={()=>setI(x)} style={{width:7,height:7,borderRadius:99,background:x===i?C.gold:"rgba(255,255,255,0.5)",cursor:"pointer"}}/>)}
        </div>
        <div style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,0.6)",color:"#fff",...s.mono,fontSize:10,padding:"3px 8px",borderRadius:99}}>{i+1}/{photos.length}</div>
      </>)}
    </div>
  );
}

function PublicTrailerDetail({trailer,onBack,onInquire,onApply,onView}){
  const [color,setColor]=useState(BODY_COLORS[0].id);
  const [equip,setEquip]=useState(["griddle"]);
  const [interior,setInterior]=useState(false);
  const [showInfo,setShowInfo]=useState(false);
  useEffect(()=>{ onView&&onView(); },[]); // count one public view
  const open=isOpen(trailer.status);
  const rentable=isRentable(trailer.status);
  const st=PUBLIC_STATUS[trailer.status]||PUBLIC_STATUS["rent-sale"];
  const colorUp=(BODY_COLORS.find(c=>c.id===color)||{}).up||0;
  const equipUp=EQUIP_OPTIONS.filter(o=>equip.includes(o.id)).reduce((a,o)=>a+o.up,0);
  const base=trailer.purchasePrice||0;
  const total=base+colorUp+equipUp;
  const toggle=id=>setEquip(e=>e.includes(id)?e.filter(x=>x!==id):[...e,id]);
  const h2={fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:600,letterSpacing:"0.15em",textTransform:"uppercase",color:C.gold,margin:"24px 0 12px"};

  return(
    <div style={{paddingBottom:40}}>
      <div style={{position:"sticky",top:0,zIndex:15,background:"rgba(11,11,13,0.9)",backdropFilter:"blur(8px)",borderBottom:`1px solid ${C.line}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${C.line}`,color:C.paper,borderRadius:6,padding:"6px 11px",cursor:"pointer",fontSize:11,...s.mono,display:"flex",alignItems:"center",gap:5}}>
          <Icon d={ICONS.back} size={13} color={C.gold}/> Fleet
        </button>
        <div style={{fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:600,color:C.paper,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{trailer.nickname||trailer.name}</div>
        <Pill color={st.col}>{st.label}</Pill>
      </div>

      <div style={{padding:"18px 16px 0"}}>
        {/* Real photo gallery */}
        {(trailer.photos||[]).length>0 && <div style={{marginBottom:14}}><PhotoCarousel photos={trailer.photos} alt={trailer.name}/></div>}

        {/* Name + two BIG buttons: Info + Apply */}
        <div style={{textAlign:"center",marginBottom:14}}>
          {trailer.nickname&&<div style={{fontFamily:"'Oswald',sans-serif",fontSize:24,fontWeight:700,color:C.gold}}>{trailer.nickname}</div>}
          <div style={{fontSize:14,color:C.paper,marginTop:2}}>{trailer.name}</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowInfo(true)} style={{...s.btnGold,flex:1,padding:"15px",fontSize:13,background:"none",border:`1.5px solid ${C.gold}`,color:C.gold,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <Icon d={ICONS.book} size={16} color={C.gold}/> Full Info
          </button>
          {open
            ? <button onClick={()=>onApply&&onApply()} style={{...s.btnGold,flex:1,padding:"15px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                <Icon d={ICONS.check} size={16} color={C.ink}/> Apply Now
              </button>
            : <div style={{flex:1,padding:"15px",borderRadius:4,border:`1px solid ${C.line}`,textAlign:"center",...s.mono,fontSize:11,color:st.col}}>{st.label}</div>}
        </div>

        <div style={h2}>Visualize & Customize (3D)</div>
        <Trailer3DViewer trailer={trailer} color={color} equip={equip} interior={interior}/>

        <div style={{display:"flex",gap:8,marginTop:12}}>
          {[["Exterior",false],["Interior & Kitchen",true]].map(([lbl,v])=>(
            <button key={lbl} onClick={()=>setInterior(v)}
              style={{flex:1,padding:"10px",borderRadius:7,cursor:"pointer",...s.mono,fontSize:11,letterSpacing:"0.05em",
                background:interior===v?C.gold:"none",color:interior===v?C.ink:C.paper,border:`1px solid ${interior===v?C.gold:C.line}`,fontWeight:600}}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={h2}>Body Color</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {BODY_COLORS.map(c=>(
            <button key={c.id} onClick={()=>setColor(c.id)} title={c.label}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:0}}>
              <span style={{width:40,height:40,borderRadius:"50%",background:c.hex,border:`2px solid ${color===c.id?C.gold:C.line}`,boxShadow:color===c.id?`0 0 0 2px ${C.ink},0 0 10px ${C.gold}55`:"none"}}/>
              <span style={{fontSize:9,...s.mono,color:color===c.id?C.gold:C.chromeDim}}>{c.up?"+"+fmt$(c.up):"std"}</span>
            </button>
          ))}
        </div>

        <div style={h2}>Equipment Package</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {EQUIP_OPTIONS.map(op=>{
            const on=equip.includes(op.id);
            return(
              <button key={op.id} onClick={()=>toggle(op.id)}
                style={{display:"flex",alignItems:"center",gap:11,background:on?C.gold+"14":C.steel,border:`1px solid ${on?C.gold:C.line}`,borderRadius:8,padding:"12px 14px",cursor:"pointer",textAlign:"left"}}>
                <span style={{width:20,height:20,borderRadius:5,flexShrink:0,border:`2px solid ${on?C.gold:C.chromeDim}`,background:on?C.gold:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {on&&<Icon d={ICONS.check} size={12} color={C.ink}/>}
                </span>
                <span style={{flex:1,fontSize:13,color:C.paper}}>{op.label}</span>
                <span style={{...s.mono,fontSize:11,color:on?C.gold:C.chromeDim}}>{op.up?"+"+fmt$(op.up):"included"}</span>
              </button>
            );
          })}
        </div>

        <div style={{marginTop:18,background:C.steel,border:`1px solid ${C.lineBright}`,borderRadius:10,padding:"16px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.chromeDim,marginBottom:6}}><span>Base purchase price</span><span style={s.mono}>{fmt$(base)}</span></div>
          {colorUp>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.chromeDim,marginBottom:6}}><span>Finish upgrade</span><span style={s.mono}>+{fmt$(colorUp)}</span></div>}
          {equipUp>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.chromeDim,marginBottom:6}}><span>Equipment add-ons</span><span style={s.mono}>+{fmt$(equipUp)}</span></div>}
          <div style={{borderTop:`1px solid ${C.line}`,marginTop:8,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:12,color:C.paper,fontWeight:600}}>Your configuration</span>
            <span style={{...s.mono,fontSize:22,color:C.gold,fontWeight:600}}>{fmt$(total)}</span>
          </div>
          {rentable&&(
            <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
              {trailer.dailyRate?<span style={{...s.mono,fontSize:11,color:C.chromeDim}}>Rent {fmt$(trailer.dailyRate)}/day</span>:null}
              {trailer.monthlyRate?<span style={{...s.mono,fontSize:11,color:C.chromeDim}}>· {fmt$(trailer.monthlyRate)}/month</span>:null}
            </div>
          )}
        </div>

        <div style={h2}>Specifications</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,background:C.steel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 16px"}}>
          {trailer.length&&<SpecRow label="Length" val={trailer.length}/>}
          {trailer.power&&<SpecRow label="Power" val={trailer.power}/>}
          {trailer.kitchen&&<SpecRow label="Kitchen" val={trailer.kitchen}/>}
          {trailer.fridge&&<SpecRow label="Refrigeration" val={trailer.fridge}/>}
          {trailer.vin&&<SpecRow label="VIN" val={trailer.vin}/>}
          {trailer.make&&<SpecRow label="Make" val={trailer.make}/>}
        </div>

        {open && <button onClick={()=>onApply&&onApply()} style={{...s.btnGold,marginTop:24}}>Apply {rentable?"to Rent":"to Buy"} This Trailer</button>}
        <button onClick={()=>onInquire(trailer)} style={{...s.btnGold,marginTop:10,background:"none",border:`1px solid ${C.lineBright}`,color:C.paper}}>Inquire / Ask a Question</button>
        <div style={{textAlign:"center",fontSize:10.5,color:C.chromeDim,marginTop:10,lineHeight:1.5}}>
          The 3D preview is a visual configurator. Final specs and pricing are confirmed with you directly.
        </div>
      </div>

      {/* Professional Info modal */}
      {showInfo&&(
        <div onClick={()=>setShowInfo(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:`linear-gradient(160deg,${C.steel2},${C.ink2})`,border:`1px solid ${C.gold}55`,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"88vh",overflowY:"auto",boxShadow:`0 20px 60px rgba(0,0,0,0.6)`}}>
            {(trailer.photos||[]).length>0 && <div style={{position:"relative"}}><img src={trailer.photos[0]} alt="" style={{width:"100%",height:180,objectFit:"cover",borderRadius:"16px 16px 0 0"}}/><div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(11,11,13,0.95))",borderRadius:"16px 16px 0 0"}}/></div>}
            <div style={{padding:"4px 22px 26px",marginTop:(trailer.photos||[]).length>0?-50:16,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  {trailer.nickname&&<div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:C.gold,lineHeight:1.1}}>{trailer.nickname}</div>}
                  <div style={{fontSize:15,color:C.paper,fontWeight:600}}>{trailer.name}</div>
                </div>
                <button onClick={()=>setShowInfo(false)} style={{background:"rgba(0,0,0,0.4)",border:"none",cursor:"pointer",padding:6,borderRadius:99}}><Icon d={ICONS.close} size={18} color={C.paper}/></button>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                <Pill color={st.col}>{st.label}</Pill>
                {trailer.length&&<Pill color={C.chromeDim}>{trailer.length}</Pill>}
              </div>
              {trailer.info&&<div style={{fontSize:14,color:C.paperDim,lineHeight:1.7,marginTop:16,whiteSpace:"pre-wrap"}}>{trailer.info}</div>}
              <div style={{marginTop:18,display:"flex",flexDirection:"column",gap:7,background:C.steel,border:`1px solid ${C.line}`,borderRadius:10,padding:"14px 16px"}}>
                {trailer.power&&<SpecRow label="Power" val={trailer.power}/>}
                {trailer.kitchen&&<SpecRow label="Kitchen" val={trailer.kitchen}/>}
                {trailer.fridge&&<SpecRow label="Refrigeration" val={trailer.fridge}/>}
                {rentable&&trailer.monthlyRate?<SpecRow label="Rent" val={`${fmt$(trailer.monthlyRate)}/month`}/>:null}
                {isForSale(trailer.status)&&trailer.purchasePrice?<SpecRow label="Price" val={fmt$(trailer.purchasePrice)}/>:null}
              </div>
              {open && <button onClick={()=>{setShowInfo(false);onApply&&onApply();}} style={{...s.btnGold,marginTop:18}}>Apply Now</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PublicLanding({db,updateDB,onLogin}){
  const [inquiry,setInquiry]=useState(null); // trailer object or {name:"General"}
  const [detail,setDetail]=useState(null);   // trailer being viewed in 3D detail
  const [applyFor,setApplyFor]=useState(null); // null | "" (general) | trailerId
  const trailers=db.trailers||[];

  const logInquiry=(trailer,channel)=>{
    updateDB(d=>addNotification(d,{forRole:"admin",title:"New Public Inquiry",body:`Website visitor is asking about ${trailer.name} (via ${channel}).`}));
  };
  const viaWhatsApp=(trailer)=>{
    logInquiry(trailer,"WhatsApp");
    const msg=encodeURIComponent(`Hi, I'm interested in the "${trailer.name}" I saw on your website. Is it available?`);
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`,"_blank");
  };
  const viaEmail=(trailer)=>{
    logInquiry(trailer,"Email");
    const subj=encodeURIComponent(`Inquiry: ${trailer.name}`);
    const body=encodeURIComponent(`Hi,\n\nI'm interested in the "${trailer.name}" I saw on your website. Please send me more details on availability and pricing.\n\nThank you.`);
    window.open(`mailto:${OWNER_EMAIL}?subject=${subj}&body=${body}`,"_self");
  };

  const sec={padding:"34px 20px",borderTop:`1px solid ${C.line}`};
  const h2={fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:600,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold,marginBottom:4};
  const h2sub={fontSize:12,color:C.chromeDim,marginBottom:20,lineHeight:1.5};

  if(detail) return(
    <div style={{...s.app,direction:"ltr"}}>
      <PublicTrailerDetail trailer={detail} onBack={()=>setDetail(null)} onInquire={t=>setInquiry(t)} onApply={()=>setApplyFor(detail.id)}
        onView={()=>updateDB(d=>{const x=d.trailers.find(y=>y.id===detail.id);if(x)x.views=(x.views||0)+1;return d;})}/>
      {inquiry && <InquiryModal trailer={inquiry} onClose={()=>setInquiry(null)} onEmail={()=>{viaEmail(inquiry);setInquiry(null);}}/>}
      {applyFor!==null && <ApplicationForm db={db} updateDB={updateDB} onClose={()=>setApplyFor(null)} preTrailerId={applyFor}/>}
    </div>
  );

  return(
    <div style={{...s.app,direction:"ltr"}}>
      {/* Tenant Login — small, top corner */}
      <button onClick={onLogin}
        style={{position:"absolute",top:14,right:14,zIndex:20,background:"rgba(17,17,20,0.7)",backdropFilter:"blur(6px)",border:`1px solid ${C.lineBright}`,color:C.paper,padding:"7px 12px",borderRadius:6,fontSize:10.5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
        <Icon d={ICONS.user} size={12} color={C.gold}/> Tenant Login
      </button>

      {/* Hero */}
      <div style={{padding:"64px 24px 40px",textAlign:"center",background:`radial-gradient(ellipse at top,rgba(200,155,60,0.10),transparent 70%)`}}>
        <img src={LOGO_URI} alt="Texan Food Trailer Solution" style={{width:280,maxWidth:"86%",height:"auto",margin:"0 auto 18px",display:"block",borderRadius:12,filter:"drop-shadow(0 4px 20px rgba(200,155,60,0.3))"}}/>
        <h1 style={{fontFamily:"'Oswald',sans-serif",fontSize:27,fontWeight:700,letterSpacing:"0.02em",color:C.paper,lineHeight:1.15,margin:"0 0 10px"}}>Texan Food Trailers<br/>Solution</h1>
        <div style={{fontSize:13,color:C.paperDim,lineHeight:1.6,maxWidth:340,margin:"0 auto"}}>
          Fully-equipped food trailers for rent, rent-to-own, and sale across Texas. View any trailer in interactive 3D, customize the color and equipment, then reach out — we'll get you rolling.
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:22,flexWrap:"wrap"}}>
          <button onClick={()=>setApplyFor("")} style={{...s.btnGold,width:"auto",padding:"12px 22px"}}>Apply to Rent</button>
          <a href="#fleet" style={{...s.btnGold,width:"auto",padding:"12px 22px",textDecoration:"none",display:"inline-block",background:"none",border:`1px solid ${C.lineBright}`,color:C.paper}}>View the Fleet</a>
          <button onClick={()=>setInquiry({name:"your services",_general:true})}
            style={{background:"none",border:`1px solid ${C.lineBright}`,color:C.paper,borderRadius:4,padding:"12px 22px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"}}>
            Contact Us
          </button>
        </div>
      </div>

      {/* Fleet gallery */}
      <div id="fleet" style={sec}>
        <div style={h2}>Our Fleet</div>
        <div style={h2sub}>{trailers.length} trailer{trailers.length!==1?"s":""} — photo, specs, price, and current status.</div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {trailers.map(tr=>{
            const st=PUBLIC_STATUS[tr.status]||PUBLIC_STATUS["rent-sale"];
            const open=isOpen(tr.status);
            const rentable=isRentable(tr.status);
            const cover=(tr.photos&&tr.photos[0])||tr.photo;
            return(
              <div key={tr.id} style={{background:C.steel,border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
                {cover
                  ? <div style={{position:"relative",height:180,overflow:"hidden",background:C.ink2}}>
                      <img src={cover} alt={tr.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <span style={{position:"absolute",top:10,right:10}}><Pill color={st.col}>{st.label}</Pill></span>
                      {(tr.photos||[]).length>1&&<span style={{position:"absolute",bottom:10,left:10,background:"rgba(0,0,0,0.6)",color:"#fff",...s.mono,fontSize:10,padding:"3px 8px",borderRadius:99}}>📷 {tr.photos.length}</span>}
                    </div>
                  : <div style={{height:110,background:`linear-gradient(135deg,${C.steel2},${C.ink2})`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                      <Icon d={ICONS.trailer} size={44} color={C.line}/>
                      <span style={{position:"absolute",top:10,right:10}}><Pill color={st.col}>{st.label}</Pill></span>
                    </div>}
                <div style={{padding:"14px 16px 16px"}}>
                  {tr.nickname&&<div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,fontWeight:700,color:C.gold,lineHeight:1.1}}>{tr.nickname}</div>}
                  <div style={{fontFamily:"'Oswald',sans-serif",fontSize:tr.nickname?14:17,fontWeight:600,color:tr.nickname?C.paperDim:C.paper,marginBottom:8}}>{tr.name}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                    {tr.length&&<SpecRow label="Length" val={tr.length}/>}
                    {tr.power&&<SpecRow label="Power" val={tr.power}/>}
                    {tr.kitchen&&<SpecRow label="Kitchen" val={tr.kitchen}/>}
                  </div>
                  {open&&(
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"baseline",marginBottom:14}}>
                      {rentable&&tr.dailyRate?<Price big={fmt$(tr.dailyRate)} small="/day"/>:null}
                      {rentable&&tr.monthlyRate?<Price big={fmt$(tr.monthlyRate)} small="/month"/>:null}
                      {isForSale(tr.status)&&tr.purchasePrice?<Price big={fmt$(tr.purchasePrice)} small="to buy"/>:null}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,marginTop:2}}>
                    <button onClick={()=>setDetail(tr)} style={{...s.btnGold,flex:1,background:"none",border:`1px solid ${C.lineBright}`,color:C.paper,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                      <Icon d={ICONS.eye} size={14} color={C.gold}/> View Details
                    </button>
                    {open && <button onClick={()=>setApplyFor(tr.id)} style={{...s.btnGold,flex:1}}>Apply</button>}
                  </div>
                </div>
              </div>
            );
          })}
          {trailers.length===0 && <div style={{color:C.chromeDim,fontSize:13}}>Fleet listings coming soon.</div>}
        </div>
      </div>

      {/* Services */}
      <div style={sec}>
        <div style={h2}>Services</div>
        <div style={h2sub}>Everything you need to get a food trailer on the road.</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {PUBLIC_SERVICES.map((sv,i)=>(
            <div key={i} style={{display:"flex",gap:13,alignItems:"flex-start",background:C.steel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 15px"}}>
              <div style={{flexShrink:0,width:38,height:38,borderRadius:8,background:C.gold+"18",border:`1px solid ${C.gold}33`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon d={sv.icon} size={19} color={C.gold}/>
              </div>
              <div>
                <div style={{fontWeight:600,fontSize:14,color:C.paper,marginBottom:3}}>{sv.title}</div>
                <div style={{fontSize:12,color:C.chromeDim,lineHeight:1.5}}>{sv.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={sec}>
        <div style={h2}>Get in Touch</div>
        <div style={h2sub}>Questions about a trailer or a service? Reach out directly.</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <a href={`tel:${OWNER_PHONE}`} style={{...contactBtnStyle}}>
            <Icon d={ICONS.contact} size={16} color={C.gold}/> <span>Call {OWNER_PHONE}</span>
          </a>
          <a href={`mailto:${OWNER_EMAIL}`} style={{...contactBtnStyle}}>
            <Icon d={ICONS.book} size={16} color={C.gold}/> <span>{OWNER_EMAIL}</span>
          </a>
        </div>
        <div style={{textAlign:"center",fontSize:10,...s.mono,color:C.chromeDim,marginTop:30,opacity:0.6}}>
          © {new Date().getFullYear()} Texan Food Trailers Solution · Texas, USA
        </div>
      </div>

      {inquiry && <InquiryModal trailer={inquiry} onClose={()=>setInquiry(null)} onEmail={()=>{viaEmail(inquiry);setInquiry(null);}}/>}
      {applyFor!==null && <ApplicationForm db={db} updateDB={updateDB} onClose={()=>setApplyFor(null)} preTrailerId={applyFor}/>}
    </div>
  );
}
const contactBtnStyle={display:"flex",alignItems:"center",gap:11,background:C.steel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 16px",color:C.paper,fontSize:13,textDecoration:"none",width:"100%",boxSizing:"border-box"};
function SpecRow({label,val}){
  return <div style={{display:"flex",gap:8,fontSize:12,lineHeight:1.4}}>
    <span style={{color:C.chromeDim,minWidth:92,flexShrink:0,...s.mono,fontSize:10.5,letterSpacing:"0.04em",textTransform:"uppercase",paddingTop:1}}>{label}</span>
    <span style={{color:C.paperDim}}>{val}</span>
  </div>;
}
function Price({big,small}){
  return <div style={{...s.mono}}><span style={{fontSize:19,color:C.gold,fontWeight:600}}>{big}</span> <span style={{fontSize:11,color:C.chromeDim}}>{small}</span></div>;
}
function InquiryModal({trailer,onClose,onEmail}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.steel,borderTop:`2px solid ${C.gold}`,borderRadius:"14px 14px 0 0",padding:"22px 20px 30px",width:"100%",maxWidth:480,boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:600,color:C.paper}}>Inquire</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon d={ICONS.close} size={18} color={C.chromeDim}/></button>
        </div>
        <div style={{fontSize:12.5,color:C.chromeDim,marginBottom:20,lineHeight:1.5}}>About <strong style={{color:C.paper}}>{trailer.name}</strong>. Send us an email and we'll get right back to you.</div>
        <button onClick={onEmail} style={{...s.btnGold}}>Send an Email</button>
      </div>
    </div>
  );
}

function LoginScreen({db,onLogin,connStatus,onBack}){
  const [mode,setMode]=useState("tenant"); // tenant | admin
  const [phone,setPhone]=useState("");
  const [pin,setPin]=useState("");
  const [adminPin,setAdminPin]=useState("");
  const [err,setErr]=useState("");
  const [lang,setLang]=useState("en");
  const isRTL=RTL_LANGS.includes(lang);
  const ADMIN_PIN="9003";

  const doLogin=()=>{
    setErr("");
    if(mode==="admin"){
      if(adminPin===ADMIN_PIN)onLogin({role:"admin"});
      else setErr("Wrong PIN.");
      return;
    }
    const idIn=(phone||"").trim().toLowerCase();
    const found=db.tenants.find(x=>(x.phone===phone||x.email===phone||(x.email||"").toLowerCase()===idIn||(x.username&&x.username.toLowerCase()===idIn))&&x.pin===pin);
    if(found)onLogin({role:"tenant",id:found.id});
    else setErr("Phone/email or PIN is incorrect. Contact Abu Arab if you need help logging in.");
  };

  return(
    <div style={{...s.app,justifyContent:"center",padding:28,direction:mode==="tenant"&&isRTL?"rtl":"ltr"}}>
      {onBack&&(
        <button onClick={onBack} title="Back to website"
          style={{position:"absolute",top:18,insetInlineStart:18,background:"none",border:`1px solid ${C.line}`,color:C.chromeDim,padding:"5px 10px",cursor:"pointer",borderRadius:4,fontSize:11,...s.mono,display:"flex",alignItems:"center",gap:5}}>
          <Icon d={ICONS.back} size={12} color={C.chromeDim}/> Website
        </button>
      )}
      {mode==="tenant"&&(
        <select value={lang} onChange={e=>setLang(e.target.value)} title="Language"
          style={{position:"absolute",top:18,insetInlineEnd:18,background:"none",border:`1px solid ${C.line}`,color:C.chromeDim,padding:"5px 6px",cursor:"pointer",borderRadius:4,fontSize:11,...s.mono,maxWidth:82}}>
          {LANGUAGES.map(l=><option key={l.code} value={l.code} style={{background:C.steel,color:C.paper}}>{l.label}</option>)}
        </select>
      )}
      <div style={{textAlign:"center",marginBottom:40}}>
        <img src={LOGO_URI} alt="Texan Food Trailer Solution" style={{width:230,maxWidth:"80%",height:"auto",margin:"0 auto 12px",display:"block",borderRadius:10,filter:"drop-shadow(0 4px 16px rgba(200,155,60,0.25))"}}/>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.gold,letterSpacing:"0.18em",textTransform:"uppercase",marginTop:3}}>
          {mode==="tenant" ? t("tenantPortal",lang) : "Staff Access"}
        </div>
      </div>

      {mode==="tenant" ? (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={s.label}>{t("phoneOrEmail",lang)}</label>
            <input style={s.input} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Username, phone, or email" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          </div>
          <div>
            <label style={s.label}>{t("pin4digit",lang)}</label>
            <input style={s.input} type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          </div>
          {err&&<div style={{color:C.danger,fontSize:12,...s.mono}}>{err}</div>}
          <button style={{...s.btnGold,marginTop:4}} onClick={doLogin}>{t("signIn",lang)}</button>
          <div style={{textAlign:"center",fontSize:11,color:C.chromeDim,...s.mono,marginTop:10}}>
            {t("troubleLogin",lang)}
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={s.label}>Admin PIN</label>
            <input style={s.input} type="password" maxLength={4} value={adminPin} onChange={e=>setAdminPin(e.target.value)} placeholder="••••" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          </div>
          {err&&<div style={{color:C.danger,fontSize:12,...s.mono}}>{err}</div>}
          <button style={{...s.btnGold,marginTop:4}} onClick={doLogin}>Enter Admin Panel</button>
        </div>
      )}

      {/* Subtle staff-access link — intentionally low-key, not something a tenant needs to notice */}
      <button onClick={()=>{ setMode(m=>m==="tenant"?"admin":"tenant"); setErr(""); }}
        style={{background:"none",border:"none",color:C.chromeDim,fontSize:10,...s.mono,marginTop:32,cursor:"pointer",opacity:0.5,alignSelf:"center"}}>
        {mode==="tenant" ? t("staffAccess",lang) : "← Back to tenant login"}
      </button>
      <div style={{textAlign:"center",fontSize:9,...s.mono,marginTop:10,color:connStatus?.startsWith("✓")?C.good:connStatus?.startsWith("⚠")?C.danger:C.chromeDim,opacity:0.7,wordBreak:"break-word"}}>
        {connStatus}
      </div>
    </div>
  );
}

function TenantApp({db,updateDB,tenantId,onLogout,refreshNow}){
  const [tab,setTab]=useState("home");
  const [justRefreshed,setJustRefreshed]=useState(false);
  const [lang,setLang]=useState("en");
  const isRTL=RTL_LANGS.includes(lang);
  const doRefresh=async()=>{ await refreshNow(); setJustRefreshed(true); setTimeout(()=>setJustRefreshed(false),2000); };
  const tenant=db.tenants.find(t=>t.id===tenantId);
  const trailer=tenant?db.trailers.find(tr=>tr.id===tenant.trailerId):null;
  const myPayments=db.payments.filter(p=>p.tenantId===tenantId).sort((a,b)=>b.date.localeCompare(a.date));
  const allMyNotifs=db.notifications.filter(n=>n.forRole==="tenant"||n.forTenantId===tenantId).slice().reverse();
  const myNotifs=db.notifications.filter(n=>n.forRole==="tenant"||n.forTenantId===tenantId).filter(n=>!n.read);
  const [showNotifs,setShowNotifs]=useState(false);
  const markRead=(id)=>updateDB(db=>{db.notifications=db.notifications.map(n=>n.id===id?{...n,read:true}:n);return db;});
  const markAllRead=()=>updateDB(db=>{db.notifications=db.notifications.map(n=>(n.forTenantId===tenantId||n.forRole==="tenant")?{...n,read:true}:n);return db;});
  const deleteNotif=(id)=>updateDB(db=>{db.notifications=db.notifications.filter(n=>n.id!==id);return db;});
  const pendingPay=myPayments.find(p=>p.status==="pending");

  const tabs=[
    {id:"home",icon:ICONS.home,label:t("home",lang)},
    {id:"payments",icon:ICONS.pay,label:t("payments",lang)},
    {id:"credit",icon:ICONS.credit,label:t("credit",lang)},
    {id:"services",icon:ICONS.wrench,label:t("services",lang)},
    {id:"contract",icon:ICONS.contract,label:t("contract",lang)},
  ];

  return(
    <div style={{...s.app,direction:isRTL?"rtl":"ltr"}}>
      <div style={{background:C.steel,borderBottom:`1px solid ${C.line}`,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>Texan Food Trailers</div>
          <div style={{fontSize:11,color:C.gold,...s.mono,marginTop:1}}>{tenant?.name}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={lang} onChange={e=>setLang(e.target.value)} title="Language"
            style={{background:"none",border:`1px solid ${C.line}`,color:C.chromeDim,padding:"5px 6px",cursor:"pointer",borderRadius:4,fontSize:11,...s.mono,maxWidth:78}}>
            {LANGUAGES.map(l=><option key={l.code} value={l.code} style={{background:C.steel,color:C.paper}}>{l.label}</option>)}
          </select>
          <button onClick={doRefresh} title="Refresh" style={{background:"none",border:"none",color:justRefreshed?C.good:C.chromeDim,padding:6,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            {justRefreshed ? (
              <><Icon d={ICONS.check} size={16} color={C.good}/><span style={{fontSize:10,...s.mono}}>Refreshed</span></>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            )}
          </button>
          {allMyNotifs.length>0&&(
            <button onClick={()=>setShowNotifs(true)} style={{background:"none",border:"none",padding:4,position:"relative",cursor:"pointer"}}>
              <Icon d={ICONS.bell} size={20} color={myNotifs.length>0?C.gold:C.chromeDim}/>
              {myNotifs.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.gold,color:C.ink,borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{myNotifs.length}</span>}
            </button>
          )}
          <button onClick={onLogout} style={{background:"none",border:"none",color:C.chromeDim,padding:6}}>
            <Icon d={ICONS.logout} size={18}/>
          </button>
        </div>
      </div>

      {showNotifs&&<NotificationsPanel notifs={allMyNotifs} onClose={()=>setShowNotifs(false)} onMarkRead={markRead} onMarkAllRead={markAllRead} onDelete={deleteNotif}/>}

      <div style={{flex:1,overflowY:"auto",padding:"18px 16px 80px"}}>
        {tab==="home"     &&<TenantHome tenant={tenant} trailer={trailer} myPayments={myPayments} pendingPay={pendingPay} setTab={setTab} myNotifs={myNotifs} db={db} updateDB={updateDB} tenantId={tenantId} lang={lang}/>}
        {tab==="payments" &&<TenantPayments myPayments={myPayments} tenant={tenant} pendingPay={pendingPay} db={db} updateDB={updateDB} tenantId={tenantId} lang={lang}/>}
        {tab==="credit"   &&<TenantCredit tenant={tenant} trailer={trailer} myPayments={myPayments} lang={lang}/>}
        {tab==="services" &&<TenantServices db={db} updateDB={updateDB} tenantId={tenantId} tenant={tenant} lang={lang}/>}
        {tab==="contract" &&<TenantContract db={db} updateDB={updateDB} tenantId={tenantId} lang={lang}/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.steel,borderTop:`1px solid ${C.line}`,display:"flex",zIndex:50}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"none",border:"none",color:tab===t.id?C.gold:C.chromeDim,padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative"}}>
            {t.id==="payments"&&pendingPay&&<span style={{position:"absolute",top:7,right:"50%",transform:"translateX(120%)",width:6,height:6,borderRadius:"50%",background:C.gold}}/>}
            <Icon d={t.icon} size={19} color={tab===t.id?C.gold:C.chromeDim}/>
            <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.05em",textTransform:"uppercase"}}>{t.label}</span>
            {tab===t.id&&<span style={{position:"absolute",top:0,left:"15%",right:"15%",height:2,background:C.gold,borderRadius:2}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Tenant Home ─────────────────────────────────────────── */

function TenantHome({tenant,trailer,myPayments,pendingPay,setTab,myNotifs,db,updateDB,tenantId,lang}){
  const daysLeft=tenant?Math.max(0,Math.round((new Date(tenant.endDate)-new Date())/86400000)):0;
  const paid=myPayments.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const credit=Math.round(paid*(tenant?.creditRate||15)/100);
  const transApproved=(db.transportRequests||[]).filter(r=>r.tenantId===tenantId&&r.status==="quoted");

  const markNotifsRead=()=>{
    updateDB(db=>{
      db.notifications=db.notifications.map(n=>(n.forTenantId===tenantId||n.forRole==="tenant")?{...n,read:true}:n);
      return db;
    });
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fadein">
      <div>
        <div style={{...s.heading,fontSize:22,fontWeight:700}}>{t("welcomeBack",lang)}</div>
        <div style={{color:C.chromeDim,fontSize:13,marginTop:2}}>{tenant?.name} · Active Tenant</div>
      </div>

      {trailer&&(
        <div style={{...s.goldCard,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${C.gold}08,transparent)`,pointerEvents:"none"}}/>
          <div style={{fontSize:10,...s.mono,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{t("yourTrailer",lang)}</div>
          <div style={{...s.heading,fontSize:18,fontWeight:600,marginBottom:6}}>{trailer.name}</div>
          <div style={{fontSize:12,color:C.chromeDim}}>{trailer.length} · {trailer.power}</div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <StatMini label={t("monthlyRate",lang)} val={fmt$(tenant.monthlyRate)}/>
            <StatMini label={t("daysLeft",lang)} val={daysLeft+" days"}/>
            <StatMini label="Credit Built" val={fmt$(credit)}/>
          </div>
        </div>
      )}

      {/* notifications */}
      {myNotifs.length>0&&(
        <div style={{background:C.blueBg,border:`1px solid ${C.blue}44`,borderRadius:6,padding:"13px 15px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:C.blue}}>🔔 {myNotifs.length} New Notification{myNotifs.length>1?"s":""}</div>
            <button onClick={markNotifsRead} style={{background:"none",border:"none",color:C.chromeDim,fontSize:11,...s.mono,cursor:"pointer"}}>Mark all read</button>
          </div>
          {myNotifs.slice(0,3).map(n=>(
            <div key={n.id} style={{fontSize:12,color:C.paper,paddingTop:6,borderTop:`1px solid ${C.blue}22`,marginTop:6}}>
              <span style={{fontWeight:600}}>{n.title}</span> — {n.body}
            </div>
          ))}
        </div>
      )}

      {/* transport quote alert */}
      {transApproved.map(r=>(
        <div key={r.id} style={{background:C.goodBg,border:`1px solid ${C.good}44`,borderRadius:6,padding:"13px 15px"}}>
          <div style={{fontSize:12,fontWeight:600,color:C.good,marginBottom:4}}>Transport Quote Ready</div>
          <div style={{fontSize:13}}>From {r.from} → {r.to}</div>
          <div style={{fontSize:16,...s.mono,color:C.gold,margin:"6px 0"}}>Quoted: {fmt$(r.quotedPrice)}</div>
          <button onClick={()=>setTab("services")} style={{...s.btnGold,width:"auto",padding:"8px 14px",fontSize:10,marginTop:4}}>View & Accept →</button>
        </div>
      ))}

      {pendingPay&&(
        <div style={{background:C.warnBg,border:`1px solid ${C.warn}44`,borderRadius:6,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.warn}}>{t("paymentDue",lang)}</div>
              <div style={{fontSize:13,marginTop:3}}>{pendingPay.note} — <strong style={{color:C.paper}}>{fmt$(pendingPay.amount)}</strong></div>
            </div>
            <button onClick={()=>setTab("payments")} style={{...s.btnGold,width:"auto",padding:"8px 14px",fontSize:10}}>{t("payNow",lang)}</button>
          </div>
        </div>
      )}

      {(()=>{
        const lm=leaseMonths(tenant, db.payments);
        return(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div style={{...s.card,textAlign:"center",padding:"14px 8px"}}>
              <div style={{fontSize:20,...s.mono,color:C.gold}}>{lm.paid}<span style={{fontSize:12,color:C.chromeDim}}>/{lm.total}</span></div>
              <div style={{fontSize:9,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4}}>{t("monthsPaidShort",lang)}</div>
            </div>
            <div style={{...s.card,textAlign:"center",padding:"14px 8px"}}>
              <div style={{fontSize:20,...s.mono,color:C.paper}}>{lm.remaining}</div>
              <div style={{fontSize:9,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4}}>{t("monthsLeft",lang)}</div>
            </div>
            <div style={{...s.card,textAlign:"center",padding:"14px 8px"}}>
              <div style={{fontSize:20,...s.mono,color:C.gold}}>{fmt$(credit)}</div>
              <div style={{fontSize:9,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4}}>R2O Credit</div>
            </div>
          </div>
        );
      })()}

      <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>{t("quickActions",lang)}</div>
      {[
        {icon:ICONS.pay,label:"Payments & Pay via Zelle",sub:"View history · pay now",tab:"payments"},
        {icon:ICONS.credit,label:"My Credit & Buy Option",sub:"Rent-to-own progress",tab:"credit"},
        {icon:ICONS.wrench,label:"Maintenance & Transport",sub:"Request repair or move",tab:"services"},
        {icon:ICONS.contract,label:"My Contract",sub:"View & download lease PDF",tab:"contract"},
      ].map(a=>(
        <button key={a.tab} onClick={()=>setTab(a.tab)}
          style={{display:"flex",alignItems:"center",gap:14,background:C.steel,border:`1px solid ${C.line}`,borderRadius:6,padding:"13px 15px",cursor:"pointer",textAlign:"left",width:"100%",color:C.paper}}>
          <div style={{width:38,height:38,borderRadius:6,background:C.ink2,border:`1px solid ${C.line}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Icon d={a.icon} size={18} color={C.gold}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{a.label}</div>
            <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>{a.sub}</div>
          </div>
          <Icon d="M9 18l6-6-6-6" size={16} color={C.chromeDim}/>
        </button>
      ))}
    </div>
  );
}

function StatMini({label,val}){
  return(
    <div>
      <div style={{fontSize:10,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>
      <div style={{fontSize:13,fontWeight:600,marginTop:2}}>{val}</div>
    </div>
  );
}

/* ── Tenant Payments ─────────────────────────────────────── */

function TenantPayments({myPayments,tenant,pendingPay,db,updateDB,tenantId,lang}){
  
  const [notifSent,setNotifSent]=useState(false);
  const [openingZelle,setOpeningZelle]=useState(false);
  const [cardBusy,setCardBusy]=useState(false);

  const payByCard=async(net)=>{
    if(!STRIPE_CHECKOUT_URL){ alert("Card payments are being set up — please use Zelle for now."); return; }
    setCardBusy(true);
    try{
      const total=cardTotal(net);
      const res=await fetch(STRIPE_CHECKOUT_URL,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({amountCents:Math.round(total*100),net,tenantId,tenantName:tenant?.name,note:pendingPay?.note||"Rent payment",paymentId:pendingPay?.id})});
      const data=await res.json();
      if(data&&data.url){ window.location.href=data.url; }
      else throw new Error("no checkout url");
    }catch(e){ alert("Couldn't start the card payment. Please try Zelle, or try again in a moment."); setCardBusy(false); }
  };

  const notifyAfterPay=()=>{
    updateDB(db=>{
      addNotification(db,{forRole:"admin",title:"Payment Notification",body:`${tenant?.name} sent a Zelle payment — check and confirm.`,forTenantId:tenantId});
      return db;
    });
    setNotifSent(true);
  };

  const openZelleApp=(amount)=>{
    setOpeningZelle(true);
    const zelleUrl=`zelle://send?amount=${amount}&recipient=${OWNER_ZELLE.replace(/\D/g,"")}&memo=${encodeURIComponent(pendingPay?.note||"Rent payment")}`;
    setTimeout(()=>{
      window.location.href=zelleUrl;
      setTimeout(()=>setOpeningZelle(false),1800);
    },650);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="fadein">
      <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("payments",lang)}</div>

      {tenant?.securityDeposit>0&&(
        <div style={{...s.card,display:"flex",alignItems:"center",gap:12,
          border:`1px solid ${tenant.depositPaid ? C.good+"44" : C.warn+"44"}`,
          background:tenant.depositPaid ? C.goodBg : C.warnBg}}>
          <div style={{width:38,height:38,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            background:tenant.depositPaid ? C.goodBg : C.warnBg}}>
            <Icon d={ICONS.credit} size={18} color={tenant.depositPaid ? C.good : C.warn}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600}}>{t("securityDeposit",lang)}</div>
            <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>
              {tenant.depositPaid ? "Received and on file" : "Not yet received"}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:16,...s.mono,color:C.gold}}>{fmt$(tenant.securityDeposit)}</div>
            <Pill color={tenant.depositPaid ? C.good : C.warn}>{tenant.depositPaid ? "Paid" : "Due"}</Pill>
          </div>
        </div>
      )}

      {pendingPay&&(
        <div style={s.goldCard}>
          <div style={{fontSize:10,...s.mono,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>{t("amountDueNow",lang)}</div>
          <div style={{fontSize:32,...s.mono,color:C.gold,fontWeight:500}}>{fmt$(pendingPay.amount)}</div>
          <div style={{fontSize:12,color:C.chromeDim,marginTop:4}}>{pendingPay.note} · Due {fmtDate(pendingPay.date)}</div>
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.line}`}}>
            <div style={{fontSize:11,...s.mono,color:C.chromeDim,marginBottom:8}}>{t("payViaZelle",lang)}</div>
            <div style={{background:C.ink2,border:`1px solid ${C.lineBright}`,borderRadius:5,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:12,...s.mono,color:C.chromeDim}}>Send to</div>
                <div style={{fontSize:15,fontWeight:600,color:C.paper,marginTop:2}}>{OWNER_ZELLE}</div>
                <div style={{fontSize:11,color:C.chromeDim,marginTop:1}}>Texan Food Trailers Solution</div>
              </div>
              <button onClick={()=>openZelleApp(pendingPay.amount)} disabled={openingZelle}
                style={{background:"#6B1FCD",color:"#fff",border:"none",borderRadius:4,padding:"10px 14px",fontSize:12,fontWeight:700,...s.mono,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",cursor:"pointer",position:"relative",overflow:"hidden"}}>
                {openingZelle ? (
                  <><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/> Opening…</>
                ) : t("openZelle",lang)}
              </button>
            </div>
            <div style={{marginTop:10,padding:"10px 14px",background:C.blueBg,border:`1px solid ${C.blue}44`,borderRadius:5}}>
              <div style={{fontSize:12,color:C.paper,marginBottom:8}}>After sending payment, tap below to notify us:</div>
              <button onClick={notifyAfterPay} disabled={notifSent}
                style={{...s.btnGold,padding:"10px",opacity:notifSent?0.6:1}}>
                {notifSent?"✓ Payment Reported":t("notifyAbuArab",lang)}
              </button>
            </div>
            <div style={{textAlign:"center",fontSize:10.5,color:C.good,...s.mono,marginTop:8}}>✓ Zero fees for this payment</div>

            {/* Card payment option */}
            <div style={{marginTop:16,paddingTop:14,borderTop:`1px dashed ${C.line}`}}>
              <div style={{fontSize:11,...s.mono,color:C.chromeDim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Or pay by card</div>
              <button onClick={()=>payByCard(pendingPay.amount)} disabled={cardBusy}
                style={{...s.btnOut,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:cardBusy?0.6:1}}>
                <Icon d={ICONS.credit} size={15} color={C.gold}/> {cardBusy?"Opening secure checkout…":`Pay by Debit / Credit Card — ${fmt$(cardTotal(pendingPay.amount))}`}
              </button>
              <div style={{fontSize:10.5,color:C.chromeDim,lineHeight:1.5,marginTop:8,textAlign:"center"}}>
                You can pay by debit or credit card. A processing fee of {fmt$(cardFee(pendingPay.amount))} (~{Math.round((cardFee(pendingPay.amount)/pendingPay.amount)*100)}%) is added so your full rent of {fmt$(pendingPay.amount)} reaches us. Card total: <strong style={{color:C.paper}}>{fmt$(cardTotal(pendingPay.amount))}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{...s.heading,fontSize:11,color:C.chromeDim,letterSpacing:"0.08em"}}>{t("paymentHistory",lang)}</div>
      {myPayments.length===0&&<div style={{color:C.chromeDim,fontSize:13}}>No payments yet.</div>}
      {myPayments.map(p=>(
        <div key={p.id} style={{...s.card,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:p.status==="paid"?C.goodBg:C.warnBg}}>
            <Icon d={p.status==="paid"?ICONS.check:ICONS.bell} size={16} color={p.status==="paid"?C.good:C.warn}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{p.note}</div>
            <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>{fmtDate(p.date)} · {p.method}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:15,...s.mono,color:C.gold}}>{fmt$(p.amount)}</div>
            <Pill color={p.status==="paid"?C.good:C.warn}>{p.status}</Pill>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tenant Credit / Rent-to-Own ─────────────────────────── */

function TenantCredit({tenant,trailer,myPayments,lang}){
  const paid=myPayments.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const creditRate=tenant?.creditRate||15;
  const credit=Math.round(paid*creditRate/100);
  const purchasePrice=trailer?.purchasePrice||0;
  const remaining=Math.max(0,purchasePrice-credit);
  const pct=purchasePrice?Math.min(100,Math.round(credit/purchasePrice*100)):0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="fadein">
      <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("creditBuyOption",lang)}</div>
      <div style={{fontSize:13,color:C.chromeDim}}>
        A portion of every rent payment you make goes toward a credit that can be applied to purchase your trailer.
      </div>

      {/* credit card */}
      <div style={{...s.goldCard,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:`${C.gold}0a`,pointerEvents:"none"}}/>
        <div style={{fontSize:10,...s.mono,color:C.gold,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>
          {trailer?.name||"Your Trailer"} · Rent-to-Own
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18}}>
          {[
            ["Credit Rate",creditRate+"%"],
            ["Total Paid",fmt$(paid)],
            ["Credit Built",fmt$(credit)],
          ].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:9,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
              <div style={{fontSize:15,fontWeight:600,color:C.gold,marginTop:3}}>{v}</div>
            </div>
          ))}
        </div>

        {/* progress bar */}
        <div style={{fontSize:10,...s.mono,color:C.chromeDim,marginBottom:8}}>
          Progress toward purchase ({fmt$(purchasePrice)})
        </div>
        <div style={{background:C.ink2,borderRadius:4,height:10,overflow:"hidden",border:`1px solid ${C.line}`}}>
          <div style={{width:pct+"%",height:"100%",background:`linear-gradient(90deg,${C.gold},${C.goldBright})`,borderRadius:4,transition:"width 0.4s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,...s.mono}}>
          <span style={{color:C.gold}}>{fmt$(credit)} credited</span>
          <span style={{color:C.chromeDim}}>{pct}%</span>
          <span style={{color:C.chromeDim}}>{fmt$(purchasePrice)}</span>
        </div>
      </div>

      {/* remaining */}
      {purchasePrice>0&&(
        <div style={{...s.card,textAlign:"center",padding:"22px"}}>
          <div style={{fontSize:11,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.08em"}}>Remaining to Buy Outright</div>
          <div style={{fontSize:32,...s.mono,color:remaining===0?C.good:C.paper,marginTop:8,fontWeight:500}}>
            {remaining===0?"Paid Off! 🎉":fmt$(remaining)}
          </div>
          {remaining>0&&<div style={{fontSize:12,color:C.chromeDim,marginTop:6}}>
            At {fmt$(tenant?.monthlyRate)}/mo with {creditRate}% credit rate,<br/>you build ~{fmt$(Math.round((tenant?.monthlyRate||0)*creditRate/100))} credit per month.
          </div>}
        </div>
      )}

      {/* how it works */}
      <div style={{...s.card}}>
        <div style={{fontSize:11,...s.mono,color:C.gold,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>How it works</div>
        {[
          ["Each payment",""+creditRate+"% goes to your purchase credit"],
          ["Credit applies","Directly off the trailer's purchase price"],
          ["Buy anytime","Contact Abu Arab when you're ready to buy"],
          ["No expiry","Your credit stays as long as your lease is active"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",gap:10,paddingTop:10,borderTop:`1px solid ${C.line}`,marginTop:10}}>
            <Icon d={ICONS.check} size={14} color={C.gold} style={{flexShrink:0,marginTop:2}}/>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>{k}</div>
              <div style={{fontSize:12,color:C.chromeDim}}>{v}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{...s.card,background:C.goodBg,border:`1px solid ${C.good}44`}}>
        <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>{t("readyToBuy",lang)}</div>
        <div style={{fontSize:12,color:C.chromeDim,marginBottom:12}}>Contact Abu Arab to start the purchase process. Your {fmt$(credit)} credit will be applied immediately.</div>
        <a href="tel:+17378889096" style={{...s.btnGold,display:"flex",alignItems:"center",justifyContent:"center",gap:6,textDecoration:"none"}}>
          <Icon d={ICONS.contact} size={14}/> {t("callAbuArab",lang)}
        </a>
      </div>
    </div>
  );
}

/* ── Tenant Services (Maintenance + Transport) ───────────── */

function TenantServices({db,updateDB,tenantId,tenant,lang}){
  const [screen,setScreen]=useState("menu"); // menu | maint-form | transport-form | book-list | book-form
  const myMaint=(db.maintenanceRequests||[]).filter(r=>r.tenantId===tenantId);
  const myTrans=(db.transportRequests||[]).filter(r=>r.tenantId===tenantId);
  const fileRef=useRef();
  const [maintForm,setMaintForm]=useState({description:"",priority:"normal",photo:null,photoName:""});
  const [transForm,setTransForm]=useState({from:"",to:"",date:"",notes:""});
  const [bookForm,setBookForm]=useState({trailerId:"",startDate:"",endDate:"",note:""});
  const [bookSel,setBookSel]=useState(null);
  const [sent,setSent]=useState("");

  const submitBook=()=>{
    if(!bookSel||!bookForm.startDate||!bookForm.endDate)return;
    const r={id:"R"+uid(),tenantId,trailerId:bookSel.id,trailerName:bookSel.name,...bookForm,status:"pending",submittedDate:today()};
    updateDB(db=>{
      db.bookingRequests=[...(db.bookingRequests||[]),r];
      addNotification(db,{forRole:"admin",title:"Booking Request",body:`${tenant?.name} wants to book ${bookSel.name} from ${fmtDate(bookForm.startDate)} to ${fmtDate(bookForm.endDate)}`,forTenantId:tenantId});
      return db;
    });
    setSent("book");setScreen("menu");setBookForm({trailerId:"",startDate:"",endDate:"",note:""});setBookSel(null);
  };

  const submitMaint=()=>{
    if(!maintForm.description)return;
    const r={id:"M"+uid(),tenantId,description:maintForm.description,priority:maintForm.priority,photo:maintForm.photo,photoName:maintForm.photoName,date:today(),status:"pending"};
    updateDB(db=>{
      db.maintenanceRequests=[...db.maintenanceRequests,r];
      addNotification(db,{forRole:"admin",title:"Maintenance Request",body:`${tenant?.name}: ${maintForm.description.slice(0,60)}`,forTenantId:tenantId});
      return db;
    });
    setSent("maint");setScreen("menu");setMaintForm({description:"",priority:"normal",photo:null,photoName:""});
  };

  const submitTrans=()=>{
    if(!transForm.from||!transForm.to)return;
    const r={id:"TR"+uid(),tenantId,from:transForm.from,to:transForm.to,date:transForm.date,notes:transForm.notes,status:"pending",quotedPrice:null,tenantAccepted:null,submittedDate:today()};
    updateDB(db=>{
      db.transportRequests=[...db.transportRequests,r];
      addNotification(db,{forRole:"admin",title:"Transport Request",body:`${tenant?.name}: ${transForm.from} → ${transForm.to}`,forTenantId:tenantId});
      return db;
    });
    setSent("trans");setScreen("menu");setTransForm({from:"",to:"",date:"",notes:""});
  };

  const acceptTransport=(id)=>{
    updateDB(db=>{
      const r=db.transportRequests.find(x=>x.id===id);
      if(r){r.tenantAccepted=true;r.status="accepted";}
      addNotification(db,{forRole:"admin",title:"Transport Accepted",body:`${tenant?.name} accepted the transport quote.`,forTenantId:tenantId});
      return db;
    });
  };
  const declineTransport=(id)=>{
    updateDB(db=>{
      const r=db.transportRequests.find(x=>x.id===id);
      if(r){r.tenantAccepted=false;r.status="declined";}
      return db;
    });
  };

  if(screen==="maint-form") return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <button onClick={()=>setScreen("menu")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>🔧 Maintenance Request</div>
      <div>
        <label style={s.label}>Describe the issue</label>
        <textarea style={{...s.input,resize:"vertical",minHeight:100}} placeholder="What needs to be repaired or fixed? Be as specific as possible." value={maintForm.description} onChange={e=>setMaintForm(f=>({...f,description:e.target.value}))}/>
      </div>
      <div>
        <label style={s.label}>Priority</label>
        <select style={s.input} value={maintForm.priority} onChange={e=>setMaintForm(f=>({...f,priority:e.target.value}))}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent — can't operate</option>
          <option value="low">Low — not urgent</option>
        </select>
      </div>
      <div>
        <label style={s.label}>Photo (optional)</label>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
          const file=e.target.files[0];
          if(!file)return;
          const compressed=await compressImage(file);
          setMaintForm(f=>({...f,photo:compressed,photoName:file.name}));
        }}/>
        <button onClick={()=>fileRef.current?.click()} style={{...s.btnOut,display:"flex",alignItems:"center",gap:8}}>
          <Icon d={ICONS.img} size={15} color={C.gold}/> {maintForm.photoName||"Attach a photo"}
        </button>
        {maintForm.photo&&<img src={maintForm.photo} alt="preview" style={{marginTop:8,borderRadius:6,maxHeight:160,width:"100%",objectFit:"cover",border:`1px solid ${C.line}`}}/>}
      </div>
      <button style={s.btnGold} onClick={submitMaint}>Submit Request</button>
    </div>
  );

  if(screen==="transport-form") return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <button onClick={()=>setScreen("menu")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>🚛 Transport Request</div>
      <div style={{fontSize:13,color:C.chromeDim}}>Tell us where you need the trailer moved. Abu Arab will review and send you a price quote.</div>
      <div>
        <label style={s.label}>From (pickup address)</label>
        <input style={s.input} value={transForm.from} onChange={e=>setTransForm(f=>({...f,from:e.target.value}))} placeholder="Current location / address"/>
      </div>
      <div>
        <label style={s.label}>To (delivery address)</label>
        <input style={s.input} value={transForm.to} onChange={e=>setTransForm(f=>({...f,to:e.target.value}))} placeholder="Destination address"/>
      </div>
      <div>
        <label style={s.label}>Target Date</label>
        <input style={s.input} type="date" value={transForm.date} onChange={e=>setTransForm(f=>({...f,date:e.target.value}))}/>
      </div>
      <div>
        <label style={s.label}>Notes (optional)</label>
        <textarea style={{...s.input,resize:"vertical",minHeight:72}} placeholder="Any special requirements, time windows, access notes…" value={transForm.notes} onChange={e=>setTransForm(f=>({...f,notes:e.target.value}))}/>
      </div>
      <div style={{...s.card,fontSize:12,color:C.chromeDim,lineHeight:1.6}}>
        After you submit, Abu Arab will review your request and send a price quote. You'll see it on your home screen and can <strong style={{color:C.paper}}>accept or decline</strong> before anything is scheduled.
      </div>
      <button style={s.btnGold} onClick={submitTrans}>Send Transport Request</button>
    </div>
  );

  // ── Book trailer: browse ───────────────────────────────────
  if(screen==="book-list"){
    const avail=db.trailers.filter(t=>t.status==="available");
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
        <button onClick={()=>setScreen("menu")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
          <Icon d={ICONS.back} size={14}/> Back
        </button>
        <div style={{...s.heading,fontSize:18,fontWeight:700}}>🚛 Available Trailers</div>
        <div style={{fontSize:13,color:C.chromeDim}}>Tap a trailer to request a booking.</div>
        {avail.length===0&&<div style={{color:C.chromeDim,fontSize:13}}>No trailers available right now. Contact Abu Arab.</div>}
        {avail.map(t=>(
          <button key={t.id} onClick={()=>{setBookSel(t);setScreen("book-form");}}
            style={{...s.card,textAlign:"left",width:"100%",cursor:"pointer",color:C.paper,padding:0,overflow:"hidden"}}>
            {t.photo&&(
              <div style={{width:"100%",height:150,overflow:"hidden",position:"relative"}}>
                <img src={t.photo} alt={t.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.75))"}}/>
                <div style={{position:"absolute",bottom:10,left:14,right:14,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                  <div style={{fontWeight:700,fontSize:16,fontFamily:"'Oswald',sans-serif",textTransform:"uppercase",letterSpacing:"0.02em",lineHeight:1.1}}>{t.name}</div>
                  <div style={{fontSize:17,...s.mono,color:C.gold,fontWeight:500,whiteSpace:"nowrap"}}>{fmt$(t.dailyRate)}<span style={{fontSize:10,color:"rgba(243,239,230,0.55)"}}>/day</span></div>
                </div>
              </div>
            )}
            <div style={{padding:"12px 15px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                {!t.photo&&<div style={{fontWeight:600,fontSize:15,marginBottom:4}}>{t.name}</div>}
                <div style={{fontSize:11,color:C.chromeDim}}>{t.length} · {(t.kitchen||"").slice(0,50)}{(t.kitchen||"").length>50?"…":""}</div>
                {!t.photo&&<div style={{fontSize:15,...s.mono,color:C.gold,marginTop:6}}>{fmt$(t.dailyRate)}<span style={{fontSize:11,color:C.chromeDim}}>/day</span></div>}
              </div>
              <Icon d="M9 18l6-6-6-6" size={18} color={C.chromeDim}/>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ── Book trailer: fill dates ────────────────────────────────
  if(screen==="book-form"&&bookSel) return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <button onClick={()=>setScreen("book-list")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>Request Booking</div>
      {/* trailer preview */}
      <div style={{...s.goldCard,padding:0,overflow:"hidden"}}>
        {bookSel.photo&&<img src={bookSel.photo} alt={bookSel.name} style={{width:"100%",height:130,objectFit:"cover"}}/>}
        <div style={{padding:"12px 14px"}}>
          <div style={{fontWeight:600,fontSize:14}}>{bookSel.name}</div>
          <div style={{fontSize:12,color:C.chromeDim,marginTop:2}}>{bookSel.length} · {fmt$(bookSel.dailyRate)}/day</div>
        </div>
      </div>
      <div>
        <label style={s.label}>Start Date</label>
        <input type="date" style={s.input} value={bookForm.startDate} onChange={e=>setBookForm(f=>({...f,startDate:e.target.value}))}/>
      </div>
      <div>
        <label style={s.label}>End Date</label>
        <input type="date" style={s.input} value={bookForm.endDate} onChange={e=>setBookForm(f=>({...f,endDate:e.target.value}))}/>
      </div>
      {bookForm.startDate&&bookForm.endDate&&(()=>{
        const days=Math.max(0,Math.round((new Date(bookForm.endDate)-new Date(bookForm.startDate))/86400000));
        return days>0?(<div style={{...s.card,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.chromeDim}}>{days} days × {fmt$(bookSel.dailyRate)}</span>
          <span style={{fontSize:15,...s.mono,color:C.gold}}>{fmt$(days*bookSel.dailyRate)} est.</span>
        </div>):null;
      })()}
      <div>
        <label style={s.label}>Notes (optional)</label>
        <textarea style={{...s.input,resize:"vertical",minHeight:70}} placeholder="Cuisine type, event, any questions..." value={bookForm.note} onChange={e=>setBookForm(f=>({...f,note:e.target.value}))}/>
      </div>
      <button style={s.btnGold} onClick={submitBook}>Send Booking Request</button>
    </div>
  );

  // ── menu ─────────────────────────────────────────────────────
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fadein">
      <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("services",lang)}</div>

      {sent==="maint"&&<div style={{background:C.goodBg,border:`1px solid ${C.good}44`,borderRadius:6,padding:"12px 14px",fontSize:13,color:C.good}}>✓ Maintenance request sent! Abu Arab will follow up soon.</div>}
      {sent==="trans"&&<div style={{background:C.goodBg,border:`1px solid ${C.good}44`,borderRadius:6,padding:"12px 14px",fontSize:13,color:C.good}}>✓ Transport request sent! You'll receive a price quote shortly.</div>}
      {sent==="book"&&<div style={{background:C.goodBg,border:`1px solid ${C.good}44`,borderRadius:6,padding:"12px 14px",fontSize:13,color:C.good}}>✓ Booking request sent! Abu Arab will confirm availability soon.</div>}

      {/* service cards */}
      {[
        {icon:ICONS.book,color:C.gold,title:t("bookATrailer",lang),desc:"Browse available trailers, pick your dates and send a booking request.",action:()=>setScreen("book-list"),badge:(db.bookingRequests||[]).filter(r=>r.tenantId===tenantId&&r.status==="approved").length},
        {icon:ICONS.wrench,color:C.warn,title:t("requestMaintenance",lang),desc:"Report an issue with your trailer. Add a photo if helpful.",action:()=>setScreen("maint-form"),badge:myMaint.filter(r=>r.status==="in-progress").length},
        {icon:ICONS.truck,color:C.blue,title:t("requestTransport",lang),desc:"Need your trailer moved? Submit pickup/drop-off details and get a price quote.",action:()=>setScreen("transport-form"),badge:myTrans.filter(r=>r.status==="quoted").length},
      ].map(a=>(
        <button key={a.title} onClick={a.action}
          style={{display:"flex",alignItems:"center",gap:14,background:C.steel,border:`1px solid ${C.line}`,borderRadius:6,padding:"16px 15px",cursor:"pointer",textAlign:"left",width:"100%",color:C.paper,position:"relative"}}>
          {a.badge>0&&<span style={{position:"absolute",top:10,right:10,background:C.gold,color:C.ink,borderRadius:99,width:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{a.badge}</span>}
          <div style={{width:44,height:44,borderRadius:8,background:a.color+"18",border:`1px solid ${a.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Icon d={a.icon} size={20} color={a.color}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600}}>{a.title}</div>
            <div style={{fontSize:12,color:C.chromeDim,marginTop:3}}>{a.desc}</div>
          </div>
          <Icon d="M9 18l6-6-6-6" size={16} color={C.chromeDim}/>
        </button>
      ))}

      {/* active transport quotes needing response */}
      {myTrans.filter(r=>r.status==="quoted").map(r=>(
        <div key={r.id} style={{...s.goldCard}}>
          <div style={{fontSize:11,...s.mono,color:C.gold,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Transport Quote Ready</div>
          <div style={{fontSize:13}}>{r.from} <span style={{color:C.chromeDim}}>→</span> {r.to}</div>
          <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>Requested for {fmtDate(r.date)}</div>
          <div style={{fontSize:28,...s.mono,color:C.gold,margin:"10px 0 4px",fontWeight:500}}>{fmt$(r.quotedPrice)}</div>
          <div style={{fontSize:11,color:C.chromeDim,marginBottom:14}}>{r.adminNote||"Abu Arab's transport quote"}</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>acceptTransport(r.id)} style={{...s.btnGold,flex:1,padding:"10px"}}>✓ Accept & Schedule</button>
            <button onClick={()=>declineTransport(r.id)} style={{...s.btnOut,flex:1,padding:"10px"}}>Decline</button>
          </div>
        </div>
      ))}

      {/* history */}
      {[...myMaint,...myTrans].length>0&&(
        <>
          <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>Request History</div>
          {myMaint.map(r=>(
            <div key={r.id} style={{...s.card,display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:34,height:34,borderRadius:99,background:C.warnBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon d={ICONS.wrench} size={16} color={C.warn}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{r.description.slice(0,60)}{r.description.length>60?"…":""}</div>
                <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>{fmtDate(r.date)} · {r.priority}</div>
                {r.photo&&<img src={r.photo} alt="" style={{marginTop:8,borderRadius:4,maxHeight:80,maxWidth:120,objectFit:"cover",border:`1px solid ${C.line}`}}/>}
              </div>
              <Pill color={r.status==="done"?C.good:r.status==="in-progress"?C.blue:C.warn}>{r.status}</Pill>
            </div>
          ))}
          {myTrans.filter(r=>r.status!=="quoted").map(r=>(
            <div key={r.id} style={{...s.card,display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:34,height:34,borderRadius:99,background:C.blueBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon d={ICONS.truck} size={16} color={C.blue}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{r.from} → {r.to}</div>
                <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>{fmtDate(r.submittedDate)}{r.quotedPrice?` · ${fmt$(r.quotedPrice)}`:""}</div>
              </div>
              <Pill color={r.status==="accepted"?C.good:r.status==="declined"?C.danger:C.warn}>{r.status}</Pill>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Tenant Contract ─────────────────────────────────────── */

function TenantContract({db,updateDB,tenantId,lang}){
  const myContracts=db.contracts.filter(c=>c.tenantId===tenantId);
  const tenant=(db.tenants||[]).find(x=>x.id===tenantId)||{};
  const trailer=(db.trailers||[]).find(x=>x.id===tenant.trailerId)||{};
  const [busy,setBusy]=useState("");
  const [err,setErr]=useState("");
  const [showLease,setShowLease]=useState(false);

  const doPrint=()=>{
    document.body.classList.add("printing-petition");
    const cleanup=()=>{document.body.classList.remove("printing-petition");window.removeEventListener("afterprint",cleanup);};
    window.addEventListener("afterprint",cleanup); window.print(); setTimeout(cleanup,1200);
  };
  const saveSignature=(audit)=>{
    updateDB(d=>{
      const tt=d.tenants.find(x=>x.id===tenantId);
      if(tt){ tt.signature=audit; tt.status="active"; }
      addNotification(d,{forRole:"admin",title:"Lease Signed",body:`${tenant.name} signed the lease electronically on ${audit.signedAt.slice(0,10)}. Audit recorded.`});
      addNotification(d,{forRole:"tenant",forTenantId:tenantId,title:"Lease Signed — Thank You",body:"Your lease has been signed and recorded. A copy is always available here in the Contract tab."});
      return d;
    });
    setShowLease(false);
  };

  if(showLease) return(
    <LeaseContract tenant={tenant} trailer={trailer} termType={tenant.termType||"monthly"}
      signed={tenant.signature} onSign={saveSignature} onClose={()=>setShowLease(false)} onPrint={doPrint}/>
  );

  const getFile=async(c)=>{
    setErr("");
    const data=await loadFileChunked(`contract_file:${c.tenantId}`);
    if(!data){ setErr("Couldn't load the file right now. Please contact Abu Arab or try again."); return null; }
    return data;
  };
  const viewPDF=async(c)=>{
    setBusy(c.id+"-view");
    const data=await getFile(c);
    setBusy("");
    if(data){ const w=window.open(); w.document.write(`<html><body style="margin:0;background:#111"><embed src="${data}" type="application/pdf" width="100%" height="100%"/></body></html>`); }
  };
  const downloadPDF=async(c)=>{
    setBusy(c.id+"-dl");
    const data=await getFile(c);
    setBusy("");
    if(data){ const a=document.createElement("a"); a.href=data; a.download=c.fileName; a.click(); }
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="fadein">
      <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("myContract",lang)}</div>
      <div style={{fontSize:13,color:C.chromeDim}}>Your rental lease agreement. Review, sign, view or download at any time.</div>
      {err&&<div style={{fontSize:12,color:C.danger,padding:"10px 12px",background:C.dangerBg,border:`1px solid ${C.danger}44`,borderRadius:5}}>⚠ {err}</div>}

      {/* Auto-generated lease — review & sign / view signed */}
      {tenant.contractReady&&(
        <div style={{...s.goldCard,border:`1px solid ${tenant.signature?C.good+"55":C.gold+"66"}`}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:44,height:44,borderRadius:6,background:C.ink2,border:`1px solid ${C.lineBright}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon d={ICONS.contract} size={22} color={tenant.signature?C.good:C.gold}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>Lease Agreement ({(tenant.termType||"monthly").charAt(0).toUpperCase()+(tenant.termType||"monthly").slice(1)})</div>
              <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>
                {tenant.signature?`Signed electronically on ${tenant.signature.signedAt.slice(0,10)}`:"Ready for your review and electronic signature"}
              </div>
            </div>
            {tenant.signature&&<Pill color={C.good}>Signed</Pill>}
          </div>
          <button onClick={()=>setShowLease(true)} style={{...s.btnGold,marginTop:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Icon d={tenant.signature?ICONS.eye:ICONS.check} size={14} color={C.ink}/> {tenant.signature?"View Signed Lease":"Review & Sign Lease"}
          </button>
        </div>
      )}
      {myContracts.length===0?(
        <div style={{...s.card,textAlign:"center",padding:"36px 20px"}}>
          <Icon d={ICONS.contract} size={36} color={C.chromeDim}/>
          <div style={{marginTop:14,fontSize:13,color:C.chromeDim}}>{t("noContract",lang)}</div>
        </div>
      ):myContracts.map(c=>(
        <div key={c.id} style={s.goldCard}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:44,height:44,borderRadius:6,background:C.ink2,border:`1px solid ${C.lineBright}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon d={ICONS.contract} size={22} color={C.gold}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14}}>{c.url ? "Your Lease Agreement" : c.fileName}</div>
              <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>Uploaded {fmtDate(c.uploadDate)}</div>
            </div>
          </div>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noopener noreferrer"
              style={{...s.btnGold,marginTop:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6,textDecoration:"none"}}>
              <Icon d={ICONS.eye} size={14}/> {t("openContract",lang)}
            </a>
          ) : (
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={()=>viewPDF(c)} disabled={busy!==""} style={{...s.btnOut,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:busy!==""?0.6:1}}><Icon d={ICONS.eye} size={14}/>{busy===c.id+"-view"?"Loading…":t("viewBtn",lang)}</button>
              <button onClick={()=>downloadPDF(c)} disabled={busy!==""} style={{...s.btnGold,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:busy!==""?0.6:1}}><Icon d={ICONS.download} size={14}/>{busy===c.id+"-dl"?"Loading…":t("downloadPdf",lang)}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ADMIN APP                                                   */
/* ═══════════════════════════════════════════════════════════ */

function AdminApp({db,updateDB,onLogout,refreshNow}){
  const [tab,setTab]=useState("dashboard");
  const [justRefreshed,setJustRefreshed]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  const [lang,setLang]=useState("en"); // "en" | "ar" — admin-side language toggle
  const doRefresh=async()=>{ await refreshNow(); setJustRefreshed(true); setTimeout(()=>setJustRefreshed(false),2000); };
  const allNotifs=db.notifications.filter(n=>n.forRole==="admin").slice().reverse();
  const unreadNotifs=db.notifications.filter(n=>n.forRole==="admin"&&!n.read);

  // Ask for browser notification permission once, and ping (sound + system popup)
  // whenever the unread count goes UP — this is how the admin gets alerted about
  // a new tenant request without having to keep the tab open and staring at it.
  const prevUnreadCount=useRef(unreadNotifs.length);
  useEffect(()=>{
    if("Notification" in window && Notification.permission==="default"){
      Notification.requestPermission();
    }
    // Payment reminders / escalation — runs once when the admin opens the app.
    // (No server cron in this setup; see notes. Deduped so it never double-sends.)
    runReminders(db,updateDB);
  },[]);
  useEffect(()=>{
    if(unreadNotifs.length>prevUnreadCount.current){
      const newest=unreadNotifs[unreadNotifs.length-1];
      // audible ping
      try{
        const ctx=new (window.AudioContext||window.webkitAudioContext)();
        const osc=ctx.createOscillator(); const gain=ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value=880; gain.gain.value=0.15;
        osc.start(); osc.stop(ctx.currentTime+0.18);
      }catch{}
      // system notification popup (works while tab/app is open)
      if("Notification" in window && Notification.permission==="granted" && newest){
        try{ new Notification(newest.title||"New request", {body:newest.body||"", icon:LOGO_URI}); }catch{}
      }
    }
    prevUnreadCount.current=unreadNotifs.length;
  },[unreadNotifs.length]);

  const markRead=(id)=>updateDB(db=>{db.notifications=db.notifications.map(n=>n.id===id?{...n,read:true}:n);return db;});
  const markAllRead=()=>updateDB(db=>{db.notifications=db.notifications.map(n=>n.forRole==="admin"?{...n,read:true}:n);return db;});
  const deleteNotif=(id)=>updateDB(db=>{db.notifications=db.notifications.filter(n=>n.id!==id);return db;});
  const tabs=[
    {id:"dashboard",icon:ICONS.home,label:t("overview",lang)},
    {id:"tenants",icon:ICONS.user,label:t("tenants",lang)},
    {id:"payments",icon:ICONS.pay,label:t("payments",lang)},
    {id:"money",icon:ICONS.credit,label:lang==="ar"?"محاسبة":"Books"},
    {id:"fleet",icon:ICONS.trailer,label:t("fleet",lang)},
    {id:"forms",icon:ICONS.contract,label:lang==="ar"?"نماذج":"Forms"},
  ];
  return(
    <div style={{...s.app,direction:lang==="ar"?"rtl":"ltr"}}>
      <div style={{background:C.steel2,borderBottom:`1px solid ${C.lineBright}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src={LOGO_URI} alt="logo" style={{height:38,width:"auto",filter:"drop-shadow(0 2px 6px rgba(200,155,60,0.3))"}}/>
          <div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>{t("adminPanel",lang)}</div>
            <div style={{fontSize:10,color:C.gold,...s.mono}}>Texan Food Trailers Solution</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setLang(l=>l==="en"?"ar":"en")} title="Language"
            style={{background:"none",border:`1px solid ${C.line}`,color:C.chromeDim,padding:"4px 9px",cursor:"pointer",borderRadius:4,fontSize:10,...s.mono,letterSpacing:"0.04em"}}>
            {lang==="en" ? "عربي" : "EN"}
          </button>
          <button onClick={doRefresh} title="Refresh" style={{background:"none",border:"none",color:justRefreshed?C.good:C.chromeDim,padding:6,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            {justRefreshed ? (
              <><Icon d={ICONS.check} size={16} color={C.good}/><span style={{fontSize:10,...s.mono}}>{t("refreshed",lang)}</span></>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            )}
          </button>
          {allNotifs.length>0&&(
            <button onClick={()=>setShowNotifs(true)} style={{background:"none",border:"none",padding:4,position:"relative",cursor:"pointer"}}>
              <Icon d={ICONS.bell} size={20} color={unreadNotifs.length>0?C.gold:C.chromeDim}/>
              {unreadNotifs.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:C.gold,color:C.ink,borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadNotifs.length}</span>}
            </button>
          )}
          <button onClick={onLogout} style={{background:"none",border:"none",color:C.chromeDim,padding:6}}>
            <Icon d={ICONS.logout} size={18}/>
          </button>
        </div>
      </div>

      {unreadNotifs.length>0&&(
        <div onClick={()=>setShowNotifs(true)} style={{background:C.blueBg,borderBottom:`1px solid ${C.blue}44`,padding:"10px 16px",cursor:"pointer"}}>
          {unreadNotifs.slice(0,2).map(n=>(
            <div key={n.id} style={{fontSize:12,color:C.paper,paddingBottom:4}}>
              🔔 <strong>{n.title}</strong> — {n.body}
            </div>
          ))}
          {unreadNotifs.length>2&&<div style={{fontSize:11,color:C.chromeDim}}>+{unreadNotifs.length-2} more — tap to view all</div>}
        </div>
      )}

      {showNotifs&&<NotificationsPanel notifs={allNotifs} onClose={()=>setShowNotifs(false)} onMarkRead={markRead} onMarkAllRead={markAllRead} onDelete={deleteNotif}/>}

      <div style={{flex:1,overflowY:"auto",padding:"16px 14px 80px"}}>
        {tab==="dashboard"&&<AdminDashboard db={db} updateDB={updateDB} setTab={setTab} lang={lang}/>}
        {tab==="tenants"  &&<AdminTenants   db={db} updateDB={updateDB} lang={lang}/>}
        {tab==="payments" &&<AdminPayments  db={db} updateDB={updateDB} lang={lang}/>}
        {tab==="money"    &&<AdminAccounting db={db} updateDB={updateDB} lang={lang}/>}
        {tab==="fleet"    &&<AdminFleet     db={db} updateDB={updateDB} lang={lang}/>}
        {tab==="forms"    &&<AdminForms     lang={lang}/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.steel2,borderTop:`1px solid ${C.lineBright}`,display:"flex",zIndex:50}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"none",border:"none",color:tab===t.id?C.gold:C.chromeDim,padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative"}}>
            <Icon d={t.icon} size={20} color={tab===t.id?C.gold:C.chromeDim}/>
            <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em",textTransform:"uppercase"}}>{t.label}</span>
            {tab===t.id&&<span style={{position:"absolute",top:0,left:"15%",right:"15%",height:2,background:C.gold,borderRadius:2}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Admin Dashboard ─────────────────────────────────────── */

function AdminDashboard({db,updateDB,setTab,lang}){
  const totalPaid=db.payments.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const pending=db.payments.filter(p=>p.status==="pending");
  const maintPending=(db.maintenanceRequests||[]).filter(r=>r.status==="pending"||r.status==="in-progress");
  const transPending=(db.transportRequests||[]).filter(r=>r.status==="pending");
  const bookPending=(db.bookingRequests||[]).filter(r=>r.status==="pending");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fadein">
      <div style={{...s.heading,fontSize:22,fontWeight:700}}>{t("overview",lang)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <StatCard val={db.tenants.length} label={t("tenants",lang)}/>
        <StatCard val={fmt$(totalPaid)} label={t("totalCollected",lang)}/>
        <StatCard val={pending.length} label={t("pendingPayments",lang)} warn={pending.length>0}/>
        <StatCard val={db.trailers.filter(t=>t.status==="available").length} label={t("availableTrailers",lang)}/>
      </div>

      {/* lease progress per tenant */}
      {db.tenants.length>0&&(
        <>
          <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>{t("leaseProgress",lang)}</div>
          {db.tenants.map(t=>{
            const lm=leaseMonths(t, db.payments);
            if(lm.total===0) return null;
            const pct=Math.min(100,Math.round(lm.paid/lm.total*100));
            const paidTotal=db.payments.filter(p=>p.tenantId===t.id&&p.status==="paid").reduce((s,p)=>s+p.amount,0);
            const creditBuilt=Math.round(paidTotal*(t.creditRate||0)/100);
            return(
              <div key={t.id} style={{...s.card}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                  <div style={{fontSize:13,fontWeight:600}}>{t.name}</div>
                  <div style={{fontSize:12,...s.mono,color:C.gold}}>{lm.paid} / {lm.total} months</div>
                </div>
                <div style={{background:C.ink2,borderRadius:4,height:8,overflow:"hidden",border:`1px solid ${C.line}`}}>
                  <div style={{width:pct+"%",height:"100%",background:`linear-gradient(90deg,${C.gold},${C.goldBright})`,borderRadius:4,transition:"width 0.4s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,...s.mono,color:C.chromeDim}}>
                  <span>{fmt$((t.monthlyRate||0)*lm.paid)} collected</span>
                  <span>{lm.remaining} months left · {fmt$((t.monthlyRate||0)*lm.remaining)} to go</span>
                </div>
                {t.creditRate>0&&(
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingTop:6,borderTop:`1px solid ${C.line}`,fontSize:11,...s.mono}}>
                    <span style={{color:C.chromeDim}}>Rent-to-own credit built</span>
                    <span style={{color:C.gold}}>{fmt$(creditBuilt)}{t.purchaseOptionPrice>0?` of ${fmt$(t.purchaseOptionPrice)}`:""}</span>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* action items */}
      {[
        {count:maintPending.length,label:"Maintenance requests awaiting action",color:C.warn,tab:"tenants"},
        {count:transPending.length,label:"Transport requests — quote needed",color:C.blue,tab:"tenants"},
        {count:bookPending.length,label:"Booking requests pending",color:C.warn,tab:"tenants"},
      ].filter(x=>x.count>0).map(x=>(
        <button key={x.label} onClick={()=>setTab(x.tab)}
          style={{background:x.color+"18",border:`1px solid ${x.color}44`,borderRadius:6,padding:"12px 14px",textAlign:"left",width:"100%",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",color:C.paper}}>
          <span style={{fontSize:13}}><strong style={{color:x.color}}>{x.count}</strong> {x.label}</span>
          <Icon d="M9 18l6-6-6-6" size={15} color={x.color}/>
        </button>
      ))}

      <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>{t("recentPayments",lang)}</div>
      {db.payments.slice(-4).reverse().map(p=>{
        const t=db.tenants.find(x=>x.id===p.tenantId);
        return(
          <div key={p.id} style={{...s.card,display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500}}>{t?.name||"Unknown"}</div>
              <div style={{fontSize:11,color:C.chromeDim}}>{p.note} · {fmtDate(p.date)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,...s.mono,color:C.gold}}>{fmt$(p.amount)}</div>
              <Pill color={p.status==="paid"?C.good:C.warn}>{p.status}</Pill>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({val,label,warn}){
  return(
    <div style={{...s.card,textAlign:"center",border:warn?`1px solid ${C.warn}44`:`1px solid ${C.line}`}}>
      <div style={{fontSize:22,...s.mono,color:warn?C.warn:C.gold,fontWeight:500}}>{val}</div>
      <div style={{fontSize:10,...s.mono,color:C.chromeDim,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:4}}>{label}</div>
    </div>
  );
}

/* ── Admin Tenants ───────────────────────────────────────── */

function IdPhotoViewer({appId}){
  const [img,setImg]=useState(null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const show=async()=>{
    setLoading(true);
    try{ const u=await loadFileChunked(`app_id_photo:${appId}`); setImg(u||null); }catch(_){ }
    setDone(true); setLoading(false);
  };
  if(img) return <img src={img} alt="ID" style={{width:"100%",maxHeight:260,objectFit:"contain",borderRadius:6,border:`1px solid ${C.line}`,marginTop:8}}/>;
  return (
    <button onClick={show} disabled={loading} style={{...s.btnOut,marginTop:8,padding:"7px 10px",fontSize:11,display:"flex",alignItems:"center",gap:6,width:"auto"}}>
      <Icon d={ICONS.img} size={13} color={C.gold}/> {loading?"Loading…":done&&!img?"No ID photo found":"View ID photo"}
    </button>
  );
}
function AdminTenants({db,updateDB,lang}){
  const [view,setView]=useState("list");
  const [sel,setSel]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",email:"",pin:"1234",trailerId:"",startDate:"",endDate:"",monthlyRate:"",creditRate:"15",securityDeposit:"",lateFee:""});
  const pendingApps=(db.applications||[]).filter(a=>a.status==="pending");

  const approveApplication=(a)=>{
    const id="U"+uid();
    // Auto-login: username = tenant's last name, password = last 4 of SSN (falls back to a random 4-digit PIN).
    const lastName=((a.name||"").trim().split(/\s+/).slice(-1)[0]||"").replace(/[^A-Za-z]/g,"");
    const username=lastName.toLowerCase();
    const ssn4=String(a.ssn4||"").replace(/\D/g,"").slice(-4);
    const pin=ssn4.length===4?ssn4:String(Math.floor(1000+Math.random()*9000));
    const tr=db.trailers.find(x=>x.id===a.trailerId);
    const term=a.termType||"monthly";
    // Term length auto-links to what the tenant chose
    const termMonths=term==="annual"?12:term==="rent-to-own"||term==="rto"?(Number(tr?.rtoMonths)||12):term==="weekly"?0:1;
    const start=today();
    const end=term==="weekly"?"":addMonths(start,termMonths);
    const mRate=tr?Number(tr.monthlyRate)||0:0;
    const tenant={id,name:a.name,phone:a.phone,email:a.email,pin,username,address:a.address||"",dl:a.dl||"",dob:a.dob||"",
      trailerId:a.trailerId||"",termType:term,termMonths,monthlyRate:mRate,
      creditRate:15,securityDeposit:tr?Number(tr.securityDeposit||tr.monthlyRate)||0:0,lateFee:0,startDate:start,endDate:end,
      // these auto-fill the lease from the trailer; admin can fine-tune in the tenant editor
      replacementValue:tr?Number(tr.replacementValue||tr.purchasePrice)||0:0,
      purchaseOptionPrice:tr?Number(tr.purchasePrice)||0:0,
      baseRent:(term==="rent-to-own"||term==="rto")?mRate:0,purchaseCreditPerMonth:0,optionFee:0,
      equipment:tr?.equipment||"",operatingLocation:"",holdoverFee:0,repairThreshold:500,lateFee5:"15%",lateFee10:"20%",dueDay:"1st",businessName:a.businessName||"",
      lessor:"SBK LLC (Abu Arab Trailer Solution)",lessorAddr:LESSOR_ADDR,county:"Williamson",precinct:"",
      status:"pending-signature",contractReady:true,fromApplication:a.id};
    updateDB(d=>{
      d.tenants=[...d.tenants,tenant];
      d.applications=(d.applications||[]).map(x=>x.id===a.id?{...x,status:"approved",tenantId:id}:x);
      if(a.trailerId){const t2=d.trailers.find(x=>x.id===a.trailerId);if(t2)t2.status="pending";}
      addNotification(d,{forRole:"tenant",forTenantId:id,title:"Welcome — Your Application is Approved!",
        body:`Welcome to Texan Food Trailers Solution, ${a.name}! Your application has been approved. Your lease agreement is ready in your portal under the Contract tab — please review and sign it electronically. Sign in with your username "${username}" (or your phone/email) and your password: ${pin}. We're glad to have you with us.`});
      addNotification(d,{forRole:"admin",title:"Application Approved",body:`${a.name} approved — username "${username}", password ${pin==ssn4?"(last 4 of SSN)":pin}. Lease is ready for signing.`});
      return d;
    });
    // Professional welcome email to the new tenant
    const loginUrl=(typeof window!=="undefined"&&window.location&&window.location.origin)||"your portal";
    sendEmail(a.email, a.name,
      "Welcome to Texan Food Trailers Solution — Your Account is Ready",
      `Dear ${a.name},\n\nWelcome to Texan Food Trailers Solution! We're glad to have you as a customer. Your rental application has been approved and your tenant account is ready.\n\nYour login details:\n• Username: ${username} (you can also sign in with your phone or email)\n• Password: ${pin}${pin===ssn4?" (the last four digits of your SSN)":""}\n\nSign in here: ${loginUrl}\n\nWhat's next:\n1. Log in to your portal.\n2. Open the Contract tab — your lease agreement is already filled in with your details.\n3. Review it carefully and sign electronically.\n\nOnce signed, you'll be able to see your lease (as a PDF), make payments, and send us maintenance or transport requests any time from your portal.\n\nIf you have any questions, just reply to this email or call us at ${OWNER_PHONE}.\n\nWelcome aboard,\nTexan Food Trailers Solution\n${OWNER_EMAIL} · ${OWNER_PHONE}`);
  };
  const declineApplication=(a)=>{
    updateDB(d=>{
      d.applications=(d.applications||[]).map(x=>x.id===a.id?{...x,status:"declined"}:x);
      addNotification(d,{forRole:"admin",title:"Application Declined",body:`${a.name}'s application was declined.`});
      return d;
    });
  };
  const fileRef=useRef();
  const [uploading,setUploading]=useState(false);
  const [linkInput,setLinkInput]=useState("");

  const [linkSaved,setLinkSaved]=useState(false);
  const saveContractLink=(tenantId)=>{
    if(!linkInput.trim())return;
    const c={id:"C"+uid(),tenantId,fileName:"Contract (external link)",uploadDate:today(),url:linkInput.trim()};
    updateDB(db=>{
      db.contracts=[...db.contracts.filter(x=>x.tenantId!==tenantId),c];
      addNotification(db,{forRole:"tenant",forTenantId:tenantId,title:"Contract Uploaded",body:"Abu Arab added your rental contract. Check the Contract tab."});
      return db;
    });
    setLinkInput("");
    setLinkSaved(true);
    setTimeout(()=>setLinkSaved(false),3500);
  };

  const addTenant=()=>{
    if(!form.name||!form.phone)return;
    const t={id:"U"+uid(),...form,monthlyRate:Number(form.monthlyRate),creditRate:Number(form.creditRate),
      securityDeposit:Number(form.securityDeposit||0),lateFee:Number(form.lateFee||0),depositPaid:false};
    updateDB(db=>{
      db.tenants=[...db.tenants,t];
      if(form.trailerId){const tr=db.trailers.find(x=>x.id===form.trailerId);if(tr)tr.status="rented";}
      return db;
    });
    setView("list");setForm({name:"",phone:"",email:"",pin:"1234",trailerId:"",startDate:"",endDate:"",monthlyRate:"",creditRate:"15",securityDeposit:"",lateFee:""});
  };

  const editTenant=()=>{
    if(!form.name||!form.phone||!editingId)return;
    updateDB(db=>{
      const idx=db.tenants.findIndex(x=>x.id===editingId);
      if(idx===-1) return db;
      const prevTrailerId=db.tenants[idx].trailerId;
      const updated={
        ...db.tenants[idx],
        ...form,
        monthlyRate:Number(form.monthlyRate),
        creditRate:Number(form.creditRate),
        securityDeposit:Number(form.securityDeposit||0),
        lateFee:Number(form.lateFee||0),
      };
      db.tenants[idx]=updated;
      // keep trailer statuses correct if the assigned trailer changed
      if(prevTrailerId && prevTrailerId!==form.trailerId){
        const oldTr=db.trailers.find(x=>x.id===prevTrailerId);
        if(oldTr) oldTr.status="available";
      }
      if(form.trailerId){
        const newTr=db.trailers.find(x=>x.id===form.trailerId);
        if(newTr) newTr.status="rented";
      }
      return db;
    });
    setView("list");setEditingId(null);
    setForm({name:"",phone:"",email:"",pin:"1234",trailerId:"",startDate:"",endDate:"",monthlyRate:"",creditRate:"15",securityDeposit:"",lateFee:""});
  };

  const deleteTenant=(id)=>{
    updateDB(db=>{
      const t=db.tenants.find(x=>x.id===id);
      if(t?.trailerId){const tr=db.trailers.find(x=>x.id===t.trailerId);if(tr)tr.status="available";}
      db.tenants=db.tenants.filter(t=>t.id!==id);
      db.payments=db.payments.filter(p=>p.tenantId!==id);
      db.contracts=db.contracts.filter(c=>c.tenantId!==id);
      return db;
    });
    setView("list");
  };

  const [uploadError,setUploadError]=useState("");
  const uploadContract=(tenantId,file)=>{
    if(!file)return;
    setUploadError("");
    // Chunked storage means we're no longer limited by a single key's size cap —
    // just keep a sane overall ceiling so uploads/downloads stay reasonably fast.
    const MAX_RAW_MB=15;
    if(file.size > MAX_RAW_MB*1024*1024){
      setUploadError(`This PDF is ${(file.size/1024/1024).toFixed(1)}MB, which is too large even for chunked storage. Please compress it to under ${MAX_RAW_MB}MB (try "Save as PDF" from a phone scanner app, or compress at smallpdf.com), then try again.`);
      setUploading(false);
      return;
    }
    const reader=new FileReader();
    reader.onload=async e=>{
      const fileData=e.target.result;
      const res=await saveFileChunked(`contract_file:${tenantId}`, fileData);
      if(!res.ok){
        setUploadError(`Upload failed: ${res.error||"unknown storage error"}. Please try again — if it keeps failing, try a smaller/more compressed PDF.`);
        setUploading(false);
        return;
      }
      const c={id:"C"+uid(),tenantId,fileName:file.name,uploadDate:today()};
      updateDB(db=>{
        db.contracts=[...db.contracts.filter(x=>x.tenantId!==tenantId),c];
        addNotification(db,{forRole:"tenant",forTenantId:tenantId,title:"Contract Uploaded",body:"Abu Arab uploaded your rental contract. Check the Contract tab."});
        return db;
      });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // maintenance & transport for selected tenant
  const selMaint=sel?(db.maintenanceRequests||[]).filter(r=>r.tenantId===sel.id):[];
  const selTrans=sel?(db.transportRequests||[]).filter(r=>r.tenantId===sel.id):[];

  const updateMaintStatus=(id,status)=>updateDB(db=>{
    const r=db.maintenanceRequests.find(x=>x.id===id);
    if(r){
      r.status=status;
      const t=db.tenants.find(x=>x.id===r.tenantId);
      const messages={
        approved:"Abu Arab approved your maintenance request. Work will begin shortly.",
        declined:"Abu Arab reviewed your maintenance request and it was not approved. Contact Abu Arab for details.",
        "in-progress":"Your maintenance request is now in progress.",
        done:"Your maintenance request has been completed.",
      };
      if(t && messages[status]){
        addNotification(db,{forRole:"tenant",forTenantId:t.id,title:"Maintenance Update",body:messages[status]});
      }
    }
    return db;
  });
  const sendTransportQuote=(id,price,note)=>updateDB(db=>{
    const r=db.transportRequests.find(x=>x.id===id);
    if(r){r.status="quoted";r.quotedPrice=Number(price);r.adminNote=note;}
    const t=db.tenants.find(x=>x.id===r?.tenantId);
    addNotification(db,{forRole:"tenant",forTenantId:r?.tenantId,title:"Transport Quote Ready",body:`Abu Arab quoted ${fmt$(price)} for your transport request. Check Services tab.`});
    return db;
  });

  const toggleDeposit=(id)=>updateDB(db=>{
    const t=db.tenants.find(x=>x.id===id);
    if(t){
      t.depositPaid=!t.depositPaid;
      if(t.depositPaid){
        addNotification(db,{forRole:"tenant",forTenantId:id,title:"Security Deposit Confirmed",body:`Your security deposit of ${fmt$(t.securityDeposit||0)} has been received and confirmed.`});
      }
    }
    return db;
  });

  if(view==="detail"&&sel){
    const myP=db.payments.filter(p=>p.tenantId===sel.id);
    const trailer=db.trailers.find(t=>t.id===sel.trailerId);
    const contract=db.contracts.find(c=>c.tenantId===sel.id);
    const credit=Math.round(myP.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0)*(sel.creditRate||15)/100);
    const lm=leaseMonths(sel, db.payments);
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
        <button onClick={()=>setView("list")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
          <Icon d={ICONS.back} size={14}/> Back
        </button>
        <div style={{...s.heading,fontSize:18,fontWeight:700}}>{sel.name}</div>
        <div style={{...s.card,display:"flex",flexDirection:"column",gap:6}}>
          {[["Phone",sel.phone],["Email",sel.email||"—"],["PIN",sel.pin],["Trailer",trailer?.name||"—"],["Monthly Rate",fmt$(sel.monthlyRate)],["Credit Rate",sel.creditRate+"%"],["Credit Built",fmt$(credit)],["Start",fmtDate(sel.startDate)],["End",fmtDate(sel.endDate)],["Months Paid",`${lm.paid} of ${lm.total}`],["Months Remaining",`${lm.remaining}`]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,paddingTop:6,borderTop:`1px solid ${C.line}`}}>
              <span style={{color:C.chromeDim}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>

        {/* security deposit */}
        {sel.securityDeposit>0&&(
          <div style={{...s.card,display:"flex",justifyContent:"space-between",alignItems:"center",
            border:`1px solid ${sel.depositPaid ? C.good+"44" : C.warn+"44"}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>Security Deposit</div>
              <div style={{fontSize:16,...s.mono,color:C.gold,marginTop:3}}>{fmt$(sel.securityDeposit)}</div>
            </div>
            <button onClick={()=>toggleDeposit(sel.id)}
              style={{background:sel.depositPaid ? C.goodBg : C.gold,color:sel.depositPaid ? C.good : C.ink,
                border:`1px solid ${sel.depositPaid ? C.good+"44" : C.gold}`,borderRadius:4,padding:"9px 14px",
                fontSize:11,...s.mono,textTransform:"uppercase",letterSpacing:"0.06em",cursor:"pointer"}}>
              {sel.depositPaid ? "✓ Paid — Tap to Undo" : "Mark as Received"}
            </button>
          </div>
        )}

        {/* contract */}
        <div style={{...s.card}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>Contract</div>
          <div style={{fontSize:11,color:C.chromeDim,marginBottom:12}}>
            {contract ? (contract.url ? "Linked to an external file." : "PDF uploaded to in-app storage.") : "No contract on file yet."}
          </div>

          {/* Option A: paste a link (Google Drive / Dropbox share link) — always works */}
          <div style={{marginBottom:14}}>
            <label style={s.label}>Contract Link (Google Drive, Dropbox, etc.)</label>
            <div style={{display:"flex",gap:8}}>
              <input style={{...s.input,flex:1}} placeholder="https://drive.google.com/..." value={linkInput} onChange={e=>setLinkInput(e.target.value)}/>
              <button onClick={()=>saveContractLink(sel.id)} style={{...s.btnGold,width:"auto",padding:"11px 16px"}}>Save</button>
            </div>
            <div style={{fontSize:10,color:C.chromeDim,marginTop:5,...s.mono}}>Recommended — most reliable option. Upload the PDF to Google Drive/Dropbox, set sharing to "Anyone with the link", then paste it here.</div>
            {linkSaved&&<div style={{marginTop:8,padding:"9px 12px",background:C.goodBg,border:`1px solid ${C.good}44`,borderRadius:5,fontSize:12,color:C.good,display:"flex",alignItems:"center",gap:6}}><Icon d={ICONS.check} size={13} color={C.good}/> Contract saved — the tenant can now see it.</div>}
          </div>

          <div style={{textAlign:"center",fontSize:10,color:C.chromeDim,...s.mono,margin:"4px 0 12px"}}>— or —</div>

          {/* Option B: direct file upload — best effort, may fail depending on storage */}
          <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>{setUploading(true);uploadContract(sel.id,e.target.files[0]);}}/>
          <button onClick={()=>fileRef.current?.click()} style={{...s.btnOut,display:"flex",alignItems:"center",gap:8,width:"100%",justifyContent:"space-between"}}>
            <span style={{display:"flex",alignItems:"center",gap:6}}><Icon d={ICONS.contract} size={14} color={C.gold}/> {contract&&!contract.url?"Replace Uploaded PDF":"Upload PDF Directly"}</span>
            <span style={{fontSize:11,color:contract&&!contract.url?C.good:C.chromeDim}}>{contract&&!contract.url?"✓ Uploaded":"Best effort"}</span>
          </button>
          {uploading&&<div style={{fontSize:11,color:C.chromeDim,marginTop:6,...s.mono}}>Uploading…</div>}
          {uploadError&&<div style={{fontSize:11.5,color:C.danger,marginTop:8,padding:"10px 12px",background:C.dangerBg,border:`1px solid ${C.danger}44`,borderRadius:5,lineHeight:1.5}}>⚠ {uploadError}</div>}
        </div>

        {/* maintenance requests */}
        {selMaint.length>0&&(
          <>
            <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>Maintenance Requests</div>
            {selMaint.map(r=>(
              <div key={r.id} style={{...s.card}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{r.description}</div>
                    <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>Priority: {r.priority} · {fmtDate(r.date)}</div>
                    {r.photo&&<img src={r.photo} alt="" style={{marginTop:8,borderRadius:4,maxHeight:100,maxWidth:160,objectFit:"cover",border:`1px solid ${C.line}`}}/>}
                  </div>
                  <Pill color={r.status==="done"?C.good:r.status==="declined"?C.danger:r.status==="approved"||r.status==="in-progress"?C.blue:C.warn}>{r.status}</Pill>
                </div>
                {r.status==="pending" ? (
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>updateMaintStatus(r.id,"approved")} style={{...s.btnGold,flex:1,padding:"9px"}}>✓ Approve</button>
                    <button onClick={()=>updateMaintStatus(r.id,"declined")} style={{...s.btnOut,flex:1,padding:"9px",color:C.danger,borderColor:C.danger+"44"}}>✗ Decline</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                    {["approved","in-progress","done"].map(st=>(
                      <button key={st} onClick={()=>updateMaintStatus(r.id,st)}
                        style={{background:r.status===st?C.gold:"transparent",color:r.status===st?C.ink:C.chromeDim,border:`1px solid ${C.line}`,borderRadius:3,padding:"4px 10px",fontSize:11,...s.mono,cursor:"pointer"}}>
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* transport requests */}
        {selTrans.length>0&&(
          <>
            <div style={{...s.heading,fontSize:11,color:C.chromeDim,marginTop:4}}>Transport Requests</div>
            {selTrans.map(r=><TransportRequestCard key={r.id} r={r} onQuote={sendTransportQuote}/>)}
          </>
        )}

        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={()=>{
            setForm({
              name:sel.name||"",phone:sel.phone||"",email:sel.email||"",pin:sel.pin||"1234",
              trailerId:sel.trailerId||"",termType:sel.termType||"monthly",termMonths:String(sel.termMonths||""),
              startDate:sel.startDate||"",endDate:sel.endDate||"",
              monthlyRate:String(sel.monthlyRate||""),creditRate:String(sel.creditRate||"15"),
              securityDeposit:String(sel.securityDeposit||""),lateFee:String(sel.lateFee||""),
              replacementValue:String(sel.replacementValue||""),purchaseOptionPrice:String(sel.purchaseOptionPrice||""),
              baseRent:String(sel.baseRent||""),purchaseCreditPerMonth:String(sel.purchaseCreditPerMonth||""),optionFee:String(sel.optionFee||""),
              operatingLocation:sel.operatingLocation||"",holdoverFee:String(sel.holdoverFee||""),repairThreshold:String(sel.repairThreshold||""),
              lateFee5:sel.lateFee5||"15%",lateFee10:sel.lateFee10||"20%",dueDay:sel.dueDay||"1st",
              equipment:sel.equipment||"",businessName:sel.businessName||"",secondLessee:sel.secondLessee||"",
              eventName:sel.eventName||"",eventAddress:sel.eventAddress||"",eventCoordinator:sel.eventCoordinator||"",
            });
            setEditingId(sel.id);
            setView("edit");
          }} style={{...s.btnOut,flex:1}}>Edit Tenant</button>
          <button onClick={()=>deleteTenant(sel.id)} style={{...s.btnOut,flex:1,color:C.danger,borderColor:C.danger+"44"}}>Delete Tenant</button>
        </div>
        <button onClick={()=>{
          const amt=fmt$(sel.monthlyRate||0);
          const tr=(db.trailers.find(x=>x.id===sel.trailerId)||{}).name||"your trailer";
          const body=`Dear ${sel.name},\n\nThis is a reminder regarding your rent of ${amt} for ${tr}. Please submit your payment via Zelle to ${OWNER_ZELLE}.\n\nThank you,\n${BRAND}`;
          updateDB(d=>addNotification(d,{forRole:"tenant",forTenantId:sel.id,title:"Rent Reminder",body}));
          alert("Reminder sent to "+sel.name+(sel.email?" ("+sel.email+")":" — no email on file, in-app only"));
        }} style={{...s.btnOut,width:"100%",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:C.blue,borderColor:C.blue+"55"}}>
          <Icon d={ICONS.bell} size={15} color={C.blue}/> Send Rent Reminder Now
        </button>
        <button onClick={()=>setView("lease")} style={{...s.btnOut,width:"100%",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:C.gold,borderColor:C.gold+"55"}}>
          <Icon d={ICONS.contract} size={15} color={C.gold}/> {sel.signature?"View Signed Lease":"View / Print Lease"}
        </button>
        <button onClick={()=>setView("legal")} style={{...s.btnOut,width:"100%",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:C.warn,borderColor:C.warn+"55"}}>
          <Icon d={ICONS.contract} size={15} color={C.warn}/> Legal / Small Claims
        </button>
      </div>
    );
  }

  if(view==="legal") return(
    <LegalCaseManager tenantId={sel.id} db={db} updateDB={updateDB} onBack={()=>setView("detail")}/>
  );

  if(view==="lease"){
    const lt=db.tenants.find(x=>x.id===sel.id)||sel;
    const ltr=db.trailers.find(x=>x.id===lt.trailerId)||{};
    const doPrintLease=()=>{document.body.classList.add("printing-petition");const cl=()=>{document.body.classList.remove("printing-petition");window.removeEventListener("afterprint",cl);};window.addEventListener("afterprint",cl);window.print();setTimeout(cl,1200);};
    return <LeaseContract tenant={lt} trailer={ltr} termType={lt.termType||"monthly"} signed={lt.signature} onClose={()=>setView("detail")} onPrint={doPrintLease}/>;
  }

  if(view==="edit") return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <button onClick={()=>{setView("detail");setEditingId(null);}} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>Edit Tenant</div>
      <div style={{fontSize:11.5,color:C.chromeDim,lineHeight:1.5,background:C.steel,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.line}`}}>
        These details auto-fill the lease that matches the rental term below. Leave a field blank to show a line in the contract for it.
      </div>
      <div>
        <label style={s.label}>Rental Term (picks which contract is used)</label>
        <select style={s.input} value={form.termType||"monthly"} onChange={e=>{
          const tt=e.target.value;
          const months=tt==="annual"?"12":tt==="weekly"?"":(form.termMonths||"1");
          setForm(f=>({...f,termType:tt,termMonths:months,endDate:tt==="weekly"?"":(f.startDate?addMonths(f.startDate,months):f.endDate)}));
        }}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual (12 months)</option>
          <option value="rent-to-own">Rent-to-Own</option>
        </select>
      </div>
      {[["name","Full Name","text"],["secondLessee","Co-Renter (Lessee 2, optional)","text"],["businessName","Business Name (optional)","text"],["phone","Phone","tel"],["email","Email","email"],["pin","Password (last 4 SSN / PIN)","text"],["monthlyRate","Monthly Rate ($)","number"],["securityDeposit","Security Deposit ($)","number"],["replacementValue","Trailer Replacement Value ($)","number"],["termMonths","Term Length (months)","number"],["startDate","Start Date","date"],["endDate","End Date","date"],["dueDay","Rent Due Day (e.g. 1st)","text"],["lateFee5","Late Fee after Day 5","text"],["lateFee10","Late Fee after Day 10","text"],["holdoverFee","Holdover Fee ($/day)","number"],["repairThreshold","Repair Approval Threshold ($)","number"],["operatingLocation","Approved Operating Location","text"]].map(([k,l,ty])=>(
        <div key={k}>
          <label style={s.label}>{l}</label>
          <input style={s.input} type={ty} value={form[k]||""} onChange={e=>{
            const v=e.target.value;
            setForm(f=>{
              const nf={...f,[k]:v};
              // auto-recompute end date from start + term months
              if(k==="startDate"||k==="termMonths"){ if(nf.termType!=="weekly"&&nf.startDate&&nf.termMonths) nf.endDate=addMonths(nf.startDate,nf.termMonths); }
              return nf;
            });
          }}/>
        </div>
      ))}
      {(form.termType==="rent-to-own")&&(
        <div style={{display:"flex",flexDirection:"column",gap:12,borderTop:`1px solid ${C.line}`,paddingTop:12}}>
          <div style={{...s.mono,fontSize:11,color:C.gold,letterSpacing:"0.08em",textTransform:"uppercase"}}>Rent-to-Own — Option to Purchase</div>
          {[["purchaseOptionPrice","Total Purchase Price ($)"],["baseRent","Base Rent per Month ($)"],["purchaseCreditPerMonth","Purchase Credit per Month ($)"],["optionFee","Option Fee ($, optional)"]].map(([k,l])=>(
            <div key={k}><label style={s.label}>{l}</label>
              <input style={s.input} type="number" value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></div>
          ))}
        </div>
      )}
      {(form.termType==="weekly")&&(
        <div style={{display:"flex",flexDirection:"column",gap:12,borderTop:`1px solid ${C.line}`,paddingTop:12}}>
          <div style={{...s.mono,fontSize:11,color:C.gold,letterSpacing:"0.08em",textTransform:"uppercase"}}>Event Details (weekly agreement)</div>
          {[["eventName","Event Name"],["eventAddress","Event Address"],["eventCoordinator","Event Coordinator — phone or email"]].map(([k,l])=>(
            <div key={k}><label style={s.label}>{l}</label>
              <input style={s.input} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></div>
          ))}
        </div>
      )}
      <div><label style={s.label}>Equipment included (listed in the lease)</label>
        <textarea style={{...s.input,minHeight:56,resize:"vertical"}} value={form.equipment||""} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))}/></div>
      <div>
        <label style={s.label}>Assign Trailer</label>
        <select style={s.input} value={form.trailerId} onChange={e=>{
          const id=e.target.value; const tr=db.trailers.find(x=>x.id===id);
          setForm(f=>({...f,trailerId:id,
            monthlyRate:f.monthlyRate||(tr?String(tr.monthlyRate||""):""),
            securityDeposit:f.securityDeposit||(tr?String(tr.securityDeposit||tr.monthlyRate||""):""),
            replacementValue:f.replacementValue||(tr?String(tr.replacementValue||tr.purchasePrice||""):""),
            purchaseOptionPrice:f.purchaseOptionPrice||(tr?String(tr.purchasePrice||""):""),
            equipment:f.equipment||(tr?.equipment||"")}));
        }}>
          <option value="">— None —</option>
          {db.trailers.map(t=><option key={t.id} value={t.id}>{t.nickname?t.nickname+" · ":""}{t.name}</option>)}
        </select>
      </div>
      <button style={s.btnGold} onClick={editTenant}>Save Changes</button>
    </div>
  );

  if(view==="add") return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <button onClick={()=>setView("list")} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>Add Tenant</div>
      {[["name","Full Name","text"],["phone","Phone","tel"],["email","Email","email"],["pin","PIN (4 digits)","password"],["monthlyRate","Monthly Rate ($)","number"],["securityDeposit","Security Deposit ($)","number"],["lateFee","Late Fee (per lease, $)","number"],["creditRate","Rent-to-Own Credit Rate (%)","number"],["startDate","Start Date","date"],["endDate","End Date","date"]].map(([k,l,t])=>(
        <div key={k}>
          <label style={s.label}>{l}</label>
          <input style={s.input} type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={k==="creditRate"?"e.g. 15":k==="pin"?"e.g. 1234":""}/>
        </div>
      ))}
      <div>
        <label style={s.label}>Assign Trailer</label>
        <select style={s.input} value={form.trailerId} onChange={e=>setForm(f=>({...f,trailerId:e.target.value}))}>
          <option value="">— None —</option>
          {db.trailers.filter(t=>t.status==="available").map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <button style={s.btnGold} onClick={addTenant}>Add Tenant</button>
    </div>
  );

  // list view — with maintenance/transport summary
  const allMaint=db.maintenanceRequests||[];
  const allTrans=db.transportRequests||[];
  const allBook=db.bookingRequests||[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("tenants",lang)}</div>
        <button onClick={()=>setView("add")} style={{...s.btnGold,width:"auto",padding:"9px 14px",display:"flex",alignItems:"center",gap:6}}>
          <Icon d={ICONS.plus} size={13}/> {t("add",lang)}
        </button>
      </div>

      {/* pending requests summary */}
      {[
        {list:allMaint.filter(r=>r.status==="pending"),icon:ICONS.wrench,label:"maintenance requests pending",color:C.warn},
        {list:allTrans.filter(r=>r.status==="pending"),icon:ICONS.truck,label:"transport requests need quote",color:C.blue},
        {list:allBook.filter(r=>r.status==="pending"),icon:ICONS.book,label:"booking requests pending",color:C.warn},
      ].filter(x=>x.list.length>0).map((x,i)=>(
        <div key={i} style={{background:x.color+"18",border:`1px solid ${x.color}33`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <Icon d={x.icon} size={16} color={x.color}/>
          <span style={{fontSize:12,color:C.paper}}><strong style={{color:x.color}}>{x.list.length}</strong> {x.label} — tap tenant to review</span>
        </div>
      ))}

      {/* Pending rental applications */}
      {pendingApps.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{...s.mono,fontSize:11,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase"}}>Rental Applications ({pendingApps.length})</div>
          {pendingApps.map(a=>(
            <div key={a.id} style={{background:C.steel,border:`1px solid ${C.gold}44`,borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:14,fontWeight:600,color:C.paper}}>{a.name}</div>
              <div style={{fontSize:11.5,color:C.chromeDim,marginTop:3,lineHeight:1.5}}>
                {a.phone} · {a.email}<br/>
                {a.trailerId?`${(db.trailers.find(x=>x.id===a.trailerId)||{}).name||"Trailer"} · `:""}{((a.termType||"monthly").charAt(0).toUpperCase()+(a.termType||"monthly").slice(1))}{a.businessType?` · ${a.businessType}`:""}<br/>
                {a.address||""}{a.dl?` · DL ${a.dl}`:""}{a.dob?` · DOB ${a.dob}`:""}
                {a.note&&<><br/><span style={{fontStyle:"italic"}}>"{a.note}"</span></>}
              </div>
              <div style={{...s.mono,fontSize:10,color:C.chromeDim,marginTop:4}}>Applied {fmtDate(a.date)}{a.ssn4?` · SSN ••••${a.ssn4}`:""}</div>
              {a.hasIdPhoto&&<IdPhotoViewer appId={a.id}/>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={()=>approveApplication(a)} style={{...s.btnGold,flex:1,padding:"9px"}}>✓ Approve & Create Lease</button>
                <button onClick={()=>declineApplication(a)} style={{...s.btnOut,flex:1,padding:"9px",color:C.danger,borderColor:C.danger+"44"}}>✗ Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {db.tenants.length===0&&<div style={{color:C.chromeDim,fontSize:13}}>No tenants yet.</div>}
      {db.tenants.map(t=>{
        const tr=db.trailers.find(x=>x.id===t.trailerId);
        const hasPending=db.payments.some(p=>p.tenantId===t.id&&p.status==="pending");
        const hasMaint=allMaint.some(r=>r.tenantId===t.id&&r.status==="pending");
        const hasTrans=allTrans.some(r=>r.tenantId===t.id&&r.status==="pending");
        return(
          <button key={t.id} onClick={()=>{setSel(t);setView("detail");}}
            style={{...s.card,textAlign:"left",width:"100%",color:C.paper,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
              <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>{t.phone} · {tr?.name||"No trailer"}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                {hasPending&&<Pill color={C.warn}>Payment due</Pill>}
                {hasMaint&&<Pill color={C.warn}>Maintenance</Pill>}
                {hasTrans&&<Pill color={C.blue}>Transport req.</Pill>}
              </div>
            </div>
            <Icon d="M9 18l6-6-6-6" size={16} color={C.chromeDim}/>
          </button>
        );
      })}
    </div>
  );
}

function TransportRequestCard({r,onQuote}){
  const [showForm,setShowForm]=useState(false);
  const [price,setPrice]=useState("");
  const [note,setNote]=useState("");
  return(
    <div style={{...s.card}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div>
          <div style={{fontSize:13,fontWeight:500}}>{r.from} → {r.to}</div>
          <div style={{fontSize:11,color:C.chromeDim,marginTop:2}}>Requested {fmtDate(r.submittedDate)}{r.date?` · Target: ${fmtDate(r.date)}`:""}</div>
          {r.notes&&<div style={{fontSize:12,color:C.paper,marginTop:4}}>{r.notes}</div>}
          {r.quotedPrice&&<div style={{fontSize:14,...s.mono,color:C.gold,marginTop:6}}>Quoted: {fmt$(r.quotedPrice)}</div>}
          {r.tenantAccepted===true&&<div style={{fontSize:12,color:C.good,marginTop:4}}>✓ Tenant accepted</div>}
          {r.tenantAccepted===false&&<div style={{fontSize:12,color:C.danger,marginTop:4}}>✗ Tenant declined</div>}
        </div>
        <Pill color={r.status==="accepted"?C.good:r.status==="quoted"?C.blue:r.status==="declined"?C.danger:C.warn}>{r.status}</Pill>
      </div>
      {r.status==="pending"&&(
        showForm?(
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
            <div><label style={s.label}>Your Price Quote ($)</label><input style={s.input} type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 350"/></div>
            <div><label style={s.label}>Note to tenant (optional)</label><input style={s.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="Includes fuel, 2-man crew, etc."/></div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...s.btnGold,flex:1,padding:"10px"}} onClick={()=>{if(price){onQuote(r.id,price,note);setShowForm(false);}}}>Send Quote</button>
              <button style={{...s.btnOut,flex:1,padding:"10px"}} onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </div>
        ):(
          <button onClick={()=>setShowForm(true)} style={{...s.btnGold,marginTop:10,padding:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Icon d={ICONS.pay} size={14}/> Send Price Quote
          </button>
        )
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ADMIN ACCOUNTING — income, expenses, P&L, A/R & A/P          */
/*  Rent income flows in automatically from confirmed payments.  */
/* ═══════════════════════════════════════════════════════════ */
const EXPENSE_CATEGORIES=["Maintenance","Fuel / Transport","Insurance","Trailer Purchase","Supplies","Permits / Fees","Utilities","Labor","Marketing","Other"];
const INCOME_CATEGORIES=["Rent","Sale","Transport Service","Repair / Inspection","Deposit","Other Income"];

function AdminAccounting({db,updateDB,lang}){
  const [scope,setScope]=useState("all");     // all | tenant:<id> | trailer:<id>
  const [month,setMonth]=useState("all");      // all | YYYY-MM
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({type:"expense",amount:"",date:today(),category:"Maintenance",note:"",trailerId:"",tenantId:"",status:"paid"});

  const tenants=db.tenants||[]; const trailers=db.trailers||[];
  const tName=(id)=>(tenants.find(t=>t.id===id)||{}).name||"—";
  const trName=(id)=>(trailers.find(t=>t.id===id)||{}).name||"—";

  // Rent income derived automatically from the payments the admin confirms
  const rentRows=(db.payments||[]).map(p=>({
    id:p.id, kind:"payment", type:"income", amount:Number(p.amount)||0, date:p.date,
    category:"Rent", note:p.note||"Rent payment", tenantId:p.tenantId,
    trailerId:(tenants.find(t=>t.id===p.tenantId)||{}).trailerId||"",
    status:p.status==="paid"?"paid":"unpaid",
  }));
  const manualRows=(db.transactions||[]).map(x=>({...x,kind:"manual"}));
  const all=[...rentRows,...manualRows];

  const inScope=(e)=> scope==="all"?true
    : scope.startsWith("tenant:")?e.tenantId===scope.slice(7)
    : scope.startsWith("trailer:")?e.trailerId===scope.slice(8):true;
  const inMonth=(e)=> month==="all"?true:(e.date||"").slice(0,7)===month;
  const rows=all.filter(e=>inScope(e)&&inMonth(e)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const sum=(arr)=>arr.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const income=sum(rows.filter(e=>e.type==="income"&&e.status==="paid"));
  const expense=sum(rows.filter(e=>e.type==="expense"&&e.status==="paid"));
  const net=income-expense;
  const receivable=sum(rows.filter(e=>e.type==="income"&&e.status!=="paid")); // owed TO you
  const payable=sum(rows.filter(e=>e.type==="expense"&&e.status!=="paid"));    // owed BY you

  // Months present (for the month filter)
  const months=[...new Set(all.map(e=>(e.date||"").slice(0,7)).filter(Boolean))].sort().reverse();

  // Per-trailer profit (only meaningful when viewing all)
  const perTrailer=trailers.map(tr=>{
    const r=all.filter(e=>e.trailerId===tr.id&&(month==="all"||(e.date||"").slice(0,7)===month));
    const inc=sum(r.filter(e=>e.type==="income"&&e.status==="paid"));
    const exp=sum(r.filter(e=>e.type==="expense"&&e.status==="paid"));
    return {name:tr.name,inc,exp,net:inc-exp};
  }).filter(x=>x.inc||x.exp);

  const addTx=()=>{
    if(!form.amount)return;
    const entry={id:"TX"+uid(),type:form.type,amount:Number(form.amount),date:form.date,
      category:form.category,note:form.note.trim(),trailerId:form.trailerId,tenantId:form.tenantId,status:form.status};
    updateDB(d=>{ d.transactions=[...(d.transactions||[]),entry]; return d; });
    setForm({type:"expense",amount:"",date:today(),category:"Maintenance",note:"",trailerId:"",tenantId:"",status:"paid"});
    setShowAdd(false);
  };
  const delTx=(id)=>updateDB(d=>{ d.transactions=(d.transactions||[]).filter(x=>x.id!==id); return d; });

  const exportCSV=()=>{
    const head=["Date","Type","Category","Amount","Status","Tenant","Trailer","Note"];
    const lines=rows.map(e=>[e.date,e.type,e.category,e.amount,e.status,tName(e.tenantId),trName(e.trailerId),(e.note||"").replace(/[",\n]/g," ")]);
    const csv=[head,...lines].map(r=>r.map(c=>`"${c??""}"`).join(",")).join("\n");
    try{
      const blob=new Blob([csv],{type:"text/csv"});
      const url=URL.createObjectURL(blob); const a=document.createElement("a");
      a.href=url; a.download=`accounting_${scope}_${month}.csv`; a.click(); URL.revokeObjectURL(url);
    }catch(e){ alert("Export not supported on this device."); }
  };

  const Card=({label,value,color})=>(
    <div style={{flex:1,minWidth:92,background:C.steel,border:`1px solid ${C.line}`,borderRadius:9,padding:"12px 12px"}}>
      <div style={{fontSize:10,...s.mono,color:C.chromeDim,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</div>
      <div style={{fontSize:18,...s.mono,fontWeight:600,color:color||C.paper,marginTop:4}}>{fmt$(value)}</div>
    </div>
  );
  const sel={...s.input,padding:"9px 10px"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fadein">
      <div style={{...s.heading,fontSize:18,fontWeight:700}}>Accounting</div>

      {/* P&L summary */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Card label="Income" value={income} color={C.good}/>
        <Card label="Expenses" value={expense} color={C.danger}/>
        <Card label="Net Profit" value={net} color={net>=0?C.gold:C.danger}/>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Card label="Receivable (owed to you)" value={receivable} color={C.blue}/>
        <Card label="Payable (you owe)" value={payable} color={C.warn}/>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8}}>
        <select style={{...sel,flex:2}} value={scope} onChange={e=>setScope(e.target.value)}>
          <option value="all">All business</option>
          <optgroup label="By tenant">
            {tenants.map(t=><option key={t.id} value={"tenant:"+t.id}>{t.name}</option>)}
          </optgroup>
          <optgroup label="By trailer">
            {trailers.map(t=><option key={t.id} value={"trailer:"+t.id}>{t.name}</option>)}
          </optgroup>
        </select>
        <select style={{...sel,flex:1}} value={month} onChange={e=>setMonth(e.target.value)}>
          <option value="all">All time</option>
          {months.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowAdd(v=>!v)} style={{...s.btnGold,flex:1}}>{showAdd?"Close":"+ Add Income / Expense"}</button>
        <button onClick={exportCSV} style={{...s.btnOut,width:"auto",padding:"0 16px",display:"flex",alignItems:"center",gap:6}}><Icon d={ICONS.download} size={14}/> CSV</button>
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.steel,border:`1px solid ${C.lineBright}`,borderRadius:9,padding:"14px 15px",display:"flex",flexDirection:"column",gap:10}} className="fadein">
          <div style={{display:"flex",gap:8}}>
            {["expense","income"].map(ty=>(
              <button key={ty} onClick={()=>setForm(f=>({...f,type:ty,category:ty==="expense"?EXPENSE_CATEGORIES[0]:INCOME_CATEGORIES[0]}))}
                style={{flex:1,padding:"9px",borderRadius:6,cursor:"pointer",...s.mono,fontSize:11,textTransform:"uppercase",
                  background:form.type===ty?(ty==="income"?C.good:C.danger):"none",color:form.type===ty?C.paper:C.chromeDim,border:`1px solid ${form.type===ty?(ty==="income"?C.good:C.danger):C.line}`}}>
                {ty}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><label style={s.label}>Amount ($)</label><input style={s.input} type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></div>
            <div style={{flex:1}}><label style={s.label}>Date</label><input style={s.input} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          </div>
          <div><label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              {(form.type==="expense"?EXPENSE_CATEGORIES:INCOME_CATEGORIES).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><label style={s.label}>Trailer (optional)</label>
              <select style={s.input} value={form.trailerId} onChange={e=>setForm(f=>({...f,trailerId:e.target.value}))}>
                <option value="">—</option>{trailers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{flex:1}}><label style={s.label}>Tenant (optional)</label>
              <select style={s.input} value={form.tenantId} onChange={e=>setForm(f=>({...f,tenantId:e.target.value}))}>
                <option value="">—</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={s.label}>Status</label>
            <select style={s.input} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option value="paid">Paid / Settled</option>
              <option value="unpaid">{form.type==="expense"?"Unpaid (payable)":"Expected (receivable)"}</option>
            </select>
          </div>
          <div><label style={s.label}>Note</label><input style={s.input} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. New tires for T2"/></div>
          <button onClick={addTx} style={s.btnGold} disabled={!form.amount}>Save Entry</button>
        </div>
      )}

      {/* Per-trailer profitability */}
      {scope==="all"&&perTrailer.length>0&&(
        <div>
          <div style={{...s.mono,fontSize:10,color:C.chromeDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Profit by Trailer</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {perTrailer.map((x,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.ink2,border:`1px solid ${C.line}`,borderRadius:7,padding:"9px 12px"}}>
                <span style={{fontSize:12,color:C.paper}}>{x.name}</span>
                <span style={{...s.mono,fontSize:13,fontWeight:600,color:x.net>=0?C.good:C.danger}}>{fmt$(x.net)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div>
        <div style={{...s.mono,fontSize:10,color:C.chromeDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Transactions ({rows.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {rows.length===0&&<div style={{fontSize:12,color:C.chromeDim,textAlign:"center",padding:"10px"}}>No entries for this filter.</div>}
          {rows.map(e=>(
            <div key={e.id} style={{display:"flex",gap:10,alignItems:"center",background:C.steel,border:`1px solid ${C.line}`,borderRadius:7,padding:"10px 12px"}}>
              <div style={{width:6,height:34,borderRadius:3,background:e.type==="income"?C.good:C.danger,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,color:C.paper,fontWeight:600}}>{e.category}{e.note?` · ${e.note}`:""}</div>
                <div style={{...s.mono,fontSize:10,color:C.chromeDim,marginTop:2}}>
                  {fmtDate(e.date)}{e.tenantId?` · ${tName(e.tenantId)}`:""}{e.trailerId?` · ${trName(e.trailerId)}`:""}
                  {e.status!=="paid"&&<span style={{color:e.type==="income"?C.blue:C.warn}}> · {e.type==="income"?"receivable":"payable"}</span>}
                </div>
              </div>
              <div style={{...s.mono,fontSize:13,fontWeight:600,color:e.type==="income"?C.good:C.danger,flexShrink:0}}>{e.type==="income"?"+":"−"}{fmt$(e.amount)}</div>
              {e.kind==="manual"
                ? <button onClick={()=>delTx(e.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Icon d={ICONS.trash} size={14} color={C.danger}/></button>
                : <span title="From a confirmed payment" style={{...s.mono,fontSize:8,color:C.chromeDim,width:16,textAlign:"center"}}>auto</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{fontSize:10.5,color:C.chromeDim,lineHeight:1.5,marginTop:4}}>
        Rent marked <strong style={{color:C.paper}}>paid</strong> in Payments appears here as income automatically. Add expenses and other income above; link each to a tenant or trailer to see true profit per unit.
      </div>
    </div>
  );
}

/* ── Admin Payments ──────────────────────────────────────── */

function AdminPayments({db,updateDB,lang}){
  const [form,setForm]=useState({tenantId:"",amount:"",date:today(),method:"Zelle",status:"paid",note:""});
  const [adding,setAdding]=useState(false);

  const addPayment=()=>{
    if(!form.tenantId||!form.amount)return;
    const p={id:"P"+uid(),...form,amount:Number(form.amount)};
    updateDB(db=>{
      db.payments=[...db.payments,p];
      if(p.status==="paid"){
        addNotification(db,{forRole:"tenant",forTenantId:p.tenantId,title:"Payment Confirmed",body:`Abu Arab confirmed your ${p.note||"payment"} of ${fmt$(p.amount)} as received.`});
      }
      return db;
    });
    setAdding(false);setForm({tenantId:"",amount:"",date:today(),method:"Zelle",status:"paid",note:""});
  };

  const markPaid=(id)=>updateDB(db=>{
    const p=db.payments.find(x=>x.id===id);
    if(p){
      p.status="paid";
      addNotification(db,{forRole:"tenant",forTenantId:p.tenantId,title:"Payment Confirmed ✓",body:`Your ${p.note||"payment"} of ${fmt$(p.amount)} has been confirmed.`});
    }
    return db;
  });
  const deletePayment=(id)=>updateDB(db=>{db.payments=db.payments.filter(p=>p.id!==id);return db;});

  const all=[...db.payments].sort((a,b)=>b.date.localeCompare(a.date));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("payments",lang)}</div>
        <button onClick={()=>setAdding(!adding)} style={{...s.btnGold,width:"auto",padding:"9px 14px",display:"flex",alignItems:"center",gap:6}}>
          <Icon d={ICONS.plus} size={13}/> {t("add",lang)}
        </button>
      </div>
      <div style={{fontSize:12,color:C.chromeDim}}>
        If a tenant paid externally (Zelle, cash, check), add it here and mark it as paid — they'll get a notification automatically.
      </div>
      {adding&&(
        <div style={{...s.card,display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <label style={s.label}>Tenant</label>
            <select style={s.input} value={form.tenantId} onChange={e=>setForm(f=>({...f,tenantId:e.target.value}))}>
              <option value="">— Select —</option>
              {db.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={s.label}>Amount ($)</label><input style={s.input} type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></div>
            <div><label style={s.label}>Date</label><input style={s.input} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={s.label}>Method</label>
              <select style={s.input} value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}>
                {["Zelle","Cash","Check","Other"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Status</label>
              <select style={s.input} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="paid">Paid ✓</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div><label style={s.label}>Note</label><input style={s.input} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. August 2026"/></div>
          <button style={s.btnGold} onClick={addPayment}>Save Payment</button>
        </div>
      )}
      {all.map(p=>{
        const t=db.tenants.find(x=>x.id===p.tenantId);
        return(
          <div key={p.id} style={{...s.card,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500}}>{t?.name||"Unknown"}</div>
              <div style={{fontSize:11,color:C.chromeDim}}>{p.note||"Payment"} · {fmtDate(p.date)} · {p.method}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:14,...s.mono,color:C.gold}}>{fmt$(p.amount)}</div>
              <div style={{display:"flex",gap:4,marginTop:4,justifyContent:"flex-end",flexWrap:"wrap"}}>
                {p.status==="pending"&&<button onClick={()=>markPaid(p.id)} style={{background:C.goodBg,border:`1px solid ${C.good}44`,color:C.good,padding:"2px 8px",borderRadius:3,fontSize:10,...s.mono,cursor:"pointer"}}>Mark Paid ✓</button>}
                <Pill color={p.status==="paid"?C.good:C.warn}>{p.status}</Pill>
              </div>
            </div>
            <button onClick={()=>deletePayment(p.id)} style={{background:"none",border:"none",color:C.chromeDim,padding:4,cursor:"pointer"}}>
              <Icon d={ICONS.trash} size={14}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  RENTAL APPLICATION + AUTO-FILLED LEASE + E-SIGNATURE         */
/*  Legally valid e-sign under the ESIGN Act & Texas UETA:       */
/*  captures intent, electronic-records consent, signer identity */
/*  and a tamper-evident audit trail (time, document hash, UA).  */
/* ═══════════════════════════════════════════════════════════ */
const LESSOR_NAME="Abu Arab Trailer Solutions (Owned and Operated by SBK LLC)";
const LESSOR_ADDR="761 Wiltshire Dr, Hutto, TX 78634";

function hashStr(str){ let h=5381; for(let i=0;i<str.length;i++){ h=((h<<5)+h)^str.charCodeAt(i); } return (h>>>0).toString(16).toUpperCase(); }

// Build the lease clause set, filled from a tenant and the chosen term type.
/* ── Fleet auto-nickname: fixed animal per size, color varies ── */
const SIZE_ANIMAL=[[14,"Cat"],[16,"Fox"],[18,"Wolf"],[20,"Bear"],[22,"Lion"],[24,"Bull"],[26,"Stallion"]];
function animalForLength(len){
  const n=parseInt(String(len||"").replace(/[^0-9]/g,""),10);
  if(!n) return "Mustang";
  for(const [max,a] of SIZE_ANIMAL){ if(n<=max) return a; }
  return "Dragon";
}
function autoNickname(len,color){
  const animal=animalForLength(len);
  const c=(color||"").trim();
  return c ? `The ${c.charAt(0).toUpperCase()+c.slice(1)} ${animal}` : `The ${animal}`;
}

function leaseSections(t,termType){
  const isWeekly=termType==="weekly";
  const isRTO=termType==="rent-to-own"||termType==="rto";
  const isAnnual=termType==="annual";
  const LESSOR="Texan Food Trailers Solution";
  const rate=Number(t.monthlyRate)||0;
  const weekly=Number(t.weeklyRate)|| Math.round((rate*12/52)) || 0;
  const dep=Number(t.securityDeposit)||0;
  const repl=Number(t.replacementValue||t.purchasePrice)||0;
  const price=Number(t.purchaseOptionPrice||t.purchasePrice||repl)||0;
  const baseRent=Number(t.baseRent)||0;
  const credit=Number(t.purchaseCreditPerMonth)||0;
  const B="____________";          // blank for unknown fields
  const lesseeLine=`${t.name||B}${t.secondLessee?` and ${t.secondLessee}`:""}${t.dl?`  ·  DL/ID: ${t.dl}`:""}${t.dob?`  ·  DOB: ${t.dob}`:""}${t.businessName?`  ·  Business: ${t.businessName}`:""}`;
  const trailerLine=`${t._trailerName||"Food trailer"}${t._trailerYear?`  ·  Year ${t._trailerYear}`:""}${t._trailerVin?`  ·  VIN ${t._trailerVin}`:""}${t._trailerLength?`  ·  Size ${t._trailerLength}`:""}`;
  const S=[];
  const P=(title,paras,initials)=>S.push({n:S.length+1,title,paras,initials});

  /* ───────────── WEEKLY SHORT-FORM (your weekly template) ───────────── */
  if(isWeekly){
    P("Parties",[
      `LESSOR / OWNER: ${LESSOR}  ·  ${LESSOR_ADDR}  ·  ${OWNER_PHONE}  ·  ${OWNER_EMAIL}.`,
      `LESSEE / RENTER: ${lesseeLine}. Mailing address: ${t.address||B}.  Phone: ${t.phone||B}.`]);
    P("Trailer Description",[
      `${trailerLine}.  Trailer Replacement Value (full price): ${repl?fmt$(repl):"$ "+B}.`,
      `Equipment included: ${t.equipment||B}.`]);
    P("Rental Period & Location",[
      `Pick-up: ${t.startDate||B}.  Return: ${t.endDate||B}. The trailer must be returned on the agreed date and time; time is of the essence.`,
      `Pick-up & return location: ${t.operatingLocation||B}.`]);
    P("Event Details",[
      `Event name: ${t.eventName||B}.`,
      `Event address: ${t.eventAddress||B}.`,
      `Event coordinator phone number or email address: ${t.eventCoordinator||B}.`]);
    P("Payment",[
      `Weekly Rent (due in full before pick-up): ${weekly?fmt$(weekly):"$ "+B}.`,
      `Security Deposit (refundable — see Security Deposit): ${dep?fmt$(dep):"$ "+B}.`,
      `TOTAL DUE BEFORE PICK-UP: ${fmt$((weekly||0)+(dep||0))}.`],true);
    P("Late Return",[
      `(a) If returned late by up to 24 hours, a $200.00 late-return fee is deducted from the Security Deposit.`,
      `(b) After the first 24 hours, an additional $250.00 is charged for each day (or part of a day) the trailer is not returned.`,
      `(c) Any late-return charges exceeding the Security Deposit must be paid within seven (7) days of written notice. (d) If the trailer is not returned after written demand, Lessor may recover it and report it to law enforcement as unreturned rental property.`,
      `Legal basis: Tex. Bus. & Com. Code §2A.504(a); Tex. Penal Code §31.01(6)(D) and §31.04(b)(4).`],true);
    P("Security Deposit",[
      `The Security Deposit is refunded after the trailer is returned and inspected, less any deductions for late-return fees, cleaning, missing equipment, damage, or repairs. If these costs exceed the deposit, Lessee pays the balance within seven (7) days of written notice.`,
      `Legal basis: Tex. Bus. & Com. Code §1.302 and §2A.504.`]);
    P("Pick-up, Transport & Return Condition",[
      `Lessee is fully responsible for towing the trailer at Lessee's own risk and expense, from pick-up through return, and for returning it to the same location.`,
      `Photos and/or video of the trailer and equipment are taken at pick-up and return and serve as the official record of condition.`,
      `Lessee must return the trailer clean inside and out, with all equipment present and working, and with no scratches, dents, or damage. Lessee is responsible for the full cost of any cleaning, repair, or replacement needed to restore the trailer to its pick-up condition.`],true);
    P("Prohibited Uses",[
      `(a) No subleasing, lending, or transfer, and no other person or business may operate from the trailer, without Lessor's prior written consent.`,
      `(b) No spraying, painting, wrapping, stickers, decals, or adhesive material on any surface, inside or out.`,
      `(c) No drilling, cutting, removing, adding, or altering any part, fixture, or equipment. Any violation lets Lessor end this Agreement immediately and recover the trailer, with the full cost of restoration charged to Lessee.`,
      `Legal basis: Tex. Bus. & Com. Code §2A.303(b),(d); §2A.523 and §2A.525(c).`],true);
    P("GPS Tracking, Fire & Accident",[
      `(a) The trailer is tracked at all times by a third-party GPS tracking company during the rental period; Lessee consents by signing.`,
      `(b) GPS tracking does not reduce Lessee's responsibility. If the trailer is burned, damaged by fire, stolen, or involved in an accident while in Lessee's possession, Lessee is responsible for the full Replacement Value in the Trailer Description.`,
      `Legal basis: Tex. Penal Code §16.06(d)(1); Tex. Bus. & Com. Code §2A.219 and §1.302.`],true);
    P("Governing Law",[
      `This Agreement is a lease of goods governed by the laws of the State of Texas, including Chapter 2A of the Texas Business and Commerce Code. If any provision is unenforceable, the remaining provisions stay in full effect.`]);
    P("Acceptance",[
      `By signing below, both parties confirm they have read, understood, and agree to all terms of this Agreement.`]);
    return S;
  }

  /* ───────────── MONTHLY / ANNUAL / RENT-TO-OWN (full long-form) ───────────── */
  const termLabel=isRTO?"Rent-to-Own (Lease with Option to Purchase)":isAnnual?"Annual (12-month)":"Monthly / Long-Term";
  const months=t.termMonths||(isAnnual?12:"");
  P("Parties to the Agreement",[
    `This Agreement (${termLabel}) is entered into on ${t.startDate||B} (the "Effective Date").`,
    `LESSOR / OWNER: ${LESSOR}  ·  ${LESSOR_ADDR}  ·  ${OWNER_PHONE}  ·  ${OWNER_EMAIL}.`,
    `LESSEE 1 / RENTER: ${lesseeLine}. Mailing address: ${t.address||B}. Phone: ${t.phone||B}. Email: ${t.email||B}.`,
    t.secondLessee?`LESSEE 2 / CO-RENTER: ${t.secondLessee}.`:`LESSEE 2 / CO-RENTER (if any): ${B}.`,
    `If more than one Lessee signs, all Lessees are jointly and severally liable for every obligation — each is individually responsible for 100% of all rent, fees, and obligations, not merely a share. A business entity does not release the individual Lessee(s) from personal liability.`]);
  P("Trailer Description & Equipment",[
    `${trailerLine}.  Trailer Replacement Value (full price): ${repl?fmt$(repl):"$ "+B}.`,
    `Equipment included (acknowledged in working condition at handover): ${t.equipment||B}.`,
    `The trailer is rented in its present condition, as documented in the Move-In Condition Report, unless otherwise stated in writing.`]);
  P("Lease Term",[
    `Term length: ${months||B} months.  Start Date: ${t.startDate||B}.  End Date: ${t.endDate||B}.`,
    `The lease begins on the Start Date and ends on the End Date unless terminated earlier under this Agreement.`]);
  P("Rent, Deposit & Payment",[
    `Monthly Rent: ${rate?fmt$(rate):"$ "+B}.  Security Deposit (refundable): ${dep?fmt$(dep):"$ "+B}.  First Month Rent (due at signing): ${rate?fmt$(rate):"$ "+B}.  TOTAL DUE BEFORE POSSESSION: ${fmt$((rate||0)+(dep||0))}.`,
    `Monthly rent is due on the ${t.dueDay||"1st"} day of each month (the "Due Date"), paid by Zelle, Cash App, cash (receipt required), or check. The Security Deposit is not rent and may not be used as payment for any month's rent without Lessor's prior written approval. Rent does not include any sales/use tax, which is Lessee's responsibility.`,
    `Legal basis: Tex. Bus. & Com. Code §1.302, §2A.201; Tex. Tax Code §151.005.`],true);
  P("Late Fees & Returned Payments",[
    `After Day 5 past the Due Date: ${t.lateFee5||"15%"} of monthly rent (Late). After Day 10: ${t.lateFee10||"20%"} of monthly rent, replacing the Day-5 fee (Late). After Day 15: full balance due (DEFAULT).`,
    `Any payment returned unpaid by the bank is charged a $30.00 returned-payment fee, and Lessor may require future payments in certified funds.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.504(a); §3.506.`],true);
  P("Default & Repossession",[
    `Default includes: rent or any amount unpaid 15 calendar days after its Due Date; failure to keep required insurance; any sublease, transfer, or prohibited use; removing/disabling/tampering with GPS; abandonment; or any other material breach not cured within 5 days after written notice.`,
    `On Default, Lessor may (a) take possession and remove the trailer; (b) render it and its equipment unusable; (c) terminate this Agreement; and (d) recover all unpaid amounts and repossession costs. Repossession is carried out without breach of the peace; Lessee authorizes it and waives any claim for trespass or wrongful taking.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.523; §2A.525(b)–(c).`],true);
  P("Personal Guarantee — Joint & Several",[
    `Each Lessee personally and unconditionally guarantees all obligations, including those of any business named above. This guarantee survives business closure, LLC/corporation dissolution, and any change of business name. Lessor may pursue any one or all Lessees individually for all amounts due.`],true);
  P("Insurance",[
    `Before possession and throughout the term, Lessee shall maintain: commercial general liability of not less than $1,000,000 per occurrence; physical damage coverage for at least the Trailer Replacement Value; and any other coverage required by law, a landlord/host, or a permitting authority.`,
    `${LESSOR} must be named as Additional Insured on the liability policy and Loss Payee on the physical damage coverage. Proof of insurance is required before possession and on each renewal. Failure to maintain insurance is an immediate Default.`]);
  P("Health, Fire & Regulatory Compliance",[
    `Lessee is solely responsible for obtaining, paying for, and keeping current all permits, licenses, and approvals: mobile food unit / health department permits and inspections; fire marshal approvals (suppression system and extinguishers); food handler and manager certifications; business licenses, Texas sales-tax permit, and commissary requirements; and all other city, county, and state regulations.`,
    `All citations, penalties, fees, violations, and closures are the sole responsibility of Lessee. Lessor is not liable for business interruption caused by government action.`]);
  P("Maintenance & Repairs",[
    `Lessee shall keep the trailer clean, sanitary, and safe: daily cleaning and grease/grease-trap management; waste and wastewater disposal and fresh-water sanitation; propane care (gas off after each use); tires, lights, and hitch damaged during use; and all damage from misuse, negligence, or improper operation. Normal wear and tear excepted.`,
    `Lessee must notify Lessor within 24 hours of any equipment failure. Any repair over ${t.repairThreshold?fmt$(t.repairThreshold):"$"+ (B)} requires Lessor's prior written approval, performed by a qualified technician approved by Lessor.`]);
  P("Fire, Theft, Accident & Casualty Loss",[
    `From possession until the trailer is returned to and accepted by Lessor, the entire risk of loss, theft, damage, or destruction is on Lessee. Lessee must notify Lessor immediately, and within 24 hours, of any fire, theft, vandalism, accident, or damage, and file a police/fire report when applicable.`,
    `If the trailer is destroyed, stolen, burned, or a total loss, Lessee is responsible for the full Trailer Replacement Value, less insurance proceeds actually received by Lessor. For partial damage, Lessee is responsible for the full cost of repair. Rent continues until Lessor is paid in full.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.219, §1.302, §2A.504.`],true);
  P("No Subleasing, Transfer or Alteration",[
    `Without Lessor's prior written consent, Lessee shall not: sublease, rent, lend, or allow others to operate from the trailer; transfer possession, assign this Agreement, or sell/pledge any interest; spray, paint, wrap, or apply stickers/decals/adhesive to any surface, inside or out; drill, cut, remove, add, or alter any part, fixture, or equipment; or take the trailer outside the State of Texas.`,
    `Any violation is an immediate Default. Lessee is responsible for the full cost of restoring the trailer to its original condition.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.303(b),(d).`],true);
  P("Inspection Rights",[
    `Lessor may inspect the trailer with reasonable notice (at least 24 hours, except in an emergency) to verify equipment condition, sanitation, structural condition, safety systems, and location. Lessee shall cooperate fully.`]);
  P("GPS Tracking Authorization",[
    `The trailer is equipped with GPS tracking operated by a third-party company; Lessee consents to location monitoring at all times during the lease, used for asset protection, recovery, repossession, and location verification. GPS does not reduce Lessee's responsibility for casualty loss. Removing, disabling, or tampering with tracking equipment is an immediate Default.`,
    `Legal basis: Tex. Penal Code §16.06(d)(1).`],true);
  P("Trailer Location & Relocation Notice",[
    `Approved operating location: ${t.operatingLocation||B}. Lessee must give Lessor written notice at least 48 hours before moving the trailer (new address, date/time, and reason). Failure to give notice is a breach, and Lessor may deny any relocation in its sole discretion.`],true);
  P("Move-In Condition Report & Photos",[
    `Before possession, the parties jointly inspect the trailer and complete a written Move-In Condition Report recording equipment condition and any existing dents, scratches, or defects, supported by dated photos/video taken by Lessor. The report and photos are part of this Agreement. If no report is completed, the trailer is presumed delivered clean and in good working condition.`],true);
  P("Return Condition, Deposit & Late Return",[
    `At the end or termination, Lessee must return the trailer at Lessee's expense to the location designated by Lessor, in the same condition shown in the Move-In Report (normal wear and tear excepted): thoroughly cleaned inside and out with grease traps and waste tanks emptied; all equipment present and working with no new damage; all personal property and food inventory removed.`,
    `The Security Deposit is returned within 30 days after return and inspection, less any unpaid rent, fees, cleaning, repairs, or missing equipment, with an itemized list. If costs exceed the deposit, Lessee pays the difference within 7 days of written notice. If not returned by the End Date, Lessee pays a holdover fee of ${t.holdoverFee?fmt$(t.holdoverFee):"$"+(B)} per day until returned, and Lessor may recover the trailer.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.504, §2A.530; Tex. Penal Code §31.01(6)(D), §31.04(b)(4).`],true);
  P("Fixed Rent & Renewal",[
    `The Monthly Rent is fixed for the entire lease term and will not be increased during the term. Any renewal or extension must be agreed in writing and may be at a new rate.`]);
  P("Early Termination & Breach",[
    `A. Deposit Forfeiture. If Lessee ends this Agreement early, or Lessor ends it for Lessee's Default, the full Security Deposit${dep?` of ${fmt$(dep)}`:""} is forfeited as liquidated damages, and the trailer must be returned.`,
    `B. Recovery of Amounts Owed. Lessor may also recover: all rent and fees unpaid at termination; cleaning, repair, or replacement of damaged/missing equipment; towing, storage, and recovery costs; and loss of rent for the remaining term (reduced by any amount earned by re-leasing), plus court costs and attorney's fees. Claims within the court's limit may be filed in Justice Court (Small Claims). Remedies are cumulative and not exclusive.`,
    `Legal basis: Tex. Bus. & Com. Code §2A.504, §2A.523, §2A.528, §2A.529; Tex. Gov't Code §27.031.`],true);
  P("Towing, Storage & Recovery Costs",[
    `All costs of repossession, towing, storage, recovery, locksmith services, and collection efforts are the sole responsibility of Lessee and are due immediately upon demand.`]);
  P("Indemnification",[
    `LESSEE SHALL DEFEND, INDEMNIFY, AND HOLD HARMLESS ${LESSOR.toUpperCase()} AND ITS OWNERS, MEMBERS, AND AGENTS FROM ALL CLAIMS, LOSSES, DAMAGES, AND EXPENSES (INCLUDING ATTORNEY'S FEES) ARISING FROM THE POSSESSION, TOWING, OR OPERATION OF THE TRAILER, FOOD PREPARATION AND SALES, ACTIONS OF LESSEE'S EMPLOYEES OR GUESTS, CUSTOMER INJURIES, PROPERTY DAMAGE, AND REGULATORY VIOLATIONS, INCLUDING CLAIMS CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE LESSOR, EXCEPT CLAIMS CAUSED BY THE LESSOR'S GROSS NEGLIGENCE OR WILLFUL MISCONDUCT.`,
    `Legal basis: Texas express-negligence and fair-notice doctrine (Ethyl Corp. v. Daniel Construction Co.; Dresser Industries v. Page Petroleum).`],true);
  P("Attorney's Fees & Costs",[
    `If legal action is needed to enforce this Agreement, the prevailing party may recover reasonable attorney's fees, court costs, collection expenses, and investigation costs.`,
    `Legal basis: Tex. Civ. Prac. & Rem. Code §38.001.`]);
  P("Notices & Electronic Signatures",[
    `Notices may be given by hand delivery, text message, or email to the contact information above, or by certified mail. A demand for return may also be sent by certified mail, return receipt requested. Each party reports any change of contact information in writing within 3 days. This Agreement may be signed electronically and in counterparts; electronic signatures and copies have the same effect as originals.`,
    `Legal basis: Tex. Bus. & Com. Code §322.007 (UETA); Tex. Penal Code §31.04(c).`]);
  P("Governing Law, Venue & Entire Agreement",[
    `This Agreement is a true lease of goods governed by the laws of the State of Texas, including Chapter 2A of the Texas Business and Commerce Code. Venue for any dispute is in Williamson County, Texas. This Agreement${isRTO?", including the Move-In Condition Report and the Option to Purchase,":", including any Move-In Condition Report,"} is the entire agreement between the parties. Any change must be in writing and signed by all parties; no verbal agreement can change it. If any provision is unenforceable, the rest remains in full effect, and a failure to enforce is not a waiver.`,
    `Legal basis: Tex. Bus. & Com. Code §1.301, §1.203, §2A.201.`]);
  if(isRTO){
    P("Option to Purchase",[
      `IMPORTANT NOTICE: This Section gives Lessee an OPTION — a choice, not an obligation — to buy the trailer at the end of the lease term. Lessee is not required to buy. If Lessee does not buy, the monthly Purchase Credit below is NOT refundable.`,
      `25.1 This Agreement remains a rental; nothing here changes Lessee's rent obligations or Lessor's repossession rights. It adds one right: the option to purchase for a fixed price at the end of the term.`,
      `25.2 Total Purchase Price (fixed, will not increase): ${price?fmt$(price):"$ "+B} — the trailer's fair market value agreed by the parties, before credits.`,
      `25.3 Monthly payment division: Base Rent (non-refundable, pays for use) ${baseRent?fmt$(baseRent):"$ "+B}; Purchase Credit (applied toward the price ONLY if the purchase completes) ${credit?fmt$(credit):"$ "+B}; TOTAL MONTHLY PAYMENT ${rate?fmt$(rate):"$ "+B} (equals Monthly Rent). The Purchase Credit is earned only for months paid on time and in full; it is not a savings account, deposit, or refundable in cash.`,
      `25.4 Option Fee: ${t.optionFee?fmt$(t.optionFee)+" (non-refundable, credited toward the price only if the purchase completes)":"None"}.`,
      `25.5 At closing: Total Purchase Price, less any Option Fee credit, less Accumulated Purchase Credit (monthly credit × on-time months paid) = Remaining Balance Due, payable in full at closing unless otherwise agreed in writing.`,
      `25.6 To exercise, before the Option Expiration Date (${t.endDate||B}) Lessee must give written notice of intent to purchase, be current with no Default, and pay the full Remaining Balance in certified funds at closing. Otherwise the Option expires automatically and Lessor may sell to anyone.`,
      `25.7 All accumulated Purchase Credit and any Option Fee are forfeited to Lessor with NO refund if Lessee does not exercise the Option, Defaults/breaches/early-terminates, or the lease ends for any reason other than a completed purchase. Forfeited amounts are additional rent already earned, not a deposit or down payment.`,
      `25.8 No ownership, title, or equity passes to Lessee during the lease — not through payments and not through Purchase Credit. Title stays with Lessor until the Remaining Balance is paid at closing, a Bill of Sale is signed, and the certificate of title is assigned to Lessee. Until then this remains a rental in every respect, including Lessor's right to repossess. Lessee may return the trailer at the end of the term.`,
      `Legal basis: Tex. Bus. & Com. Code §1.203, §2A.504, §1.302; Tex. Transp. Code ch. 501.`],true);
  }
  P("Final Acknowledgment",[
    `By signing, each Lessee confirms they have read and agree to ALL Sections of this Agreement, including those not individually initialed, and had the opportunity to ask questions and consult an attorney before signing.`]);
  return S;
}

function LeaseContract({tenant,trailer,termType,onClose,onPrint,signed,onSign,templateMode}){
  const t={...tenant,
    _trailerName:trailer?.name,_trailerVin:trailer?.vin,_trailerYear:trailer?.year,_trailerLength:trailer?.length,
    replacementValue:tenant.replacementValue||trailer?.replacementValue||trailer?.purchasePrice,
    purchaseOptionPrice:tenant.purchaseOptionPrice||trailer?.purchasePrice,
    equipment:tenant.equipment||trailer?.equipment};
  const secs=leaseSections(t,termType);
  const docText=JSON.stringify({id:tenant.id,termType,secs:secs.map(s=>s.title),rate:tenant.monthlyRate,start:tenant.startDate});
  const docHash=hashStr(docText);
  const [consent1,setConsent1]=useState(false);
  const [consent2,setConsent2]=useState(false);
  const [sigName,setSigName]=useState(signed?.signedBy||tenant.name||"");
  const canSign=consent1&&consent2&&sigName.trim().length>2;
  const doSign=()=>{
    const audit={signedBy:sigName.trim(),signedAt:new Date().toISOString(),consentESIGN:true,readAll:true,docHash,userAgent:(navigator&&navigator.userAgent)||"",termType};
    onSign&&onSign(audit);
  };
  return(
    <div>
      <div className="no-print" style={{position:"sticky",top:0,zIndex:30,background:C.ink,borderBottom:`1px solid ${C.line}`,padding:"12px 14px",display:"flex",gap:10}}>
        <button onClick={onClose} style={{...s.btnOut,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.back} size={14}/> Back</button>
        <button onClick={onPrint} style={{...s.btnGold,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.download} size={14} color={C.ink}/> Print / PDF</button>
      </div>
      <div id="petition-print" style={{background:"#fff",color:"#000",padding:"38px 32px",fontFamily:"'Times New Roman',Georgia,serif",fontSize:12.5,lineHeight:1.55}}>
        <div style={{textAlign:"center",marginBottom:6}}>
          <img src={LOGO_URI} alt="Texan Food Trailers Solution" style={{width:210,maxWidth:"60%",height:"auto",margin:"0 auto"}}/>
        </div>
        <div style={{textAlign:"center",fontWeight:"bold",fontSize:15,marginTop:2}}>{(termType==="rent-to-own"||termType==="rto")?"FOOD TRAILER LEASE AGREEMENT WITH OPTION TO PURCHASE":`FOOD TRAILER ${termType==="weekly"?"WEEKLY":termType==="annual"?"ANNUAL":"MONTHLY"} RENTAL AGREEMENT`}</div>
        <div style={{textAlign:"center",fontSize:11,marginTop:3}}>Texan Food Trailers Solution · {LESSOR_ADDR} · {OWNER_PHONE} · {OWNER_EMAIL}</div>
        <hr style={{border:"none",borderTop:"1px solid #000",margin:"12px 0"}}/>
        {secs.map(sec=>(
          <div key={sec.n} style={{marginBottom:12}}>
            <div style={{fontWeight:"bold",marginBottom:3}}>{sec.n}. {sec.title}</div>
            {sec.paras.map((p,i)=><div key={i} style={{marginBottom:4}}>{p}</div>)}
            {sec.initials&&<div style={{fontSize:11,color:"#555",marginTop:3}}>Lessee initials: __________  Date: __________</div>}
          </div>
        ))}

        {/* Signature block */}
        <hr style={{border:"none",borderTop:"1px solid #000",margin:"14px 0"}}/>
        <div style={{fontWeight:"bold",marginBottom:6}}>Signature Page</div>
        {templateMode?(
          <div style={{fontSize:12.5,lineHeight:2.2}}>
            <div style={{display:"flex",gap:40,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:220}}>
                <div style={{fontWeight:"bold",marginBottom:10}}>LESSOR — {LESSOR_NAME}</div>
                <div>Signature: ________________________________</div>
                <div>Print Name: ______________________________</div>
                <div>Date: __________________</div>
              </div>
              <div style={{flex:1,minWidth:220}}>
                <div style={{fontWeight:"bold",marginBottom:10}}>LESSEE</div>
                <div>Signature: ________________________________</div>
                <div>Print Name: ______________________________</div>
                <div>Date: __________________</div>
              </div>
            </div>
            <div style={{marginTop:16,fontSize:10,color:"#777",fontStyle:"italic"}}>Blank template — print and fill by hand, or use as the basis for an auto-filled lease when a tenant is approved.</div>
          </div>
        ):signed?(
          <div>
            <div style={{marginBottom:6}}>Signed electronically by <strong>{signed.signedBy}</strong>.</div>
            <div style={{fontFamily:"'Brush Script MT',cursive",fontSize:26,borderBottom:"1px solid #000",display:"inline-block",padding:"0 20px 2px",marginBottom:8}}>{signed.signedBy}</div>
            <div style={{fontSize:10.5,color:"#333",marginTop:6,lineHeight:1.5,borderTop:"1px solid #ccc",paddingTop:8}}>
              <strong>Electronic Signature Audit (ESIGN Act / Texas UETA):</strong><br/>
              Signer: {signed.signedBy}<br/>
              Signed at: {signed.signedAt}<br/>
              Consent to electronic records: Yes · Agreed to all sections: Yes<br/>
              Document hash: {signed.docHash}<br/>
              Device: {(signed.userAgent||"").slice(0,120)}
            </div>
            <div style={{marginTop:14}}>LESSOR: {LESSOR_NAME} — authorized signature on file.</div>
          </div>
        ):(
          <div className="no-print">
            <div style={{fontSize:11.5,marginBottom:10,color:"#333"}}>Document reference hash: <strong>{docHash}</strong></div>
            <label style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8,fontSize:12.5}}>
              <input type="checkbox" checked={consent1} onChange={e=>setConsent1(e.target.checked)} style={{marginTop:3}}/>
              <span>I agree to sign this agreement electronically and to conduct this transaction by electronic records, as permitted by the ESIGN Act and the Texas Uniform Electronic Transactions Act.</span>
            </label>
            <label style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:12,fontSize:12.5}}>
              <input type="checkbox" checked={consent2} onChange={e=>setConsent2(e.target.checked)} style={{marginTop:3}}/>
              <span>I have read, understood, and agree to all sections of this Agreement.</span>
            </label>
            <div style={{marginBottom:4,fontSize:12}}>Type your full legal name to sign:</div>
            <input value={sigName} onChange={e=>setSigName(e.target.value)} placeholder="Full legal name"
              style={{width:"100%",padding:"10px 12px",border:"1px solid #000",borderRadius:4,fontSize:16,fontFamily:"'Brush Script MT',cursive",marginBottom:12}}/>
            <button onClick={doSign} disabled={!canSign}
              style={{width:"100%",padding:"13px",borderRadius:5,border:"none",cursor:canSign?"pointer":"not-allowed",background:canSign?"#4a7c59":"#999",color:"#fff",fontWeight:700,fontSize:14}}>
              Sign Agreement Electronically
            </button>
          </div>
        )}
        <div style={{marginTop:18,fontSize:9.5,color:"#777",fontStyle:"italic",borderTop:"1px solid #ddd",paddingTop:6}}>
          Prepared by {LESSOR_NAME}. Based on the business's lease template; have an attorney review before use.
        </div>
      </div>
    </div>
  );
}

function ApplicationForm({db,updateDB,onClose,preTrailerId}){
  const avail=(db.trailers||[]).filter(t=>t.status==="available"||t.status==="rent-to-own"||t.id===preTrailerId);
  const [f,setF]=useState({name:"",phone:"",email:"",address:"",dl:"",dob:"",ssn4:"",trailerId:preTrailerId||"",termType:"monthly",businessType:"",note:""});
  const [idPhoto,setIdPhoto]=useState(null);
  const [busyId,setBusyId]=useState(false);
  const idRef=useRef();
  const [sent,setSent]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const pickId=async(e)=>{
    const file=(e.target.files||[])[0]; if(!file) return;
    setBusyId(true);
    try{ setIdPhoto(await compressImage(file,1200,0.8)); }catch(_){ }
    setBusyId(false);
  };
  const submit=async()=>{
    if(!f.name||!f.phone||!f.email){ alert("Please fill your name, phone, and email."); return; }
    const appId="APP"+uid();
    const app={id:appId,...f,status:"pending",date:today(),hasIdPhoto:!!idPhoto};
    if(idPhoto){ try{ await saveFileChunked(`app_id_photo:${appId}`, idPhoto); }catch(_){ } }
    const trName=f.trailerId?((db.trailers.find(x=>x.id===f.trailerId)||{}).nickname||(db.trailers.find(x=>x.id===f.trailerId)||{}).name||""):"";
    updateDB(d=>{ d.applications=[...(d.applications||[]),app]; addNotification(d,{forRole:"admin",title:"New Rental Application",body:`${f.name} applied${trName?` for ${trName}`:""}. ${f.phone} · ${f.email}.${idPhoto?" ID photo attached.":""} Review in Tenants → Applications.`}); return d; });
    // email the owner directly too
    sendEmail(OWNER_EMAIL,"Texan Food Trailers",`New Application — ${f.name}`,`New rental application received.\n\nName: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\nTrailer: ${trName||"No preference"}\nTerm: ${(f.termType||"monthly").charAt(0).toUpperCase()+(f.termType||"monthly").slice(1)}\nFood: ${f.businessType||"-"}${idPhoto?"\nID photo: attached":""}\nNote: ${f.note||"-"}\n\nReview and approve in your admin panel.`);
    setSent(true);
  };
  const L={fontSize:11,color:C.chromeDim,marginBottom:4,display:"block",...s.mono,letterSpacing:"0.04em",textTransform:"uppercase"};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.steel,borderTop:`2px solid ${C.gold}`,borderRadius:"14px 14px 0 0",padding:"22px 20px 34px",width:"100%",maxWidth:480,boxSizing:"border-box",maxHeight:"92vh",overflowY:"auto"}}>
        {sent?(
          <div style={{textAlign:"center",padding:"20px 10px"}}>
            <div style={{width:54,height:54,borderRadius:99,background:C.goodBg,border:`1px solid ${C.good}44`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Icon d={ICONS.check} size={26} color={C.good}/></div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:600,color:C.paper}}>Application Sent!</div>
            <div style={{fontSize:13,color:C.chromeDim,marginTop:8,lineHeight:1.5}}>Thank you. We'll review your application and get back to you by email. Once approved, your lease will be ready to sign.</div>
            <button onClick={onClose} style={{...s.btnGold,marginTop:20}}>Done</button>
          </div>
        ):(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:17,fontWeight:600,color:C.paper}}>Apply to Rent</div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon d={ICONS.close} size={18} color={C.chromeDim}/></button>
          </div>
          <div style={{fontSize:12,color:C.chromeDim,marginBottom:16,lineHeight:1.5}}>Fill in your details and send your request. We'll review and, once approved, send your welcome email and lease to sign.</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={L}>Full legal name *</label><input style={s.input} value={f.name} onChange={e=>set("name",e.target.value)}/></div>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}><label style={L}>Phone *</label><input style={s.input} value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
              <div style={{flex:1}}><label style={L}>Email *</label><input style={s.input} value={f.email} onChange={e=>set("email",e.target.value)}/></div>
            </div>
            <div><label style={L}>Home address</label><input style={s.input} value={f.address} onChange={e=>set("address",e.target.value)}/></div>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}><label style={L}>Driver's License / ID #</label><input style={s.input} value={f.dl} onChange={e=>set("dl",e.target.value)}/></div>
              <div style={{flex:1}}><label style={L}>Date of birth</label><input style={s.input} type="date" value={f.dob} onChange={e=>set("dob",e.target.value)}/></div>
            </div>
            <div><label style={L}>Last 4 of SSN (becomes your portal password)</label>
              <input style={s.input} value={f.ssn4} inputMode="numeric" maxLength={4} placeholder="1234" onChange={e=>set("ssn4",e.target.value.replace(/\D/g,"").slice(0,4))}/></div>
            <div>
              <label style={L}>Photo of your ID (front)</label>
              <input ref={idRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={pickId}/>
              <button type="button" onClick={()=>idRef.current?.click()} disabled={busyId}
                style={{...s.input,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",color:idPhoto?C.good:C.chromeDim}}>
                <Icon d={ICONS.img} size={15} color={idPhoto?C.good:C.gold}/>
                {busyId?"Processing…":idPhoto?"ID photo added ✓ — tap to retake":"Take / upload a photo of your ID"}
              </button>
              {idPhoto&&<img src={idPhoto} alt="ID" style={{width:"100%",maxHeight:150,objectFit:"contain",borderRadius:6,border:`1px solid ${C.line}`,marginTop:8}}/>}
            </div>
            <div><label style={L}>Trailer you want</label>
              <select style={s.input} value={f.trailerId} onChange={e=>set("trailerId",e.target.value)}>
                <option value="">— No preference —</option>
                {avail.map(tr=><option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </div>
            <div><label style={L}>Rental term</label>
              <select style={s.input} value={f.termType} onChange={e=>set("termType",e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div><label style={L}>What food will you serve?</label><input style={s.input} value={f.businessType} onChange={e=>set("businessType",e.target.value)} placeholder="e.g. BBQ, tacos, coffee"/></div>
            <div><label style={L}>Anything else?</label><textarea style={{...s.input,minHeight:60,resize:"vertical"}} value={f.note} onChange={e=>set("note",e.target.value)}/></div>
            <button onClick={submit} style={s.btnGold}>Submit Application</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  LEGAL — Small Claims petition builder (admin)               */
/*  NOT legal advice. Produces a review-ready DRAFT petition     */
/*  modeled on the Texas Justice Court small-claims petition.    */
/* ═══════════════════════════════════════════════════════════ */
const BREACH_TYPES=[
  {id:"late-rent",      label:"Late / delinquent rent",        clause:"Defendant failed to pay rent when due under the lease agreement."},
  {id:"default",        label:"Default — non-payment of rent", clause:"Defendant defaulted on the lease by failing to pay the agreed rent."},
  {id:"unpaid-balance", label:"Unpaid outstanding balance",    clause:"Defendant owes an outstanding unpaid balance under the lease agreement."},
  {id:"property-damage",label:"Damage to the trailer",         clause:"Defendant caused damage to the leased food trailer beyond normal wear and tear."},
  {id:"unauthorized",   label:"Unauthorized use / subletting", clause:"Defendant used or sublet the leased trailer in violation of the lease terms."},
  {id:"holdover",       label:"Failure to return / holdover",  clause:"Defendant failed to return the leased trailer and remained in possession after the lease ended."},
  {id:"early-term",     label:"Early termination of lease",    clause:"Defendant terminated the lease early in breach of the agreement, leaving amounts owing."},
  {id:"other",          label:"Other (write your own)",        clause:""},
];

function LegalCaseManager({tenantId,db,updateDB,onBack}){
  const tenant=(db.tenants||[]).find(t=>t.id===tenantId)||{};
  const trailer=(db.trailers||[]).find(t=>t.id===tenant.trailerId)||{};
  const breaches=tenant.breaches||[];
  const [docMode,setDocMode]=useState(null); // null | "petition" | "demand"
  const [bt,setBt]=useState(BREACH_TYPES[0].id);
  const [amount,setAmount]=useState("");
  const [bdate,setBdate]=useState(today());
  const [note,setNote]=useState("");
  const [plaintiff,setPlaintiff]=useState(tenant.lessor||"SBK LLC (Abu Arab Trailer Solution)");
  const [plaintiffAddr,setPlaintiffAddr]=useState(tenant.lessorAddr||"761 Wiltshire Dr");
  const [county,setCounty]=useState(tenant.county||"Williamson");
  const [precinct,setPrecinct]=useState(tenant.precinct||"");

  const addBreach=()=>{
    const typeObj=BREACH_TYPES.find(x=>x.id===bt)||BREACH_TYPES[0];
    const b={id:"B"+uid(),type:bt,label:typeObj.label,clause:typeObj.clause,amount:Number(amount||0),date:bdate,note:note.trim()};
    updateDB(d=>{
      const t=d.tenants.find(x=>x.id===tenantId);
      if(t) t.breaches=[...(t.breaches||[]),b];
      return d;
    });
    setAmount("");setNote("");
  };
  const removeBreach=(id)=>updateDB(d=>{const t=d.tenants.find(x=>x.id===tenantId); if(t) t.breaches=(t.breaches||[]).filter(b=>b.id!==id); return d;});
  const saveHeader=()=>updateDB(d=>{const t=d.tenants.find(x=>x.id===tenantId); if(t){t.lessor=plaintiff;t.lessorAddr=plaintiffAddr;t.county=county;t.precinct=precinct;} return d;});

  const total=breaches.reduce((a,b)=>a+(Number(b.amount)||0),0);

  const doPrint=()=>{
    document.body.classList.add("printing-petition");
    const cleanup=()=>{ document.body.classList.remove("printing-petition"); window.removeEventListener("afterprint",cleanup); };
    window.addEventListener("afterprint",cleanup);
    window.print();
    setTimeout(cleanup,1200);
  };

  if(docMode==="petition") return(
    <SmallClaimsPetition
      tenant={tenant} trailer={trailer} breaches={breaches} total={total}
      plaintiff={plaintiff} plaintiffAddr={plaintiffAddr} county={county} precinct={precinct}
      onClose={()=>setDocMode(null)} onPrint={doPrint}/>
  );
  if(docMode==="demand") return(
    <DemandLetter
      tenant={tenant} trailer={trailer} breaches={breaches} total={total}
      plaintiff={plaintiff} plaintiffAddr={plaintiffAddr}
      onClose={()=>setDocMode(null)} onPrint={doPrint}/>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}} className="fadein">
      <button onClick={onBack} style={{...s.btnOut,display:"flex",alignItems:"center",gap:6,width:"auto",padding:"8px 12px"}}>
        <Icon d={ICONS.back} size={14}/> Back
      </button>
      <div>
        <div style={{...s.heading,fontSize:18,fontWeight:700}}>Legal / Small Claims</div>
        <div style={{fontSize:12,color:C.chromeDim,marginTop:3}}>{tenant.name} · {trailer.name||"No trailer assigned"}</div>
      </div>

      <div style={{background:C.warnBg,border:`1px solid ${C.warn}44`,borderRadius:8,padding:"11px 13px",fontSize:11.5,color:C.paperDim,lineHeight:1.5}}>
        This builds a <strong style={{color:C.paper}}>draft</strong> small-claims petition from this tenant's contract data. It is not legal advice — review it, and confirm your Justice Court's required form before filing.
      </div>

      <div style={{background:C.steel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 15px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...s.mono,fontSize:10,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase"}}>Court & Plaintiff</div>
        <div><label style={s.label}>Plaintiff (landlord, as on the lease)</label><input style={s.input} value={plaintiff} onChange={e=>setPlaintiff(e.target.value)}/></div>
        <div><label style={s.label}>Plaintiff address</label><input style={s.input} value={plaintiffAddr} onChange={e=>setPlaintiffAddr(e.target.value)}/></div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:2}}><label style={s.label}>County</label><input style={s.input} value={county} onChange={e=>setCounty(e.target.value)}/></div>
          <div style={{flex:1}}><label style={s.label}>Precinct #</label><input style={s.input} value={precinct} onChange={e=>setPrecinct(e.target.value)} placeholder="e.g. 3"/></div>
        </div>
        <button onClick={saveHeader} style={{...s.btnOut,fontSize:11,padding:"8px"}}>Save to tenant</button>
      </div>

      <div style={{background:C.steel,border:`1px solid ${C.line}`,borderRadius:8,padding:"14px 15px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...s.mono,fontSize:10,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase"}}>Log a Breach</div>
        <div><label style={s.label}>What was violated?</label>
          <select style={s.input} value={bt} onChange={e=>setBt(e.target.value)}>
            {BREACH_TYPES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><label style={s.label}>Amount claimed ($)</label><input style={s.input} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={String(tenant.monthlyRate||"")}/></div>
          <div style={{flex:1}}><label style={s.label}>Date</label><input style={s.input} type="date" value={bdate} onChange={e=>setBdate(e.target.value)}/></div>
        </div>
        <div><label style={s.label}>Details {bt==="other"?"(required)":"(optional)"}</label><textarea style={{...s.input,minHeight:60,resize:"vertical"}} value={note} onChange={e=>setNote(e.target.value)} placeholder="What happened — e.g. 'August and September rent unpaid, $3,000 owed.'"/></div>
        <button onClick={addBreach} style={s.btnGold} disabled={bt==="other"&&!note.trim()}>+ Add to Case</button>
      </div>

      {breaches.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{...s.mono,fontSize:10,color:C.chromeDim,letterSpacing:"0.1em",textTransform:"uppercase"}}>Case Items ({breaches.length})</div>
          {breaches.map(b=>(
            <div key={b.id} style={{background:C.ink2,border:`1px solid ${C.line}`,borderRadius:7,padding:"11px 13px",display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:C.paper,fontWeight:600}}>{b.label}</div>
                {b.note&&<div style={{fontSize:12,color:C.chromeDim,marginTop:2}}>{b.note}</div>}
                <div style={{...s.mono,fontSize:10,color:C.chromeDim,marginTop:4}}>{b.date}{b.amount?` · ${fmt$(b.amount)}`:""}</div>
              </div>
              <button onClick={()=>removeBreach(b.id)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon d={ICONS.trash} size={15} color={C.danger}/></button>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"4px 2px"}}>
            <span style={{fontSize:12,color:C.paper,fontWeight:600}}>Total claimed</span>
            <span style={{...s.mono,fontSize:18,color:C.gold,fontWeight:600}}>{fmt$(total)}</span>
          </div>
          <button onClick={()=>setDocMode("demand")} style={{...s.btnOut,marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:C.warn,borderColor:C.warn+"55"}}>
            <Icon d={ICONS.book} size={15} color={C.warn}/> Generate Demand Letter (send first)
          </button>
          <button onClick={()=>setDocMode("petition")} style={{...s.btnGold,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <Icon d={ICONS.contract} size={15} color={C.ink}/> Generate Court Petition
          </button>
        </div>
      )}
      {breaches.length===0&&<div style={{fontSize:12,color:C.chromeDim,textAlign:"center",padding:"8px"}}>No breaches logged yet. Add one above when the tenant violates the lease.</div>}
    </div>
  );
}

// Light parse of a stored address like "1905 Golden Arrow Ave, Cedar Park, TX 78613"
function splitAddress(addr){
  if(!addr) return {street:"",city:"",state:"",zip:""};
  const parts=addr.split(",").map(x=>x.trim());
  const street=parts[0]||"";
  const city=parts.length>=3?parts[1]:"";
  const last=parts[parts.length-1]||"";
  const m=last.match(/([A-Za-z]{2})\s*(\d{5})?/);
  return {street,city,state:m?m[1]:"",zip:m&&m[2]?m[2]:""};
}

function SmallClaimsPetition({tenant,trailer,breaches,total,plaintiff,plaintiffAddr,county,precinct,onClose,onPrint}){
  const line=(w)=>({borderBottom:"1px solid #000",display:"inline-block",minWidth:w||120});
  const addr=splitAddress(tenant.address);
  const defName=[tenant.name,tenant.secondLessee].filter(Boolean).join(" and ");
  const sec={marginTop:16};
  const hd={fontWeight:"bold",textDecoration:"underline",marginBottom:4};
  const instr={fontSize:11,fontStyle:"italic",color:"#333",margin:"2px 0 6px"};
  // Auto-composed Cause of Action paragraph
  const leaseSentence=`On or about ${tenant.startDate||"____"}, Plaintiff and Defendant entered into a written lease agreement under which Plaintiff leased to Defendant the food trailer${trailer.name?` "${trailer.name}"`:""}${trailer.vin?` (VIN ${trailer.vin})`:""}${tenant.monthlyRate?`, at a monthly rent of ${fmt$(tenant.monthlyRate)}`:""}${tenant.endDate?`, with a lease term through ${tenant.endDate}`:""}${tenant.securityDeposit?`, and a security deposit of ${fmt$(tenant.securityDeposit)}`:""}.`;

  return(
    <div>
      <div className="no-print" style={{position:"sticky",top:0,zIndex:30,background:C.ink,borderBottom:`1px solid ${C.line}`,padding:"12px 14px",display:"flex",gap:10}}>
        <button onClick={onClose} style={{...s.btnOut,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.back} size={14}/> Back</button>
        <button onClick={onPrint} style={{...s.btnGold,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.download} size={14} color={C.ink}/> Print / Save PDF</button>
      </div>
      <div id="petition-print" style={{background:"#fff",color:"#000",padding:"40px 34px",fontFamily:"'Times New Roman',Georgia,serif",fontSize:13,lineHeight:1.5}}>
        {/* Caption — official Texas Justice Court Small Claims Petition (Rule 502.2) layout */}
        <div style={{textAlign:"center",fontWeight:"bold",fontSize:15}}>SMALL CLAIMS PETITION</div>
        <div style={{textAlign:"center",fontSize:12,margin:"6px 0 2px"}}>NO. <span style={line(140)}>&nbsp;</span></div>
        <div style={{textAlign:"center",fontSize:12}}>In the Justice Court of {county||"____________"} County, Texas</div>
        <div style={{textAlign:"center",fontSize:12,marginTop:2}}>Precinct {precinct||"____"}, Place <span style={line(40)}>&nbsp;</span></div>

        <table style={{width:"100%",fontSize:13,borderCollapse:"collapse",margin:"14px 0"}}>
          <tbody>
            <tr>
              <td style={{width:"60%",verticalAlign:"top"}}>
                <div>{plaintiff}</div>
                <div style={{fontSize:11,fontStyle:"italic",color:"#333"}}>Plaintiff(s)</div>
                <div style={{margin:"8px 0"}}>vs.</div>
                <div>{defName||"____________"}</div>
                <div style={{fontSize:11,fontStyle:"italic",color:"#333"}}>Defendant(s)</div>
              </td>
              <td style={{width:"40%",verticalAlign:"top",fontSize:16,textAlign:"left",paddingLeft:8}}>
                §<br/>§<br/>§<br/>§<br/>§
              </td>
            </tr>
          </tbody>
        </table>

        {/* Plaintiff */}
        <div style={sec}>
          <div style={hd}>Plaintiff</div>
          <div>{plaintiff}</div>
          <div style={instr}>Describe the legal nature of the plaintiff (e.g., individual, sole proprietorship, partnership, corporation): limited liability company (LLC).</div>
          <div>Address: {plaintiffAddr}</div>
          <div>Telephone: {OWNER_PHONE} &nbsp; E-Mail: {OWNER_EMAIL}</div>
        </div>

        {/* Defendant */}
        <div style={sec}>
          <div style={hd}>Defendant</div>
          <div>{defName||"____________"}</div>
          <div>Address: {addr.street||<span style={line(220)}>&nbsp;</span>}</div>
          <div style={{marginTop:2}}>
            City: {addr.city||<span style={line(100)}>&nbsp;</span>} &nbsp;
            State: {addr.state||<span style={line(40)}>&nbsp;</span>} &nbsp;
            Zip: {addr.zip||<span style={line(60)}>&nbsp;</span>} &nbsp;
            Date of Birth (if applicable): <span style={line(90)}>&nbsp;</span>
          </div>
          <div style={instr}>Describe the legal nature of the defendant (e.g., individual, sole proprietorship, partnership, corporation): individual.</div>
        </div>

        {/* Service of Process */}
        <div style={sec}>
          <div style={hd}>Service of Process</div>
          <div>Defendant may be served by serving <strong>{defName||"____________"}</strong>, who may be served at {tenant.address||<span style={line(260)}>&nbsp;</span>}.</div>
          <div style={{marginTop:6}}>The defendant's usual place of business or residence, or other place where defendant can probably be found is: {tenant.address||<span style={line(300)}>&nbsp;</span>}.</div>
        </div>

        {/* Cause of Action */}
        <div style={sec}>
          <div style={hd}>Cause of Action</div>
          <div style={instr}>State the cause of action in plain and concise language sufficient to give fair notice of the claim.</div>
          <div style={{marginBottom:8}}>{leaseSentence}</div>
          <div style={{marginBottom:4}}>Defendant breached the lease agreement as follows:</div>
          <ol style={{margin:"0 0 8px 20px",padding:0}}>
            {breaches.map(b=>(
              <li key={b.id} style={{marginBottom:6}}>
                {b.clause||b.label}{b.note?` ${b.note}`:""}{b.date?` (on or about ${b.date})`:""}{b.amount?` Amount owed: ${fmt$(b.amount)}.`:"."}
              </li>
            ))}
          </ol>
          <div>As a result of Defendant's breach, Plaintiff has been damaged in the total amount of <strong>{fmt$(total)}</strong>.</div>
        </div>

        {/* Relief Requested */}
        <div style={sec}>
          <div style={hd}>Relief Requested</div>
          <div style={instr}>Describe the relief you are requesting, itemizing the amount of damages you are seeking.</div>
          <div>Plaintiff requests judgment against Defendant for:</div>
          <ul style={{margin:"4px 0 0 20px",padding:0}}>
            <li>Actual damages of <strong>{fmt$(total)}</strong>;</li>
            <li>Court costs;</li>
            <li>Pre- and post-judgment interest as allowed by law; and</li>
            <li>All other relief to which Plaintiff is entitled.</li>
          </ul>
        </div>

        {/* Signature block */}
        <div style={{marginTop:24}}>
          <div>Respectfully submitted,</div>
          <div style={{marginTop:22}}><span style={line(260)}>&nbsp;</span></div>
          <div style={{fontSize:11,color:"#333"}}>Signature of Plaintiff or Plaintiff's Attorney of Record</div>
          <div style={{marginTop:10}}>Printed Name: {plaintiff}</div>
          <div>State Bar No. (if attorney): <span style={line(140)}>&nbsp;</span></div>
          <div>Address: {plaintiffAddr}</div>
          <div>Telephone: {OWNER_PHONE} &nbsp; Fax: <span style={line(120)}>&nbsp;</span></div>
          <div>E-Mail Address: {OWNER_EMAIL}</div>
        </div>

        <div style={{marginTop:14,fontSize:12}}>
          Plaintiff consents to the e-mail service of the answer and any other motions or pleadings to this e-mail address.
        </div>

        <div style={{marginTop:24,fontSize:10,color:"#555",fontStyle:"italic",borderTop:"1px solid #ccc",paddingTop:8}}>
          Draft prepared from tenant records on {today()}, following the Texas Justice Court Small Claims Petition (TRCP Rule 502.2) format. This is not legal advice. Confirm the current official form and any local requirements (e.g., a Civil Case Information Sheet) with the {county||"____"} County Justice Court, Precinct {precinct||"__"}, before filing.
        </div>
      </div>
    </div>
  );
}

function DemandLetter({tenant,trailer,breaches,total,plaintiff,plaintiffAddr,onClose,onPrint}){
  const line=(w)=>({borderBottom:"1px solid #000",display:"inline-block",minWidth:w||120});
  const defName=[tenant.name,tenant.secondLessee].filter(Boolean).join(" and ");
  const todayStr=fmtDateObj(new Date());
  const cureDate=fmtDateObj(new Date(Date.now()+CURE_DAYS*86400000));
  // Subject adapts to the breach(es) logged
  const hasRent=breaches.some(b=>["late-rent","default","unpaid-balance","early-term"].includes(b.type));
  const subject=hasRent?"NOTICE OF DEFAULT AND DEMAND FOR PAYMENT":"NOTICE OF LEASE VIOLATION AND DEMAND TO CURE";
  return(
    <div>
      <div className="no-print" style={{position:"sticky",top:0,zIndex:30,background:C.ink,borderBottom:`1px solid ${C.line}`,padding:"12px 14px",display:"flex",gap:10}}>
        <button onClick={onClose} style={{...s.btnOut,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.back} size={14}/> Back</button>
        <button onClick={onPrint} style={{...s.btnGold,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon d={ICONS.download} size={14} color={C.ink}/> Print / Save PDF</button>
      </div>
      <div id="petition-print" style={{background:"#fff",color:"#000",padding:"42px 36px",fontFamily:"'Times New Roman',Georgia,serif",fontSize:13,lineHeight:1.6}}>
        <div style={{fontWeight:"bold",fontSize:14}}>{plaintiff}</div>
        <div>{plaintiffAddr}</div>
        <div>Phone: {OWNER_PHONE} · Email: {OWNER_EMAIL}</div>
        <div style={{marginTop:18}}>{todayStr}</div>

        <div style={{marginTop:18}}>
          <div>{defName||"____________"}</div>
          {tenant.address&&<div>{tenant.address}</div>}
        </div>

        <div style={{marginTop:18,fontWeight:"bold",textAlign:"center",textDecoration:"underline"}}>{subject}</div>
        <div style={{marginTop:6}}><strong>Sent via:</strong> Email{tenant.email?` (${tenant.email})`:""} and/or U.S. Mail</div>
        <div><strong>RE:</strong> Lease of food trailer{trailer.name?` "${trailer.name}"`:""}{trailer.vin?` (VIN ${trailer.vin})`:""}{tenant.startDate?`, dated ${tenant.startDate}`:""}</div>

        <div style={{marginTop:16}}>Dear {tenant.name||"Tenant"},</div>

        <div style={{marginTop:10}}>
          This letter is formal notice that you are in breach of the lease agreement between you and {plaintiff}
          {tenant.startDate?`, entered into on or about ${tenant.startDate}`:""}
          {tenant.monthlyRate?`, under which rent of ${fmt$(tenant.monthlyRate)} per month is due`:""}. The following violation(s) of the lease have occurred:
        </div>

        <ol style={{margin:"10px 0 10px 22px",padding:0}}>
          {breaches.map(b=>(
            <li key={b.id} style={{marginBottom:6}}>
              {b.clause||b.label}{b.note?` ${b.note}`:""}{b.date?` (on or about ${b.date})`:""}{b.amount?` Amount due: ${fmt$(b.amount)}.`:"."}
            </li>
          ))}
        </ol>

        {total>0&&(
          <div style={{marginBottom:10}}>
            The total amount currently due and owing is <strong>{fmt$(total)}</strong>.
          </div>
        )}

        <div style={{marginBottom:10}}>
          <strong>DEMAND:</strong> You are hereby required to cure the above violation(s)
          {total>0?` and pay the full amount of ${fmt$(total)}`:""} on or before <strong>{cureDate}</strong> ({CURE_DAYS} days from the date of this notice).
        </div>

        <div style={{marginBottom:10}}>
          If you fail to cure the violation(s) within this period, {plaintiff} will pursue all remedies available under the lease and Texas law,
          which may include termination of the lease, recovery of the leased trailer, and the filing of a claim in the Justice Court for the amounts owed,
          together with court costs and interest. This notice is sent in an effort to resolve this matter without the need for legal action.
        </div>

        <div style={{marginBottom:10}}>
          Please contact us immediately at {OWNER_PHONE} to arrange payment or to discuss this matter.
        </div>

        <div style={{marginTop:22}}>Sincerely,</div>
        <div style={{marginTop:26}}><span style={line(240)}>&nbsp;</span></div>
        <div>{plaintiff}</div>

        <div style={{marginTop:24,fontSize:10,color:"#555",fontStyle:"italic",borderTop:"1px solid #ccc",paddingTop:8}}>
          Draft prepared from tenant records on {today()}. This is a demand/notice letter, not a court filing and not legal advice. Keep a copy and proof of delivery. For a disputed or complex matter, consult an attorney.
        </div>
      </div>
    </div>
  );
}

/* ── Admin Forms — blank contract templates in one place ──── */
const TERM_TEMPLATES=[
  ["weekly","Weekly Rental Agreement"],
  ["monthly","Monthly Rental Agreement"],
  ["annual","Annual (12-Month) Rental Agreement"],
  ["rent-to-own","Rent-to-Own Agreement"],
];
function AdminForms({lang}){
  const [open,setOpen]=useState(null); // termType being viewed
  const [autoPrint,setAutoPrint]=useState(false);
  const blankTenant={id:"TEMPLATE",name:"",address:"",dl:"",dob:"",startDate:"",endDate:"",monthlyRate:"",securityDeposit:"",lateFee:"",purchasePrice:""};
  const blankTrailer={name:"",vin:"",year:""};
  const doPrint=()=>{
    document.body.classList.add("printing-petition");
    const cleanup=()=>{ document.body.classList.remove("printing-petition"); window.removeEventListener("afterprint",cleanup); };
    window.addEventListener("afterprint",cleanup);
    window.print();
    setTimeout(cleanup,1200);
  };
  useEffect(()=>{ if(open&&autoPrint){ const tm=setTimeout(()=>{ doPrint(); setAutoPrint(false); },500); return ()=>clearTimeout(tm); } },[open,autoPrint]);
  if(open){
    return <LeaseContract tenant={blankTenant} trailer={blankTrailer} termType={open} templateMode onClose={()=>setOpen(null)} onPrint={doPrint}/>;
  }
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <div style={{...s.heading,fontSize:20,fontWeight:700}}>Forms</div>
      <div style={{fontSize:12.5,color:C.chromeDim,lineHeight:1.5}}>
        Blank contract templates, all in one place. Open any one to read it, or tap <strong style={{color:C.gold}}>Download</strong> to save it as a PDF.
        These are the same agreements that get auto-filled with the tenant's details when you approve an application.
      </div>
      {TERM_TEMPLATES.map(([tt,label])=>(
        <div key={tt} style={{...s.card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"14px 16px"}}>
          <button onClick={()=>{setAutoPrint(false);setOpen(tt);}}
            style={{display:"flex",alignItems:"center",gap:12,background:"none",border:"none",cursor:"pointer",textAlign:"left",flex:1,padding:0,color:C.paper}}>
            <Icon d={ICONS.contract} size={18} color={C.gold}/>
            <div>
              <div style={{fontWeight:600,fontSize:14,color:C.paper}}>{label}</div>
              <div style={{fontSize:11,color:C.chromeDim,...s.mono}}>Blank · with logo · ready to download as PDF</div>
            </div>
          </button>
          <button onClick={()=>{setAutoPrint(true);setOpen(tt);}} title="Download PDF"
            style={{...s.btnGold,width:"auto",padding:"8px 12px",display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <Icon d={ICONS.download} size={14} color={C.ink}/> Download
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Admin Fleet ─────────────────────────────────────────── */

function AdminFleet({db,updateDB,lang}){
  const [filter,setFilter]=useState("all");
  const [adding,setAdding]=useState(false);
  const EMPTY_FORM={name:"",nickname:"",color:"",info:"",length:"",power:"",kitchen:"",fridge:"",dailyRate:"",monthlyRate:"",purchasePrice:"",replacementValue:"",securityDeposit:"",equipment:"",vin:"",year:"",photos:[],photoNames:[]};
  const [form,setForm]=useState(EMPTY_FORM);
  const [busyPhoto,setBusyPhoto]=useState("");

  const photoRef=useRef();
  const addTrailer=async()=>{
    if(!form.name)return;
    const id="T"+uid();
    // save photos externally with indexes
    for(let i=0;i<(form.photos||[]).length;i++){ await saveFileChunked("trailer_photo:"+id+":"+i, form.photos[i]); }
    if(form.photos.length) photoCache[id]={key:id+":"+form.photos.length+":"+form.photoNames.join("|"),photos:form.photos};
    const t={id,name:form.name,nickname:form.nickname||autoNickname(form.length,form.color),color:form.color,info:form.info,length:form.length,power:form.power,kitchen:form.kitchen,fridge:form.fridge,
      dailyRate:Number(form.dailyRate)||0,monthlyRate:Number(form.monthlyRate)||0,purchasePrice:Number(form.purchasePrice)||0,
      replacementValue:Number(form.replacementValue)||0,securityDeposit:Number(form.securityDeposit)||0,equipment:form.equipment||"",vin:form.vin||"",year:form.year||"",
      status:"rent-sale",views:0,photoCount:form.photos.length,photoNames:form.photoNames,photos:form.photos};
    updateDB(db=>{db.trailers=[...db.trailers,t];return db;});
    setAdding(false);setForm(EMPTY_FORM);
  };

  // multi-file picker for the ADD form (holds photos in memory until saved)
  const pickPhotos=async(e)=>{
    const files=Array.from(e.target.files||[]); if(!files.length) return;
    setBusyPhoto("form");
    const uris=[], names=[];
    for(const f of files){ uris.push(await compressImage(f)); names.push(f.name); }
    setForm(f=>({...f,photos:[...f.photos,...uris],photoNames:[...f.photoNames,...names]}));
    setBusyPhoto("");
  };
  const removeFormPhoto=(i)=>setForm(f=>({...f,photos:f.photos.filter((_,x)=>x!==i),photoNames:f.photoNames.filter((_,x)=>x!==i)}));

  // add photos to an EXISTING trailer
  const addTrailerPhotos=async(id,fileList)=>{
    const files=Array.from(fileList||[]); if(!files.length) return;
    setBusyPhoto(id);
    const t=db.trailers.find(x=>x.id===id); const start=t?.photoCount||0;
    const newUris=[], newNames=[];
    for(let k=0;k<files.length;k++){ const c=await compressImage(files[k]); await saveFileChunked("trailer_photo:"+id+":"+(start+k),c); newUris.push(c); newNames.push(files[k].name); }
    updateDB(db=>{const t=db.trailers.find(x=>x.id===id); if(t){ t.photos=[...(t.photos||[]),...newUris]; t.photo=t.photos[0]; t.photoCount=t.photos.length; t.photoNames=[...(t.photoNames||[]),...newNames]; } return db;});
    const cur=photoCache[id]?.photos||[]; const photos=[...cur,...newUris]; photoCache[id]={key:id+":"+photos.length+":"+((t?.photoNames||[]).concat(newNames).join("|")),photos};
    setBusyPhoto("");
  };
  const removeTrailerPhoto=async(id,index)=>{
    const t=db.trailers.find(x=>x.id===id); if(!t) return;
    const photos=[...(t.photos||[])]; photos.splice(index,1);
    const names=[...(t.photoNames||[])]; names.splice(index,1);
    for(let i=0;i<photos.length;i++){ await saveFileChunked("trailer_photo:"+id+":"+i, photos[i]); }
    updateDB(db=>{const t=db.trailers.find(x=>x.id===id); if(t){ t.photos=photos; t.photo=photos[0]||null; t.photoCount=photos.length; t.photoNames=names; } return db;});
    photoCache[id]={key:id+":"+photos.length+":"+names.join("|"),photos};
  };

  const setStatus=(id,status)=>updateDB(db=>{const t=db.trailers.find(x=>x.id===id);if(t)t.status=status;return db;});

  const [confirmDelete,setConfirmDelete]=useState(null);
  const deleteTrailer=(id)=>{
    updateDB(db=>{
      db.trailers=db.trailers.filter(t=>t.id!==id);
      return db;
    });
    setConfirmDelete(null);
  };

  const STATUS_OPTIONS=[
    ["rent","Available for rent only",C.good],
    ["sale","Available for sale only",C.blue],
    ["rent-sale","Available for rent or sale",C.gold],
    ["rented","Not Available",C.chromeDim],
    ["sold","Sold",C.danger],
  ];
  const statusMeta=(st)=>STATUS_OPTIONS.find(([v])=>v===st)||STATUS_OPTIONS[0];

  const filtered=filter==="all"?db.trailers:db.trailers.filter(t=>t.status===filter);
  const counts={all:db.trailers.length};
  STATUS_OPTIONS.forEach(([v])=>{counts[v]=db.trailers.filter(t=>t.status===v).length;});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}} className="fadein">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{...s.heading,fontSize:20,fontWeight:700}}>{t("fleet",lang)}</div>
        <button onClick={()=>setAdding(!adding)} style={{...s.btnGold,width:"auto",padding:"9px 14px",display:"flex",alignItems:"center",gap:6}}>
          <Icon d={ICONS.plus} size={13}/> {t("add",lang)}
        </button>
      </div>

      {/* filter tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button onClick={()=>setFilter("all")}
          style={{padding:"6px 12px",borderRadius:99,border:`1px solid ${filter==="all"?C.gold:C.line}`,background:filter==="all"?C.gold+"22":"transparent",color:filter==="all"?C.gold:C.chromeDim,fontSize:11,...s.mono,cursor:"pointer"}}>
          {t("all",lang)} <span style={{opacity:0.7}}>({counts.all})</span>
        </button>
        {STATUS_OPTIONS.map(([v,l,col])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{padding:"6px 12px",borderRadius:99,border:`1px solid ${filter===v?col:C.line}`,background:filter===v?col+"22":"transparent",color:filter===v?col:C.chromeDim,fontSize:11,...s.mono,cursor:"pointer"}}>
            {l} <span style={{opacity:0.7}}>({counts[v]})</span>
          </button>
        ))}
      </div>

      {adding&&(
        <div style={{...s.card,display:"flex",flexDirection:"column",gap:10}}>
          {[["name","Trailer Name"],["length","Length (e.g. 20 ft)"],["color","Color (e.g. Black, Red)"],["nickname","Nickname (auto-generated below)"],["year","Year"],["vin","VIN"],["power","Power / Generator"],["kitchen","Kitchen Equipment"],["fridge","Cold Storage"],["dailyRate","Daily Rate ($)"],["monthlyRate","Monthly Rate ($)"],["securityDeposit","Security Deposit ($)"],["purchasePrice","Purchase Price ($)"],["replacementValue","Replacement Value ($) — for the lease"]].map(([k,l])=>(
            <div key={k}><label style={s.label}>{l}</label><input style={s.input} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></div>
          ))}
          <div><label style={s.label}>Equipment included (listed in the lease)</label>
            <textarea style={{...s.input,minHeight:60,resize:"vertical"}} value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))} placeholder="e.g. 3 fryers, flat-top grill, 2-door fridge, hood & fire suppression, generator"/></div>
          <button type="button" onClick={()=>setForm(f=>({...f,nickname:autoNickname(f.length,f.color)}))}
            style={{...s.btnOut,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:12}}>
            ✨ Auto-name from size + color{form.length||form.color?` → "${autoNickname(form.length,form.color)}"`:""}
          </button>
          <div><label style={s.label}>Full Details / Info (shown to the public)</label>
            <textarea style={{...s.input,minHeight:90,resize:"vertical"}} value={form.info} onChange={e=>setForm(f=>({...f,info:e.target.value}))} placeholder="Describe this trailer in detail — features, condition, extras, what makes it great..."/></div>
          <div>
            <label style={s.label}>Photos (add up to 10)</label>
            <input ref={photoRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pickPhotos}/>
            <button type="button" onClick={()=>photoRef.current?.click()} disabled={busyPhoto==="form"} style={{...s.btnOut,display:"flex",alignItems:"center",gap:8,width:"100%",justifyContent:"center"}}>
              <Icon d={ICONS.img} size={15} color={C.gold}/> {busyPhoto==="form"?"Processing…":`Add Photos${form.photos.length?` (${form.photos.length})`:""}`}
            </button>
            {form.photos.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                {form.photos.map((p,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    <img src={p} alt="" style={{width:64,height:64,borderRadius:5,objectFit:"cover",border:`1px solid ${C.lineBright}`}}/>
                    <button onClick={()=>removeFormPhoto(i)} style={{position:"absolute",top:-6,right:-6,background:C.danger,border:"none",borderRadius:99,width:18,height:18,color:"#fff",fontSize:11,cursor:"pointer",lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={s.btnGold} onClick={addTrailer}>Add to Fleet</button>
        </div>
      )}

      {filtered.length===0&&<div style={{color:C.chromeDim,fontSize:13}}>No trailers in this category.</div>}
      {filtered.map(t=>{
        const tenant=db.tenants.find(x=>x.trailerId===t.id);
        const [,,statusColor]=statusMeta(t.status);
        const inlinePhotoRef=React.createRef();
        return(
          <div key={t.id} style={{...s.card,padding:0,overflow:"hidden"}}>
            {/* photo area */}
            <div style={{position:"relative",width:"100%",height:t.photo?160:0,overflow:"hidden",background:C.ink2}}>
              {t.photo&&<img src={t.photo} alt={t.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
              {t.photo&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.6))"}}/>}
              <span style={{position:"absolute",top:10,right:10}}><Pill color={statusColor}>{statusMeta(t.status)[1]}</Pill></span>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{t.nickname?<span style={{color:C.gold}}>{t.nickname}</span>:null}{t.nickname?" · ":""}{t.name}</div>
                  <div style={{fontSize:11,color:C.chromeDim,marginTop:3}}>{t.length} · {fmt$(t.dailyRate)}/day · {fmt$(t.monthlyRate||0)}/mo</div>
                  {t.purchasePrice>0&&<div style={{fontSize:11,color:C.chromeDim}}>Purchase price: {fmt$(t.purchasePrice)}</div>}
                  <div style={{fontSize:11,color:C.blue,marginTop:4,...s.mono}}>👁 {t.views||0} public views · {t.photoCount||0} photos</div>
                  {tenant&&<div style={{fontSize:12,color:C.gold,marginTop:4}}>Rented by: {tenant.name}</div>}
                </div>
                {!t.photo&&<Pill color={statusColor}>{statusMeta(t.status)[1]}</Pill>}
              </div>
              {/* photo thumbnails + remove */}
              {(t.photos||[]).length>0&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                  {t.photos.map((p,i)=>(
                    <div key={i} style={{position:"relative"}}>
                      <img src={p} alt="" style={{width:56,height:56,borderRadius:5,objectFit:"cover",border:`1px solid ${C.line}`}}/>
                      <button onClick={()=>removeTrailerPhoto(t.id,i)} style={{position:"absolute",top:-6,right:-6,background:C.danger,border:"none",borderRadius:99,width:18,height:18,color:"#fff",fontSize:11,cursor:"pointer",lineHeight:1}}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {/* add photos button (multi) */}
              <input type="file" accept="image/*" multiple style={{display:"none"}} ref={inlinePhotoRef} onChange={e=>addTrailerPhotos(t.id,e.target.files)}/>
              <button onClick={()=>inlinePhotoRef.current?.click()} disabled={busyPhoto===t.id} style={{...s.btnOut,width:"100%",marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px"}}>
                <Icon d={ICONS.img} size={13} color={C.gold}/> <span style={{fontSize:10}}>{busyPhoto===t.id?"Processing…":"Add Photos"}</span>
              </button>
              {/* nickname + info quick edit */}
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input defaultValue={t.nickname||""} placeholder="Nickname" onBlur={e=>{const v=e.target.value;updateDB(db=>{const x=db.trailers.find(y=>y.id===t.id);if(x)x.nickname=v;return db;});}}
                  style={{...s.input,flex:1,padding:"8px 10px",fontSize:12}}/>
              </div>
              <textarea defaultValue={t.info||""} placeholder="Full details / info (public)" onBlur={e=>{const v=e.target.value;updateDB(db=>{const x=db.trailers.find(y=>y.id===t.id);if(x)x.info=v;return db;});}}
                style={{...s.input,width:"100%",marginTop:6,minHeight:60,resize:"vertical",fontSize:12}}/>
              {/* status buttons */}
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                {STATUS_OPTIONS.map(([st,label,col])=>(
                  <button key={st} onClick={()=>setStatus(t.id,st)}
                    style={{padding:"5px 11px",borderRadius:3,border:`1px solid ${t.status===st?col:C.line}`,background:t.status===st?col+"22":"transparent",color:t.status===st?col:C.chromeDim,fontSize:10,...s.mono,cursor:"pointer"}}>
                    {label}
                  </button>
                ))}
              </div>
              {/* delete */}
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                {confirmDelete===t.id ? (
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:C.danger,flex:1}}>Delete this trailer permanently?</span>
                    <button onClick={()=>deleteTrailer(t.id)} style={{background:C.danger,color:"#fff",border:"none",borderRadius:3,padding:"6px 12px",fontSize:10,...s.mono,cursor:"pointer"}}>Yes, Delete</button>
                    <button onClick={()=>setConfirmDelete(null)} style={{background:"none",border:`1px solid ${C.line}`,color:C.chromeDim,borderRadius:3,padding:"6px 12px",fontSize:10,...s.mono,cursor:"pointer"}}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>setConfirmDelete(t.id)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.danger,fontSize:11,...s.mono,cursor:"pointer",padding:0}}>
                    <Icon d={ICONS.trash} size={13}/> Delete Trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

