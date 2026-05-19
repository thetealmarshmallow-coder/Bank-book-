import { useState, useEffect, useRef } from "react";

const INST_PAL = {
  "navy federal": ["#0a3161", "#fff"],
  "cash app": ["#00d632", "#fff"],
  "wells fargo": ["#d71e28", "#fff"],
  "bank of america": ["#e31837", "#fff"],
  "chase": ["#117aca", "#fff"],
  "chime": ["#1ec677", "#fff"],
  "ally": ["#8c1a6a", "#fff"],
  "zelle": ["#6b1fa0", "#fff"],
  "paypal": ["#003087", "#fff"],
  "venmo": ["#3d95ce", "#fff"],
};
const PALETTES = [["#d4eee9","#2d7a70"],["#f5e6f0","#8a4a6e"],["#ece6f5","#6a4a8a"],["#f5eedb","#7a6030"],["#e6f0fb","#2d4a8a"]];
const TYPE_C = {
  Checking:["#e6f5f2","#2d7a70"],Savings:["#f0e6f6","#6a4a8a"],"Money Market":["#f5eedb","#7a6030"],
  Investment:["#e6f0fb","#2d4a8a"],"Credit Card":["#fdf0f0","#8a2d2d"],Loan:["#fff5e6","#8a5a2d"],Other:["#f0f0f0","#5a5a5a"],
};

function instStyle(name) {
  const k=(name||"").toLowerCase();
  for(const[key,v] of Object.entries(INST_PAL)){if(k.includes(key))return v;}
  const s=(name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  return PALETTES[s%PALETTES.length];
}
function initials(n){return(n||"?").split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase()||"?";}
function fmt(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(parseFloat(n)||0);}
function mask(v){return v?"•".repeat(Math.min(v.length,9)):"—";}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}

function doExportJSON(accounts,contacts){
  const data={exportedAt:new Date().toISOString(),accounts,contacts};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;
  a.download=`family-ledger-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(url);
}
function doExportCSV(accounts,contacts){
  const h="Account Holder,Institution,Type,Balance,Account Number,Routing Number,Notes";
  const rows=accounts.map(a=>[a.holder,a.inst,a.type,a.bal,a.acct||"",a.routing||"",(a.notes||"").replace(/,/g,";")].join(","));
  const ech="\nEmergency Contact Name,Relationship,Phone";
  const ecr=contacts.map(c=>[c.name,c.rel,c.phone].join(","));
  const csv=[h,...rows,ech,...ecr].join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;
  a.download=`family-ledger-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();URL.revokeObjectURL(url);
}
function doExportPrint(accounts,contacts){
  const date=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const ar=accounts.map(a=>`<tr><td>${a.holder}</td><td>${a.inst}</td><td>${a.type}</td><td>$${parseFloat(a.bal).toFixed(2)}</td><td>${a.acct||"—"}</td><td>${a.routing||"—"}</td><td>${(a.notes||"—").replace(/,/g,";")}</td></tr>`).join("");
  const er=contacts.map(c=>`<tr><td>${c.name}</td><td>${c.rel}</td><td>${c.phone||"—"}</td></tr>`).join("");
  const html=`<!DOCTYPE html><html><head><title>Family Financial Ledger — ${date}</title>
  <style>body{font-family:Georgia,serif;padding:40px;color:#2d4a47}h1{color:#2d7a70;font-size:24px;margin-bottom:4px}.sub{color:#7ab8b0;font-size:13px;margin-bottom:30px}h2{color:#2d7a70;font-size:16px;margin:28px 0 10px;border-bottom:2px solid #c8ece6;padding-bottom:6px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#e6f5f2;color:#2d7a70;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px}td{padding:8px 10px;border-bottom:1px solid #eaf5f3;vertical-align:top}tr:last-child td{border-bottom:none}.footer{margin-top:40px;font-size:11px;color:#9bbfbb;text-align:center}</style>
  </head><body><h1>✦ Family Financial Ledger</h1><div class="sub">Generated on ${date} — Keep this document in a safe place.</div>
  <h2>Accounts</h2><table><thead><tr><th>Holder</th><th>Institution</th><th>Type</th><th>Balance</th><th>Account #</th><th>Routing #</th><th>Notes</th></tr></thead><tbody>${ar}</tbody></table>
  <h2>Emergency Contacts</h2><table><thead><tr><th>Name</th><th>Relationship</th><th>Phone</th></tr></thead><tbody>${er}</tbody></table>
  <div class="footer">TealMarshmallow Family Financial Ledger — For emergency use. Store securely.</div></body></html>`;
  const w=window.open("","_blank");w.document.write(html);w.document.close();w.print();
}

const DEFAULT_ACCOUNTS=[{id:"a1",holder:"Toccara Evans-Bridges",inst:"Navy Federal",type:"Checking",bal:0,acct:"",routing:"256074974",notes:"Main account — direct deposit. Navy Federal: 1-888-842-6328",rev:{}}];
const DEFAULT_CONTACTS=[{id:"c1",name:"Jessica Worthy",rel:"Trusted Friend",phone:""}];

// ─── PIN LOCK SCREEN ───────────────────────────────────────────────────────────
function PinScreen({ mode, onSuccess, onSetPin }) {
  const [digits, setDigits] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState("enter"); // enter | confirm (setup only)
  const [shake, setShake] = useState(false);
  const [hint, setHint] = useState(mode === "setup" ? "Choose a 4–6 digit PIN to protect your ledger." : "Enter your PIN to continue.");

  function press(d) {
    if (d === "del") {
      setDigits(p => p.slice(0, -1));
      return;
    }
    const next = digits + d;
    if (next.length > 6) return;
    setDigits(next);
    if (next.length >= 4) {
      setTimeout(() => submit(next), 120);
    }
  }

  function submit(pin) {
    if (mode === "setup") {
      if (step === "enter") {
        setConfirm(pin);
        setDigits("");
        setStep("confirm");
        setHint("Confirm your PIN — enter it one more time.");
      } else {
        if (pin === confirm) {
          onSetPin(pin);
        } else {
          setShake(true);
          setDigits("");
          setStep("enter");
          setConfirm("");
          setHint("Those didn't match. Let's try again — choose your PIN.");
          setTimeout(() => setShake(false), 600);
        }
      }
    } else {
      const stored = localStorage.getItem("tm_pin");
      if (pin === stored) {
        onSuccess();
      } else {
        setShake(true);
        setDigits("");
        setHint("Hmm, that's not right. Try again.");
        setTimeout(() => setShake(false), 600);
      }
    }
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  return (
    <div style={{minHeight:"100vh",background:"#f4fdfb",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Nunito','Segoe UI',sans-serif",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600&display=swap');@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>

      {/* Cover image */}
      <div style={{width:130,height:130,borderRadius:"50%",overflow:"hidden",border:"4px solid #c8ece6",boxShadow:"0 4px 24px rgba(122,204,194,.25)",marginBottom:20,flexShrink:0}}>
        <img src="/icon.png" alt="TealMarshmallow" style={{width:"100%",height:"100%",objectFit:"cover"}} />
      </div>

      <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:500,color:"#2d7a70",marginBottom:4}}>✦ Family Financial Ledger</div>
      <div style={{fontSize:12,color:"#7ab8b0",marginBottom:28,textAlign:"center",maxWidth:260,lineHeight:1.5}}>{hint}</div>

      {/* Dots */}
      <div style={{display:"flex",gap:14,marginBottom:32,animation:shake?"shake 0.4s ease":"none"}}>
        {[0,1,2,3,4,5].map(i=>(
          <div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<digits.length?"#7accc2":"transparent",border:"2px solid",borderColor:i<digits.length?"#7accc2":"#c8ece6",transition:"all .15s"}} />
        ))}
      </div>

      {/* Keypad */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:12}}>
        {keys.map((k,i)=>(
          k === "" ? <div key={i} /> :
          <button key={i} onClick={()=>press(k)} style={{height:72,borderRadius:16,border:"1.5px solid #c8ece6",background:k==="del"?"#fdf6f0":"#fff",color:k==="del"?"#c47a5a":"#2d4a47",fontSize:k==="del"?18:22,fontWeight:600,fontFamily:"'Nunito',sans-serif",cursor:"pointer",transition:"background .12s",boxShadow:"0 2px 8px rgba(122,204,194,.1)"}}>
            {k==="del"?"⌫":k}
          </button>
        ))}
      </div>

      {mode === "unlock" && (
        <div style={{marginTop:24,fontSize:11,color:"#b0c8c4",textAlign:"center",lineHeight:1.6}}>
          Forgot your PIN? Clear your browser data<br/>to reset the app.
        </div>
      )}
    </div>
  );
}

// ─── SPLASH SCREEN ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#b2e8e0 0%,#d4eee9 40%,#f0e6f6 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Nunito','Segoe UI',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600&display=swap');@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}`}</style>
      <div style={{animation:"fadeUp .7s ease both",display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
        <div style={{width:160,height:160,borderRadius:32,overflow:"hidden",border:"4px solid rgba(255,255,255,.7)",boxShadow:"0 8px 40px rgba(122,204,194,.35)",animation:"pulse 2s ease infinite"}}>
          <img src="/icon.png" alt="TealMarshmallow" style={{width:"100%",height:"100%",objectFit:"cover"}} />
        </div>
        <div style={{animation:"fadeUp .7s .3s ease both",opacity:0,textAlign:"center"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:500,color:"#2d7a70",marginBottom:4}}>✦ Family Financial Ledger</div>
          <div style={{fontSize:13,color:"#5a9e96"}}>by TealMarshmallow</div>
        </div>
        <div style={{animation:"fadeUp .7s .6s ease both",opacity:0,marginTop:8}}>
          <div style={{width:40,height:4,borderRadius:4,background:"rgba(122,204,194,.4)",overflow:"hidden"}}>
            <div style={{height:"100%",background:"#7accc2",animation:"load 2s linear forwards",borderRadius:4}} />
          </div>
        </div>
      </div>
      <style>{`@keyframes load{from{width:0}to{width:100%}}`}</style>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState("splash"); // splash | setup | locked | unlocked
  const [accounts, setAccounts] = useState(() => { try{return JSON.parse(localStorage.getItem("tm_fam_accts"))||DEFAULT_ACCOUNTS;}catch{return DEFAULT_ACCOUNTS;} });
  const [contacts, setContacts] = useState(() => { try{return JSON.parse(localStorage.getItem("tm_fam_ec"))||DEFAULT_CONTACTS;}catch{return DEFAULT_CONTACTS;} });
  const [tab, setTab] = useState("accounts");
  const [activeAcct, setActiveAcct] = useState(null);
  const [activeEc, setActiveEc] = useState(null);
  const [search, setSearch] = useState("");
  const [acctModal, setAcctModal] = useState(false);
  const [editAcctId, setEditAcctId] = useState(null);
  const [acctForm, setAcctForm] = useState({holder:"",inst:"",type:"Checking",bal:"",acct:"",routing:"",notes:""});
  const [ecModal, setEcModal] = useState(false);
  const [editEcId, setEditEcId] = useState(null);
  const [ecForm, setEcForm] = useState({name:"",rel:"",phone:""});
  const [toast, setToast] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const fileRef = useRef();

  useEffect(()=>{localStorage.setItem("tm_fam_accts",JSON.stringify(accounts));},[accounts]);
  useEffect(()=>{localStorage.setItem("tm_fam_ec",JSON.stringify(contacts));},[contacts]);

  useEffect(()=>{
    const handler=(e)=>{e.preventDefault();setInstallPrompt(e);setShowInstall(true);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  function afterSplash() {
    const pin = localStorage.getItem("tm_pin");
    setAppState(pin ? "locked" : "setup");
  }

  function handleSetPin(pin) {
    localStorage.setItem("tm_pin", pin);
    if (changingPin) { setChangingPin(false); notify("PIN updated ✦"); setAppState("unlocked"); }
    else setAppState("unlocked");
  }

  function notify(msg,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000);}

  function toggleRev(id,field){setAccounts(prev=>prev.map(a=>a.id===id?{...a,rev:{...a.rev,[field]:!a.rev?.[field]}}:a));}

  function openAddAcct(){setAcctForm({holder:"",inst:"",type:"Checking",bal:"",acct:"",routing:"",notes:""});setEditAcctId(null);setAcctModal(true);}
  function openEditAcct(a){setAcctForm({holder:a.holder,inst:a.inst,type:a.type,bal:a.bal,acct:a.acct||"",routing:a.routing||"",notes:a.notes||""});setEditAcctId(a.id);setAcctModal(true);}
  function saveAcct(){
    const entry={id:editAcctId||uid(),holder:acctForm.holder.trim()||"Unknown",inst:acctForm.inst.trim()||"Other",type:acctForm.type,bal:parseFloat(acctForm.bal)||0,acct:acctForm.acct.trim(),routing:acctForm.routing.trim(),notes:acctForm.notes.trim(),rev:{}};
    if(editAcctId)setAccounts(prev=>prev.map(a=>a.id===editAcctId?entry:a));
    else setAccounts(prev=>[...prev,entry]);
    setAcctModal(false);notify(editAcctId?"Account updated ✦":"Account added ✦");
  }
  function deleteAcct(){setAccounts(prev=>prev.filter(a=>a.id!==editAcctId));setActiveAcct(null);setAcctModal(false);notify("Account removed.");}

  function openAddEc(){setEcForm({name:"",rel:"",phone:""});setEditEcId(null);setEcModal(true);}
  function openEditEc(c){setEcForm({name:c.name,rel:c.rel,phone:c.phone});setEditEcId(c.id);setEcModal(true);}
  function saveEc(){
    const entry={id:editEcId||uid(),name:ecForm.name.trim()||"Unknown",rel:ecForm.rel.trim()||"Contact",phone:ecForm.phone.trim()};
    if(editEcId)setContacts(prev=>prev.map(c=>c.id===editEcId?entry:c));
    else setContacts(prev=>[...prev,entry]);
    setEcModal(false);notify(editEcId?"Contact updated 🤍":"Contact added 🤍");
  }
  function deleteEc(){setContacts(prev=>prev.filter(c=>c.id!==editEcId));setActiveEc(null);setEcModal(false);notify("Contact removed.");}

  function handleRestoreFile(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);if(d.accounts)setAccounts(d.accounts);if(d.contacts)setContacts(d.contacts);notify("Backup restored ✦");}catch{notify("Could not read that file.",false);}};
    reader.readAsText(file);e.target.value="";
  }

  async function handleInstall(){
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted")setShowInstall(false);
    setInstallPrompt(null);
  }

  // Routing
  if(appState==="splash") return <SplashScreen onDone={afterSplash}/>;
  if(appState==="setup"||changingPin) return <PinScreen mode="setup" onSetPin={handleSetPin}/>;
  if(appState==="locked") return <PinScreen mode="unlock" onSuccess={()=>setAppState("unlocked")}/>;

  const totalBal=accounts.reduce((s,a)=>s+(parseFloat(a.bal)||0),0);
  const holders=new Set(accounts.map(a=>a.holder)).size;
  const filtered=accounts.filter(a=>!search||[a.holder,a.inst,a.type,a.notes].join(" ").toLowerCase().includes(search.toLowerCase()));
  const byHolder={};
  filtered.forEach(a=>{(byHolder[a.holder]=byHolder[a.holder]||[]).push(a);});

  const s={
    wrap:{minHeight:"100vh",background:"#f4fdfb",fontFamily:"'Nunito','Segoe UI',sans-serif",padding:"0 0 80px"},
    inner:{maxWidth:600,margin:"0 auto",padding:"16px 14px"},
    header:{background:"linear-gradient(135deg,#b2e8e0 0%,#d4eee9 40%,#f0e6f6 100%)",borderRadius:20,padding:"16px 20px",marginBottom:16,border:"1.5px solid #c8ece6",display:"flex",alignItems:"center",gap:14},
    headerImg:{width:52,height:52,borderRadius:12,overflow:"hidden",border:"2px solid rgba(255,255,255,.8)",flexShrink:0},
    h1:{fontFamily:"Georgia,serif",fontSize:18,fontWeight:500,color:"#2d7a70",margin:"0 0 2px"},
    subtext:{fontSize:11,color:"#5a9e96",lineHeight:1.4,margin:0},
    installBanner:{background:"#fff8e6",border:"1.5px solid #e8d4a0",borderRadius:14,padding:"10px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"},
    tabs:{display:"flex",gap:8,marginBottom:16},
    tab:(on)=>({flex:1,padding:"9px 6px",borderRadius:14,border:`1.5px solid ${on?"#7accc2":"#d4eeea"}`,background:on?"#7accc2":"#f7fdf9",fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:600,color:on?"#fff":"#7ab8b0",cursor:"pointer"}),
    stats:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16},
    stat:{background:"#fff",border:"1px solid #d4eeea",borderRadius:14,padding:"12px 14px",textAlign:"center"},
    statVal:{fontSize:15,fontWeight:600,color:"#2d7a70"},
    statLbl:{fontSize:10,color:"#7ab8b0",marginTop:2},
    bar:{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"},
    search:{flex:1,minWidth:150,padding:"8px 14px",borderRadius:18,border:"1.5px solid #c8ece6",fontFamily:"'Nunito',sans-serif",fontSize:13,background:"#f7fdf9",color:"#2d4a47",outline:"none"},
    btn:(color="teal")=>({padding:"8px 16px",borderRadius:18,border:`1.5px solid ${color==="teal"?"#7accc2":color==="blush"?"#ddb0cc":color==="gold"?"#e8c87a":color==="danger"?"#e8c4c4":"#c8ece6"}`,background:color==="teal"?"#7accc2":color==="blush"?"#e8c4d8":color==="gold"?"#f5eedb":color==="danger"?"#fdf0f0":"#f0f9f7",color:color==="teal"?"#fff":color==="blush"?"#8a4a6e":color==="gold"?"#7a6030":color==="danger"?"#b05050":"#2d7a70",fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}),
    grpTitle:{fontSize:11,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",color:"#9bbfbb",margin:"14px 0 8px 4px"},
    card:(open)=>({background:open?"#f4fdfc":"#fff",border:`1.5px solid ${open?"#7accc2":"#e0f2ee"}`,borderRadius:16,padding:"14px 16px",marginBottom:9,cursor:"pointer"}),
    ecCard:(open)=>({background:open?"#fdf7ff":"#fff",border:`1.5px solid ${open?"#c4a0d4":"#f0e6f6"}`,borderRadius:16,padding:"14px 16px",marginBottom:9,cursor:"pointer"}),
    exportCard:{background:"#fff",border:"1.5px solid #e8d4a0",borderRadius:16,padding:"18px 20px",marginBottom:12},
    cardTop:{display:"flex",alignItems:"center",gap:11},
    logo:(bg,fg)=>({width:36,height:36,borderRadius:10,background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}),
    avatar:{width:36,height:36,borderRadius:"50%",background:"#f0e6f6",color:"#8a4a6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0},
    cardInfo:{flex:1,minWidth:0},
    cardName:{fontSize:13,fontWeight:600,color:"#2d4a47",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
    cardSub:{fontSize:11,color:"#7ab8b0",marginTop:1},
    cardBal:{fontSize:14,fontWeight:600,color:"#2d7a70",textAlign:"right"},
    badge:(bg,fg)=>({display:"inline-block",padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600,background:bg,color:fg,marginTop:2}),
    details:{marginTop:12,borderTop:"1px solid #eaf5f3",paddingTop:11},
    row:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px dashed #e8f5f2",fontSize:12},
    rl:{color:"#7ab8b0",fontSize:11},
    rv:{color:"#2d4a47",fontWeight:500,display:"flex",alignItems:"center",gap:5},
    reveal:{fontSize:10,color:"#7accc2",cursor:"pointer",border:"1px solid #c8ece6",background:"none",fontFamily:"'Nunito',sans-serif",padding:"1px 7px",borderRadius:8},
    note:{marginTop:9,background:"#fdf6f0",borderLeft:"3px solid #e8c4a0",borderRadius:"0 10px 10px 0",padding:"7px 11px",fontSize:11,color:"#7a5a3a",fontStyle:"italic",lineHeight:1.5},
    cardBtns:{marginTop:10,display:"flex",gap:7},
    overlay:{position:"fixed",inset:0,background:"rgba(45,74,71,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16},
    modal:(color)=>({background:"#fff",borderRadius:22,padding:"24px 22px",width:"100%",maxWidth:430,border:`2px solid ${color==="blush"?"#ddb0cc":"#c8ece6"}`,maxHeight:"88vh",overflowY:"auto"}),
    modalH2:(color)=>({fontFamily:"Georgia,serif",fontSize:18,color:color==="blush"?"#8a4a6e":"#2d7a70",margin:"0 0 16px"}),
    flbl:{display:"block",fontSize:11,fontWeight:600,color:"#7ab8b0",marginBottom:4,letterSpacing:".5px",textTransform:"uppercase"},
    finp:(color)=>({width:"100%",padding:"8px 12px",borderRadius:11,border:`1.5px solid ${color==="blush"?"#ddb0cc":"#d4eeea"}`,fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#2d4a47",background:color==="blush"?"#fdf7ff":"#f7fdf9",outline:"none",marginBottom:12,boxSizing:"border-box"}),
    modalBtns:{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"},
    empty:{textAlign:"center",padding:"36px 20px",color:"#9bbfbb",fontSize:13},
    toastBox:(ok)=>({position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:ok?"#2d7a70":"#b05050",color:"#fff",padding:"11px 22px",borderRadius:18,fontSize:13,fontWeight:600,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,.15)"}),
  };

  return (
    <div style={s.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600&display=swap');*{box-sizing:border-box;}input:focus,select:focus,textarea:focus{border-color:#7accc2!important;outline:none;}`}</style>
      <div style={s.inner}>

        {showInstall&&(
          <div style={s.installBanner}>
            <span style={{fontSize:12,color:"#7a6030"}}>📲 Add this app to your home screen</span>
            <div style={{display:"flex",gap:7}}>
              <button style={s.btn("teal")} onClick={handleInstall}>Install</button>
              <button style={{...s.btn("soft"),fontSize:11}} onClick={()=>setShowInstall(false)}>✕</button>
            </div>
          </div>
        )}

        {/* Header with logo */}
        <div style={s.header}>
          <div style={s.headerImg}><img src="/icon.png" alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
          <div>
            <h1 style={s.h1}>✦ Family Financial Ledger</h1>
            <p style={s.subtext}>Your family's accounts, safe in one place.</p>
          </div>
          <button title="Lock app" onClick={()=>setAppState("locked")} style={{marginLeft:"auto",background:"transparent",border:"1.5px solid #c8ece6",borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:16,color:"#7ab8b0"}}>🔒</button>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={s.tab(tab==="accounts")} onClick={()=>setTab("accounts")}>🏦 Accounts</button>
          <button style={s.tab(tab==="contacts")} onClick={()=>setTab("contacts")}>🤍 Contacts</button>
          <button style={s.tab(tab==="backup")} onClick={()=>setTab("backup")}>💾 Backup</button>
          <button style={s.tab(tab==="settings")} onClick={()=>setTab("settings")}>⚙️</button>
        </div>

        {/* ACCOUNTS */}
        {tab==="accounts"&&<>
          <div style={s.stats}>
            <div style={s.stat}><div style={s.statVal}>{accounts.length}</div><div style={s.statLbl}>Accounts</div></div>
            <div style={s.stat}><div style={s.statVal}>{fmt(totalBal)}</div><div style={s.statLbl}>Total Balance</div></div>
            <div style={s.stat}><div style={s.statVal}>{holders} {holders===1?"person":"people"}</div><div style={s.statLbl}>Holders</div></div>
          </div>
          <div style={s.bar}>
            <input style={s.search} placeholder="Search by name, bank, or type…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <button style={s.btn("teal")} onClick={openAddAcct}>+ Add Account</button>
          </div>
          {Object.keys(byHolder).length===0&&<div style={s.empty}>🌿 No accounts yet — add one to get started, love.</div>}
          {Object.entries(byHolder).map(([holder,accts])=>(
            <div key={holder}>
              <div style={s.grpTitle}>👤 {holder}</div>
              {accts.map(a=>{
                const[bg,fg]=instStyle(a.inst);
                const[tbg,tfg]=TYPE_C[a.type]||TYPE_C.Other;
                const open=activeAcct===a.id;
                return(
                  <div key={a.id} style={s.card(open)} onClick={()=>setActiveAcct(open?null:a.id)}>
                    <div style={s.cardTop}>
                      <div style={s.logo(bg,fg)}>{initials(a.inst)}</div>
                      <div style={s.cardInfo}>
                        <div style={s.cardName}>{a.inst}</div>
                        <div style={s.cardSub}>{a.type}</div>
                      </div>
                      <div>
                        <div style={s.cardBal}>{fmt(a.bal)}</div>
                        <div style={{textAlign:"right"}}><span style={s.badge(tbg,tfg)}>{a.type}</span></div>
                      </div>
                    </div>
                    {open&&<div style={s.details}>
                      <div style={s.row}><span style={s.rl}>Account Holder</span><span style={s.rv}>{a.holder}</span></div>
                      <div style={s.row}><span style={s.rl}>Account #</span><span style={s.rv}>{a.acct?<>{a.rev?.acct?a.acct:mask(a.acct)}<button style={s.reveal} onClick={e=>{e.stopPropagation();toggleRev(a.id,"acct");}}>{a.rev?.acct?"hide":"show"}</button></>:"—"}</span></div>
                      <div style={s.row}><span style={s.rl}>Routing #</span><span style={s.rv}>{a.routing?<>{a.rev?.routing?a.routing:mask(a.routing)}<button style={s.reveal} onClick={e=>{e.stopPropagation();toggleRev(a.id,"routing");}}>{a.rev?.routing?"hide":"show"}</button></>:"—"}</span></div>
                      <div style={{...s.row,borderBottom:"none"}}><span style={s.rl}>Institution</span><span style={s.rv}>{a.inst}</span></div>
                      {a.notes&&<div style={s.note}>✦ {a.notes}</div>}
                      <div style={s.cardBtns}><button style={{...s.btn("soft"),fontSize:11,padding:"5px 13px"}} onClick={e=>{e.stopPropagation();openEditAcct(a);}}>✏️ Edit</button></div>
                    </div>}
                  </div>
                );
              })}
            </div>
          ))}
        </>}

        {/* CONTACTS */}
        {tab==="contacts"&&<>
          <div style={{...s.bar,marginTop:4}}>
            <button style={s.btn("blush")} onClick={openAddEc}>+ Add Contact</button>
          </div>
          {contacts.length===0&&<div style={s.empty}>🤍 No emergency contacts yet.</div>}
          {contacts.length>0&&<div style={s.grpTitle}>In case of emergency, contact:</div>}
          {contacts.map(c=>{
            const open=activeEc===c.id;
            return(
              <div key={c.id} style={s.ecCard(open)} onClick={()=>setActiveEc(open?null:c.id)}>
                <div style={s.cardTop}>
                  <div style={s.avatar}>{initials(c.name)}</div>
                  <div style={s.cardInfo}>
                    <div style={s.cardName}>{c.name}</div>
                    <div style={{...s.cardSub,color:"#b07ab8"}}>{c.rel}</div>
                  </div>
                </div>
                {open&&<div style={s.details}>
                  <div style={s.row}><span style={s.rl}>Relationship</span><span style={s.rv}>{c.rel}</span></div>
                  <div style={{...s.row,borderBottom:"none"}}><span style={s.rl}>Phone</span><span style={s.rv}><a href={`tel:${c.phone}`} style={{color:"#8a4a6e",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>{c.phone||"—"}</a></span></div>
                  <div style={s.cardBtns}><button style={{...s.btn("blush"),fontSize:11,padding:"5px 13px"}} onClick={e=>{e.stopPropagation();openEditEc(c);}}>✏️ Edit</button></div>
                </div>}
              </div>
            );
          })}
        </>}

        {/* BACKUP */}
        {tab==="backup"&&<>
          <div style={s.grpTitle}>Export your data</div>
          <div style={s.exportCard}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>💾 Backup File (JSON)</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Save a backup file you can restore on any device. Email it to yourself or save to Google Drive.</div>
            <button style={s.btn("teal")} onClick={()=>doExportJSON(accounts,contacts)}>Download Backup</button>
          </div>
          <div style={s.exportCard}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>📊 Export as Spreadsheet (CSV)</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Opens in Excel or Google Sheets. Great for sharing with a trusted person or attorney.</div>
            <button style={s.btn("gold")} onClick={()=>doExportCSV(accounts,contacts)}>Download CSV</button>
          </div>
          <div style={s.exportCard}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>🖨️ Print / Save as PDF</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Opens a print-ready page. Choose "Save as PDF" in your print dialog to keep a digital copy.</div>
            <button style={s.btn("soft")} onClick={()=>doExportPrint(accounts,contacts)}>Print or Save PDF</button>
          </div>
          <div style={{...s.exportCard,borderColor:"#ddb0cc"}}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>📂 Restore from Backup</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Upload a previous backup file to restore all your accounts and contacts.</div>
            <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleRestoreFile}/>
            <button style={s.btn("blush")} onClick={()=>fileRef.current.click()}>Upload Backup File</button>
          </div>
        </>}

        {/* SETTINGS */}
        {tab==="settings"&&<>
          <div style={s.grpTitle}>Security & Settings</div>
          <div style={s.exportCard}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>🔐 Change PIN</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Update your PIN code at any time. You'll be asked to choose a new one right away.</div>
            <button style={s.btn("teal")} onClick={()=>{setChangingPin(true);setAppState("setup");}}>Change PIN</button>
          </div>
          <div style={s.exportCard}>
            <div style={{fontSize:14,fontWeight:600,color:"#2d4a47",marginBottom:4}}>🔒 Lock App Now</div>
            <div style={{fontSize:12,color:"#7ab8b0",marginBottom:12,lineHeight:1.5}}>Lock the app immediately. Your PIN will be required to get back in.</div>
            <button style={s.btn("danger")} onClick={()=>setAppState("locked")}>Lock Now</button>
          </div>
        </>}
      </div>

      {/* ACCOUNT MODAL */}
      {acctModal&&(
        <div style={s.overlay} onClick={e=>{if(e.target===e.currentTarget)setAcctModal(false);}}>
          <div style={s.modal("teal")}>
            <h2 style={s.modalH2("teal")}>{editAcctId?"Edit Account ✦":"Add an Account ✦"}</h2>
            {[{lbl:"Account Belongs To",key:"holder",placeholder:"e.g. Toccara, Kayla"},{lbl:"Institution",key:"inst",placeholder:"e.g. Navy Federal, Cash App"}].map(f=>(
              <div key={f.key}><label style={s.flbl}>{f.lbl}</label><input style={s.finp()} value={acctForm[f.key]} placeholder={f.placeholder} onChange={e=>setAcctForm(p=>({...p,[f.key]:e.target.value}))}/></div>
            ))}
            <label style={s.flbl}>Account Type</label>
            <select style={s.finp()} value={acctForm.type} onChange={e=>setAcctForm(p=>({...p,type:e.target.value}))}>
              {["Checking","Savings","Money Market","Investment","Credit Card","Loan","Other"].map(t=><option key={t}>{t}</option>)}
            </select>
            <label style={s.flbl}>Balance ($)</label>
            <input style={s.finp()} type="number" value={acctForm.bal} placeholder="0.00" onChange={e=>setAcctForm(p=>({...p,bal:e.target.value}))}/>
            <label style={s.flbl}>Account Number</label>
            <input style={s.finp()} value={acctForm.acct} placeholder="Optional" onChange={e=>setAcctForm(p=>({...p,acct:e.target.value}))}/>
            <label style={s.flbl}>Routing Number</label>
            <input style={s.finp()} value={acctForm.routing} placeholder="Optional" onChange={e=>setAcctForm(p=>({...p,routing:e.target.value}))}/>
            <label style={s.flbl}>Notes (emergency context)</label>
            <textarea style={{...s.finp(),height:70,resize:"vertical"}} value={acctForm.notes} placeholder="e.g. Direct deposit. Call Navy Federal at 1-888-842-6328." onChange={e=>setAcctForm(p=>({...p,notes:e.target.value}))}/>
            <div style={s.modalBtns}>
              <button style={s.btn("teal")} onClick={saveAcct}>Save ✦</button>
              <button style={s.btn("soft")} onClick={()=>setAcctModal(false)}>Cancel</button>
              {editAcctId&&<button style={{...s.btn("soft"),borderColor:"#e8c4c4",color:"#b05050"}} onClick={deleteAcct}>Remove</button>}
            </div>
          </div>
        </div>
      )}

      {/* CONTACT MODAL */}
      {ecModal&&(
        <div style={s.overlay} onClick={e=>{if(e.target===e.currentTarget)setEcModal(false);}}>
          <div style={s.modal("blush")}>
            <h2 style={s.modalH2("blush")}>{editEcId?"Edit Contact 🤍":"Add Emergency Contact 🤍"}</h2>
            {[{lbl:"Full Name",key:"name",placeholder:"e.g. Jessica Worthy"},{lbl:"Relationship",key:"rel",placeholder:"e.g. Sister, Attorney, Trusted Friend"},{lbl:"Phone Number",key:"phone",placeholder:"e.g. (251) 555-0100",type:"tel"}].map(f=>(
              <div key={f.key}><label style={s.flbl}>{f.lbl}</label><input style={s.finp("blush")} type={f.type||"text"} value={ecForm[f.key]} placeholder={f.placeholder} onChange={e=>setEcForm(p=>({...p,[f.key]:e.target.value}))}/></div>
            ))}
            <div style={s.modalBtns}>
              <button style={s.btn("blush")} onClick={saveEc}>Save 🤍</button>
              <button style={s.btn("soft")} onClick={()=>setEcModal(false)}>Cancel</button>
              {editEcId&&<button style={{...s.btn("soft"),borderColor:"#e8c4c4",color:"#b05050"}} onClick={deleteEc}>Remove</button>}
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={s.toastBox(toast.ok)}>{toast.msg}</div>}
    </div>
  );
}
