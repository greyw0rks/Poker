'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './globals.css';

const SERVER = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const CHIPS_PER_USD = 100;
const SC = { s:'#1a1a2e', h:'#c41230', d:'#c41230', c:'#1a1a2e' };
const SS = { s:'\u2660', h:'\u2665', d:'\u2666', c:'\u2663' };

const DIFFICULTIES = [
  { id:'easy',    label:'Easy',    emoji:'🌱', buyIn:0.10, desc:'3 casual bots',   color:'#4ade80', bg:'#14532d' },
  { id:'normal',  label:'Normal',  emoji:'⚡', buyIn:0.15, desc:'3 smart bots',    color:'#60a5fa', bg:'#1e3a8a' },
  { id:'hard',    label:'Hard',    emoji:'🔥', buyIn:0.50, desc:'3 aggressive bots',color:'#fbbf24', bg:'#78350f' },
  { id:'super',   label:'Super',   emoji:'💀', buyIn:1.00, desc:'3 GTO bots',      color:'#f87171', bg:'#7f1d1d' },
];

const SEATS = {
  2:[{style:{bottom:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-up'},{style:{top:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-down'}],
  3:[{style:{bottom:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-up'},{style:{top:'8px',right:'20%'},fold:'fold-down'},{style:{top:'8px',left:'20%'},fold:'fold-down'}],
  4:[{style:{bottom:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-up'},{style:{top:'50%',right:'8px',transform:'translateY(-50%)'},fold:'fold-left'},{style:{top:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-down'},{style:{top:'50%',left:'8px',transform:'translateY(-50%)'},fold:'fold-right'}],
  5:[{style:{bottom:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-up'},{style:{bottom:'22%',right:'8px'},fold:'fold-left'},{style:{top:'22%',right:'8px'},fold:'fold-left'},{style:{top:'22%',left:'8px'},fold:'fold-right'},{style:{bottom:'22%',left:'8px'},fold:'fold-right'}],
  6:[{style:{bottom:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-up'},{style:{bottom:'22%',right:'8px'},fold:'fold-left'},{style:{top:'22%',right:'8px'},fold:'fold-left'},{style:{top:'8px',left:'50%',transform:'translateX(-50%)'},fold:'fold-down'},{style:{top:'22%',left:'8px'},fold:'fold-right'},{style:{bottom:'22%',left:'8px'},fold:'fold-right'}],
};

function AnimStyles() {
  return <style>{`
    @keyframes dealCard1{0%{transform:scale(0.05) translate(120px,80px) rotate(25deg);opacity:0}50%{opacity:1}100%{transform:scale(1) translate(0,0) rotate(0deg);opacity:1}}
    @keyframes dealCard2{0%{transform:scale(0.05) translate(120px,80px) rotate(25deg);opacity:0}50%{opacity:1}100%{transform:scale(1) translate(0,0) rotate(0deg);opacity:1}}
    @keyframes dealBoard{0%{transform:scale(0.1) translateY(-40px) rotate(-8deg);opacity:0}70%{transform:scale(1.04) translateY(2px) rotate(.5deg);opacity:1}100%{transform:scale(1) translateY(0) rotate(0);opacity:1}}
    @keyframes foldUp{to{transform:translateY(-90px) rotate(-25deg);opacity:0}}
    @keyframes foldDown{to{transform:translateY(90px) rotate(25deg);opacity:0}}
    @keyframes foldLeft{to{transform:translateX(-90px) rotate(-25deg);opacity:0}}
    @keyframes foldRight{to{transform:translateX(90px) rotate(25deg);opacity:0}}
    @keyframes raiseIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}50%{box-shadow:0 0 0 8px rgba(52,211,153,.25)}}
    @keyframes chipToss{0%{transform:translateY(-30px) scale(1.3);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
    @keyframes thinkPulse{0%,100%{opacity:.4}50%{opacity:1}}
    .deal1{opacity:0;animation:dealCard1 .55s cubic-bezier(.25,.46,.45,.94) forwards .1s}
    .deal2{opacity:0;animation:dealCard2 .55s cubic-bezier(.25,.46,.45,.94) forwards .4s}
    .deal-board{opacity:0;animation:dealBoard .4s ease forwards}
    .fold-up{animation:foldUp .4s ease forwards}
    .fold-down{animation:foldDown .4s ease forwards}
    .fold-left{animation:foldLeft .4s ease forwards}
    .fold-right{animation:foldRight .4s ease forwards}
    .raise-panel{animation:raiseIn .22s ease forwards}
    .fade-in{animation:fadeIn .3s ease forwards}
    .slide-up{animation:slideUp .35s ease forwards}
    .my-turn-glow{animation:glow 1.2s ease infinite}
    .chip-toss{animation:chipToss .3s ease forwards}
    .think-pulse{animation:thinkPulse .8s ease infinite}
  `}</style>;
}

function CardBack({cls}){return <div className={cls||''} style={{width:32,height:46,borderRadius:5,flexShrink:0,background:'#1e3a8a',border:'2px solid #2d5be3',boxShadow:'0 2px 6px rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'80%',height:'80%',borderRadius:3,border:'1px solid rgba(255,255,255,.2)',background:'repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 2px,transparent 2px,transparent 6px)'}}/></div>;}

function SeatCards({idx,numP,anim}){const seat=(SEATS[numP]||SEATS[4])[idx];if(!seat||!anim||anim==='none'||anim==='hidden')return null;const fold=anim.startsWith('fold-'),deal=anim==='dealing';return <div style={{position:'absolute',display:'flex',gap:4,zIndex:5,...seat.style}}><CardBack cls={deal?'deal1':fold?anim:''}/><CardBack cls={deal?'deal2':fold?anim:''}/></div>;}

function FaceCard({card,small,animate}){const w=small?34:48,h=small?48:68;if(!card)return <div style={{width:w,height:h,background:'#2d3748',borderRadius:5,border:'1px solid #4a5568',flexShrink:0}}/>;const r=card.slice(0,-1),s=card.slice(-1);return <div className={animate?'deal-board':''} style={{width:w,height:h,background:'#fff',borderRadius:5,border:'1px solid #e5e7eb',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'3px',color:SC[s]||'#000',fontWeight:700,fontFamily:'Georgia,serif',flexShrink:0,boxShadow:'0 4px 16px rgba(0,0,0,.5)'}}><div style={{alignSelf:'flex-start',fontSize:small?9:11,lineHeight:1.1}}>{r==='T'?'10':r}<br/>{SS[s]}</div><div style={{fontSize:small?14:20}}>{SS[s]}</div><div style={{alignSelf:'flex-end',fontSize:small?9:11,lineHeight:1.1,transform:'rotate(180deg)'}}>{r==='T'?'10':r}<br/>{SS[s]}</div></div>;}

function ActionTimer({seconds,total=30}){const r=22,circ=2*Math.PI*r,pct=Math.max(0,seconds/total),color=seconds>10?'#4ade80':seconds>5?'#fbbf24':'#ef4444';return <div style={{position:'relative',width:54,height:54,flexShrink:0}}><svg width="54" height="54" style={{transform:'rotate(-90deg)'}}><circle cx="27" cy="27" r={r} fill="none" stroke="#1e293b" strokeWidth="4"/><circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:'stroke-dashoffset .9s linear,stroke .5s'}}/></svg><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'1rem',color}}>{seconds}</div></div>;}

function ActionBar({isMyTurn,canCheck,toCall,myChips,pot,timer,onFold,onCheck,onCall,onRaise,onAllIn}){
  const [showRaise,setShowRaise]=useState(false);
  const [raiseVal,setRaiseVal]=useState(0);
  const chips=Number(myChips||0),call=Number(toCall||0),potN=Number(pot||0),minRaise=Math.max(call*2,2);
  const presets=[{label:'1/2',val:Math.min(chips,Math.floor(potN/2)+call)},{label:'Pot',val:Math.min(chips,potN+call)},{label:'2x',val:Math.min(chips,potN*2+call)}].filter(p=>p.val>=minRaise);
  useEffect(()=>{if(isMyTurn){setShowRaise(false);setRaiseVal(minRaise);}},[isMyTurn]);
  if(!isMyTurn)return <div style={{padding:'.85rem',textAlign:'center',color:'#475569',fontSize:'.88rem',background:'#0f172a',borderTop:'1px solid #1e293b'}}>Waiting for your turn…</div>;
  return <div style={{background:'#0f172a',borderTop:'2px solid #34d399'}}>
    {showRaise&&<div className="raise-panel" style={{background:'#1e293b',borderTop:'1px solid #334155',padding:'.85rem 1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}><span style={{color:'#94a3b8',fontSize:'.8rem'}}>Raise to</span><span style={{color:'#f4c430',fontWeight:800,fontSize:'1.1rem'}}>{raiseVal.toLocaleString()} chips</span></div>
      <input type="range" min={minRaise} max={chips} value={raiseVal} onChange={e=>setRaiseVal(Number(e.target.value))} style={{width:'100%',accentColor:'#f4c430',marginBottom:'.6rem',height:6}}/>
      <div style={{display:'flex',gap:'.4rem',marginBottom:'.7rem'}}>
        {presets.map(p=><button key={p.label} onClick={()=>setRaiseVal(p.val)} style={{flex:1,background:raiseVal===p.val?'#f4c430':'#334155',color:raiseVal===p.val?'#000':'#94a3b8',border:'none',borderRadius:8,padding:'.35rem',cursor:'pointer',fontSize:'.78rem',fontWeight:700}}>{p.label}</button>)}
        <button onClick={()=>setRaiseVal(chips)} style={{flex:1,background:raiseVal===chips?'#7c3aed':'#334155',color:raiseVal===chips?'#fff':'#94a3b8',border:'none',borderRadius:8,padding:'.35rem',cursor:'pointer',fontSize:'.78rem',fontWeight:700}}>All In</button>
      </div>
      <div style={{display:'flex',gap:'.5rem'}}>
        <button onClick={()=>setShowRaise(false)} style={{flex:1,background:'#334155',color:'#94a3b8',border:'none',borderRadius:10,padding:'.65rem',cursor:'pointer',fontWeight:700}}>Cancel</button>
        <button onClick={()=>{onRaise(raiseVal);setShowRaise(false);}} style={{flex:2,background:'linear-gradient(135deg,#f4c430,#d4a017)',color:'#000',border:'none',borderRadius:10,padding:'.65rem',cursor:'pointer',fontWeight:800,fontSize:'1rem'}}>Raise to {raiseVal.toLocaleString()} ↑</button>
      </div>
    </div>}
    <div style={{padding:'.75rem 1rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.65rem'}}>
        <ActionTimer seconds={timer} total={30}/>
        <div style={{textAlign:'center'}}>{call>0?<><div style={{color:'#94a3b8',fontSize:'.72rem'}}>To call</div><div style={{color:'#fff',fontWeight:800,fontSize:'1.05rem'}}>{call.toLocaleString()}</div></>:<div style={{color:'#4ade80',fontWeight:700,fontSize:'.88rem'}}>Check free ✓</div>}</div>
        <div style={{textAlign:'right'}}><div style={{color:'#94a3b8',fontSize:'.72rem'}}>Your chips</div><div style={{color:'#f4c430',fontWeight:800,fontSize:'1rem'}}>{chips.toLocaleString()}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 1fr',gap:'.5rem'}}>
        <button onClick={onFold} style={{background:'linear-gradient(160deg,#7f1d1d,#991b1b)',color:'#fca5a5',border:'2px solid #b91c1c',borderRadius:14,padding:'.9rem .5rem',cursor:'pointer',fontWeight:800,fontSize:'.9rem',boxShadow:'0 4px 12px rgba(185,28,28,.35)'}}>✕ Fold</button>
        {canCheck?<button onClick={onCheck} style={{background:'linear-gradient(160deg,#14532d,#166534)',color:'#86efac',border:'2px solid #16a34a',borderRadius:14,padding:'.9rem .5rem',cursor:'pointer',fontWeight:800,fontSize:'1rem',boxShadow:'0 4px 16px rgba(22,163,74,.4)'}}>✓ Check</button>
        :<button onClick={onCall} style={{background:'linear-gradient(160deg,#14532d,#166534)',color:'#86efac',border:'2px solid #16a34a',borderRadius:14,padding:'.9rem .5rem',cursor:'pointer',fontWeight:800,fontSize:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(22,163,74,.4)'}}><div>Call</div><div style={{fontSize:'.78rem',color:'#4ade80'}}>{call.toLocaleString()}</div></button>}
        <button onClick={()=>setShowRaise(r=>!r)} style={{background:showRaise?'linear-gradient(160deg,#d4a017,#f4c430)':'linear-gradient(160deg,#78350f,#92400e)',color:showRaise?'#000':'#fcd34d',border:showRaise?'2px solid #f4c430':'2px solid #b45309',borderRadius:14,padding:'.9rem .5rem',cursor:'pointer',fontWeight:800,fontSize:'.9rem',transition:'all .15s'}}>{showRaise?'▼ Cancel':'▲ Raise'}</button>
      </div>
      <button onClick={onAllIn} style={{width:'100%',marginTop:'.5rem',background:'transparent',border:'1px dashed #7c3aed',color:'#a78bfa',borderRadius:10,padding:'.42rem',cursor:'pointer',fontWeight:700,fontSize:'.8rem'}}>⚡ ALL IN — {chips.toLocaleString()} chips</button>
    </div>
  </div>;
}

function GameOverScreen({tableFinished,myIdx,players,initialChips,onPlayAgain,onGoHome}){
  const results=tableFinished?.results||[];
  const sorted=[...results].sort((a,b)=>Number(b.chips)-Number(a.chips));
  const me=results[myIdx]||players?.[myIdx];
  const myFinal=Number(me?.chips||0),myNet=myFinal-(initialChips||100),won=myNet>0;
  return <div className="fade-in" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'#0f172a',padding:'2rem',gap:'1.25rem'}}>
    <AnimStyles/>
    <div style={{fontSize:'3.5rem'}}>{won?'🏆':myNet===0?'🤝':'😔'}</div>
    <div style={{fontSize:'1.5rem',fontWeight:800,color:won?'#f4c430':myNet===0?'#94a3b8':'#ef4444'}}>{won?'You Won!':myNet===0?'Break Even':'Better Luck Next Time'}</div>
    <div style={{background:'#1e293b',borderRadius:16,padding:'1rem 2rem',textAlign:'center',border:`1px solid ${won?'#f4c430':myNet===0?'#475569':'#ef4444'}`}}>
      <div style={{color:'#94a3b8',fontSize:'.8rem',marginBottom:'.25rem'}}>Your result</div>
      <div style={{fontSize:'1.8rem',fontWeight:900,color:won?'#4ade80':myNet===0?'#94a3b8':'#ef4444'}}>{won?'+':''}{myNet} chips</div>
      <div style={{color:'#64748b',fontSize:'.8rem',marginTop:'.2rem'}}>≈ ${(Math.abs(myNet)/CHIPS_PER_USD).toFixed(2)} {won?'won':'lost'}</div>
      {won&&<div style={{color:'#94a3b8',fontSize:'.75rem',marginTop:'.35rem'}}>Winnings paid on-chain automatically</div>}
    </div>
    <div style={{width:'100%',maxWidth:360,background:'#1e293b',borderRadius:16,border:'1px solid #334155',overflow:'hidden'}}>
      <div style={{padding:'.6rem 1rem',borderBottom:'1px solid #334155',color:'#94a3b8',fontSize:'.8rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>Final Standings</div>
      {sorted.map((r,i)=>{const net=Number(r.chips)-(initialChips||100);return <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.6rem 1rem',borderBottom:i<sorted.length-1?'1px solid #1e293b':'none',background:i===0?'rgba(244,196,48,.06)':'transparent'}}>
        <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}><span style={{fontSize:'1rem'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
          <div><div style={{fontWeight:600,fontSize:'.88rem',color:r.isBot?'#64748b':'#e2e8f0'}}>{r.isBot?'🤖 ':''}{r.name}</div>
          <div style={{fontSize:'.7rem',color:net>0?'#4ade80':net<0?'#ef4444':'#64748b'}}>{net>0?'+':''}{net} chips</div></div>
        </div>
        <div style={{color:'#f4c430',fontWeight:700,fontSize:'.88rem'}}>{Number(r.chips).toLocaleString()}</div>
      </div>;})}
    </div>
    <div style={{display:'flex',gap:'.75rem',width:'100%',maxWidth:360}}>
      <button onClick={onGoHome} style={{flex:1,background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',borderRadius:12,padding:'.85rem',cursor:'pointer',fontWeight:700}}>Home</button>
      <button onClick={onPlayAgain} style={{flex:2,background:'linear-gradient(135deg,#f4c430,#d4a017)',color:'#000',border:'none',borderRadius:12,padding:'.85rem',cursor:'pointer',fontWeight:800,fontSize:'1rem'}}>Play Again →</button>
    </div>
  </div>;
}

// ── Transaction modal ─────────────────────────────────────────────────────────
function TxModal({status,buyIn,onClose}){
  if(!status||status==='done') return null;
  const steps = [
    {key:'approving', label:'Approve cUSD Spend',  desc:'Allow the contract to use your cUSD',  icon:'🔓'},
    {key:'joining',   label:'Lock Buy-in On-Chain', desc:`$${buyIn?.toFixed(2)} cUSD locked in escrow`, icon:'🔒'},
  ];
  const currentIdx = steps.findIndex(s=>s.key===status);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:500,padding:'1.5rem'}}>
      <div className="fade-in" style={{background:'#0f172a',borderRadius:20,padding:'1.5rem',
        width:'100%',maxWidth:360,border:'1px solid #1e293b',textAlign:'center'}}>
        <div style={{fontSize:'2rem',marginBottom:'.75rem'}}>⛓</div>
        <div style={{fontWeight:800,color:'#f4c430',fontSize:'1.1rem',marginBottom:'.5rem'}}>
          Joining Table
        </div>
        <div style={{color:'#64748b',fontSize:'.82rem',marginBottom:'1.25rem'}}>
          Confirm transactions in your wallet
        </div>
        {steps.map((s,i)=>(
          <div key={s.key} style={{display:'flex',alignItems:'center',gap:'.75rem',
            padding:'.65rem .85rem',borderRadius:12,marginBottom:'.5rem',
            background:i===currentIdx?'rgba(244,196,48,.08)':i<currentIdx?'rgba(74,222,128,.06)':'#1e293b',
            border:`1px solid ${i===currentIdx?'#f4c430':i<currentIdx?'#4ade80':'#334155'}`}}>
            <div style={{fontSize:'1.2rem',flexShrink:0}}>{i<currentIdx?'✅':i===currentIdx?'⏳':s.icon}</div>
            <div style={{textAlign:'left'}}>
              <div style={{fontWeight:700,fontSize:'.88rem',
                color:i===currentIdx?'#f4c430':i<currentIdx?'#4ade80':'#64748b'}}>{s.label}</div>
              <div style={{fontSize:'.72rem',color:'#475569'}}>{s.desc}</div>
            </div>
          </div>
        ))}
        {status==='error'&&<div style={{marginTop:'.75rem'}}>
          <div style={{color:'#f87171',fontSize:'.85rem',marginBottom:'.75rem'}}>Transaction failed or rejected</div>
          <button onClick={onClose} style={{background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',
            borderRadius:10,padding:'.6rem 1.25rem',cursor:'pointer',fontWeight:700}}>Close</button>
        </div>}
        <div style={{marginTop:'1rem',color:'#334155',fontSize:'.72rem'}}>
          Celo Mainnet · Gas paid in CELO
        </div>
      </div>
    </div>
  );
}

function HandToast({event,players,onDismiss}){
  useEffect(()=>{if(event){const t=setTimeout(onDismiss,5500);return()=>clearTimeout(t);}},[event,onDismiss]);
  if(!event||event.type!=='hand_complete')return null;
  const winners=event.winners||[];
  return <div className="fade-in" style={{position:'fixed',bottom:'7.5rem',left:'50%',transform:'translateX(-50%)',background:'#1e293b',border:'1px solid #f4c430',borderRadius:16,padding:'.85rem 1.25rem',zIndex:400,minWidth:250,boxShadow:'0 8px 32px rgba(0,0,0,.6)',textAlign:'center'}}>
    <div style={{color:'#f4c430',fontWeight:800,marginBottom:'.4rem'}}>Hand Complete</div>
    {event.ranked?.slice(0,3).map(r=><div key={r.playerIdx} style={{display:'flex',justifyContent:'space-between',gap:'1rem',fontSize:'.82rem',padding:'.15rem 0',color:winners.includes(r.playerIdx)?'#4ade80':'#64748b'}}>
      <span style={{fontWeight:600}}>{players?.[r.playerIdx]?.name||'P'+r.playerIdx}</span>
      <span>{r.handName}</span>
      {winners.includes(r.playerIdx)&&<span style={{color:'#f4c430',fontWeight:800}}>+{Number(event.payouts?.[r.playerIdx]||0).toLocaleString()}</span>}
    </div>)}
  </div>;
}

function Countdown({startAt}){const [secs,setSecs]=useState(0);useEffect(()=>{const tick=()=>setSecs(Math.max(0,Math.round((startAt-Date.now())/1000)));tick();const t=setInterval(tick,500);return()=>clearInterval(t);},[startAt]);const m=Math.floor(secs/60),s=secs%60;return <span style={{fontVariantNumeric:'tabular-nums'}}>{m}:{s.toString().padStart(2,'0')}</span>;}

let _socket=null,_socketTableId=null;
function useSocket(tableId){
  const [gs,setGs]=useState(null);
  const [holeCards,setHoleCards]=useState([]);
  const [lastEvent,setLastEvent]=useState(null);
  const [live,setLive]=useState(false);
  const [myPlayerIdx,setMyPlayerIdx]=useState(-1);
  const gsRef=useRef(null),hcRef=useRef([]),mpRef=useRef(-1);

  useEffect(()=>{
    if(!tableId)return;
    if(_socket&&_socketTableId===tableId&&_socket.connected){setLive(true);if(gsRef.current)setGs(gsRef.current);if(hcRef.current.length)setHoleCards(hcRef.current);if(mpRef.current>=0)setMyPlayerIdx(mpRef.current);return;}
    if(_socket){_socket.disconnect();_socket=null;}
    const s=io(SERVER,{transports:['websocket','polling'],reconnection:true,reconnectionDelay:1000,reconnectionAttempts:20,timeout:10000});
    _socket=s;_socketTableId=tableId;
    s.on('connect',()=>{setLive(true);s.emit('get_state',{tableId});});
    s.on('disconnect',()=>setLive(false));
    s.on('game_state',({state})=>{gsRef.current=state;setGs(state);});
    s.on('hand_started',d=>{hcRef.current=[];setHoleCards([]);setLastEvent({type:'hand_started',...d});setTimeout(()=>s.connected&&s.emit('get_cards',{tableId}),400);});
    s.on('hole_cards',({cards})=>{hcRef.current=cards||[];setHoleCards(cards||[]);});
    s.on('street_dealt',d=>setLastEvent({type:'street_dealt',...d}));
    s.on('player_action',d=>setLastEvent({type:'player_action',...d}));
    s.on('hand_complete',d=>setLastEvent({type:'hand_complete',...d}));
    s.on('table_finished',d=>setLastEvent({type:'table_finished',...d}));
    s.on('join_ok',({playerIdx,tableId:tid})=>{if(playerIdx!==undefined&&playerIdx>=0){mpRef.current=playerIdx;setMyPlayerIdx(playerIdx);setTimeout(()=>s.connected&&s.emit('get_cards',{tableId:tid||tableId}),500);}});
    return()=>{};
  },[tableId]);
  useEffect(()=>()=>{if(_socket&&_socketTableId===tableId){_socket.disconnect();_socket=null;_socketTableId=null;}},[]);
  const send=useCallback((type,amount)=>{const p={tableId,type};if(amount!=null)p.amount=String(amount);_socket?.emit('action',p);},[tableId]);
  const join=useCallback(opts=>_socket?.emit('join_table',opts),[]);
  return{gs,holeCards,lastEvent,live,send,join,myPlayerIdx};
}

// ── Contract ABI fragments ────────────────────────────────────────────────────
const CUSD_ABI_FRAG = [
  {name:'approve',type:'function',stateMutability:'nonpayable',
   inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],
   outputs:[{name:'',type:'bool'}]},
  {name:'balanceOf',type:'function',stateMutability:'view',
   inputs:[{name:'account',type:'address'}],outputs:[{name:'',type:'uint256'}]},
];
const ESCROW_ABI_FRAG = [
  {name:'joinTable',type:'function',stateMutability:'nonpayable',
   inputs:[{name:'tableId',type:'uint256'},{name:'amount',type:'uint256'}],outputs:[]},
];

// Encode function call without ethers (pure hex)
function encodeFn(sig, ...args) {
  // Simple ABI encoder for uint256 and address
  const keccak = (s) => {
    // Use browser crypto — not available, use fetch to encode via eth_call trick
    // Instead just return null and let the wallet handle it via eth_sendTransaction data
    return null;
  };
  return null;
}

function useMiniPay(){
  const [address,setAddress]=useState(null);
  const [isMiniPay,setIsMiniPay]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [txStatus,setTxStatus]=useState(null); // null|'approving'|'joining'|'done'|'error'

  const connect=useCallback(async()=>{
    if(typeof window==='undefined'||!window.ethereum){setError('No wallet found.');return null;}
    setLoading(true);setError(null);
    try{setIsMiniPay(!!window.ethereum.isMiniPay);const a=await window.ethereum.request({method:'eth_requestAccounts',params:[]});setAddress(a[0]);return a[0];}
    catch(e){setError(e.message);return null;}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{if(typeof window!=='undefined'&&window.ethereum?.isMiniPay)connect();},[connect]);

  // Approve cUSD spend + joinTable on contract
  const buyIn = useCallback(async(onChainTableId, amountUSD, playerAddress) => {
    if(!window.ethereum || !playerAddress) return { ok:false, error:'No wallet' };
    const CUSD    = process.env.NEXT_PUBLIC_CUSD_ADDRESS    || '0x765DE816845861e75A25fCA122bb6898B8B1282a';
    const CONTRACT= process.env.NEXT_PUBLIC_CONTRACT_ADDRESS|| '0x4EdB68a7EE036D7438f6E8fcBE43b35539e55Ec3';

    // Amount in wei (18 decimals)
    const amtWei = BigInt(Math.round(amountUSD * 1e18)).toString(16).padStart(64,'0');
    const tableIdHex = BigInt(onChainTableId).toString(16).padStart(64,'0');

    // approve(CONTRACT, amount) selector = 0x095ea7b3
    const approveData = '0x095ea7b3' + CONTRACT.toLowerCase().replace('0x','').padStart(64,'0') + amtWei;
    // joinTable(tableId, amount) selector = 0x17f12247
    const joinData    = '0x17f12247' + tableIdHex + amtWei;

    try {
      setTxStatus('approving');
      const approveTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: playerAddress, to: CUSD, data: approveData }],
      });
      // Wait for approve
      await waitForTx(approveTx);

      setTxStatus('joining');
      const joinTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: playerAddress, to: CONTRACT, data: joinData }],
      });
      await waitForTx(joinTx);

      setTxStatus('done');
      return { ok:true, hash:joinTx };
    } catch(e) {
      setTxStatus('error');
      return { ok:false, error: e.message };
    }
  },[]);

  return{address,isMiniPay,loading,error,connect,buyIn,txStatus,setTxStatus};
}

async function waitForTx(hash, maxWait=30000) {
  const start = Date.now();
  while(Date.now()-start < maxWait) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt', params:[hash]
      });
      if(receipt && receipt.status) return receipt;
    } catch {}
    await new Promise(r=>setTimeout(r,2000));
  }
}

function GameTable({tableId,address,username,humanPlayerId,buyInUSD,onBack,onPlayAgain}){
  const{gs,holeCards,lastEvent,live,send,join,myPlayerIdx:sockIdx}=useSocket(tableId);
  const [info,setInfo]=useState(null);
  const [anim,setAnim]=useState({});
  const [toast,setToast]=useState(null);
  const [gameOver,setGameOver]=useState(null);
  const [timer,setTimer]=useState(30);
  const prevRef=useRef(null),timerRef=useRef(null),joinedRef=useRef(false),initChips=useRef(100);

  useEffect(()=>{const f=()=>fetch(`${SERVER}/tables/${tableId}`).then(r=>r.json()).then(setInfo).catch(()=>{});f();const t=setInterval(()=>{if(!gs)f();},1500);return()=>clearInterval(t);},[tableId,gs]);
  useEffect(()=>{if(joinedRef.current)return;joinedRef.current=true;setTimeout(()=>{join({tableId,name:username,address:address||('0xDEV_'+Math.random().toString(36).slice(2,8)),buyInUSD:buyInUSD||0.2,humanPlayerId});},600);},[]);
  useEffect(()=>{if(!gs)return;clearInterval(timerRef.current);setTimer(30);timerRef.current=setInterval(()=>setTimer(t=>t<=1?(clearInterval(timerRef.current),0):t-1),1000);return()=>clearInterval(timerRef.current);},[gs?.actionIdx,gs?.state]);

  useEffect(()=>{
    if(!gs)return;
    const prev=prevRef.current;
    if(prev){
      if(prev.state!=='PREFLOP'&&gs.state==='PREFLOP'){const n={};gs.players.forEach((_,i)=>{n[i]='dealing';});setAnim(n);setTimeout(()=>setAnim(cur=>{const x={...cur};Object.keys(x).forEach(k=>{if(x[k]==='dealing')x[k]='idle';});return x;}),700);}
      gs.players.forEach((p,i)=>{if(!prev.players?.[i]?.folded&&p.folded){const fc=(SEATS[gs.players.length]||SEATS[4])[i]?.fold||'fold-up';setAnim(cur=>({...cur,[i]:fc}));setTimeout(()=>setAnim(cur=>({...cur,[i]:'hidden'})),400);}});
    } else {const init={};gs.players.forEach((p,i)=>{init[i]=p.folded?'hidden':'idle';});setAnim(init);}
    prevRef.current=gs;
  },[gs]);

  useEffect(()=>{if(lastEvent?.type==='hand_complete')setToast(lastEvent);if(lastEvent?.type==='table_finished')setGameOver(lastEvent);},[lastEvent]);

  const players=gs?.players||info?.players||[];
  const board=gs?.board||[],pot=gs?.pot||'0',street=gs?.state||'',actionIdx=gs?.actionIdx??-1,numP=players.length||4;
  const myIdx=sockIdx>=0?sockIdx:(address?players.findIndex(p=>p.address?.toLowerCase()===address?.toLowerCase()):-1);
  const isMyTurn=myIdx>=0&&actionIdx===myIdx&&!['FINISHED','SHOWDOWN','WAITING',''].includes(street);
  const myPlayer=myIdx>=0?players[myIdx]:null;
  const toCall=myPlayer?Math.max(0,Number(gs?.currentBet||0)-Number(myPlayer.bet||0)):0;

  if(gameOver)return <GameOverScreen tableFinished={gameOver} myIdx={myIdx} players={players} initialChips={initChips.current} onPlayAgain={onPlayAgain} onGoHome={onBack}/>;

  return <div style={{display:'flex',flexDirection:'column',minHeight:'100dvh',background:'#0f172a'}}>
    <AnimStyles/>
    <div style={{padding:'.6rem 1rem',background:'#111827',borderBottom:'1px solid #1e293b',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
        <button onClick={onBack} style={{background:'none',border:'1px solid #334155',color:'#64748b',borderRadius:8,padding:'.2rem .6rem',cursor:'pointer',fontSize:'.8rem'}}>← Back</button>
        <span style={{color:'#f4c430',fontWeight:700}}>♠ {info?.name||'Table'}</span>
      </div>
      <div style={{display:'flex',gap:'.4rem',alignItems:'center'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:live?'#4ade80':'#f59e0b',boxShadow:live?'0 0 6px #4ade80':'none'}}/>
        <span style={{color:info?.state==='RUNNING'?'#4ade80':'#fbbf24',background:info?.state==='RUNNING'?'#14532d':'#78350f',padding:'.15rem .45rem',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>{info?.state||'...'}</span>
        <span style={{color:'#475569',fontSize:'.78rem'}}>{numP}/6</span>
      </div>
    </div>
    {info?.state==='LOBBY'&&info?.startAt&&<div style={{background:'linear-gradient(135deg,#14532d,#166534)',padding:'1rem',textAlign:'center',flexShrink:0}}>
      <div style={{color:'#86efac',fontSize:'.8rem'}}>Game starts in</div>
      <div style={{color:'#fff',fontSize:'2.4rem',fontWeight:800}}><Countdown startAt={info.startAt}/></div>
      <div style={{color:'#86efac',fontSize:'.8rem',marginTop:'.2rem'}}>{numP} players seated</div>
    </div>}
    {info?.state==='LOBBY'&&!info?.startAt&&<div style={{padding:'.7rem',textAlign:'center',background:'#78350f',color:'#fbbf24',fontSize:'.85rem',flexShrink:0}}>⏳ Need {Math.max(0,3-numP)} more player{3-numP!==1?'s':''} to start...</div>}
    {isMyTurn&&<div className="my-turn-glow" style={{background:'rgba(52,211,153,.15)',borderBottom:'1px solid rgba(52,211,153,.3)',padding:'.45rem',textAlign:'center',flexShrink:0,color:'#34d399',fontWeight:800,fontSize:'.88rem',letterSpacing:'.04em'}}>🟢 YOUR TURN</div>}
    <div style={{flex:1,position:'relative',background:'radial-gradient(ellipse at center,#1a6b3a 60%,#145230 100%)',border:'6px solid #8B6914',borderRadius:48,margin:'.6rem',display:'flex',alignItems:'center',justifyContent:'center',minHeight:260,overflow:'visible'}}>
      {players.map((_,i)=><SeatCards key={i} idx={i} numP={numP} anim={anim[i]}/>)}
      <div style={{position:'absolute',bottom:'28%',left:'38%',width:26,height:26,borderRadius:'50%',background:'#fff',color:'#000',fontWeight:900,fontSize:'.7rem',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #9ca3af',zIndex:6,boxShadow:'0 2px 6px rgba(0,0,0,.5)'}}>D</div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'.4rem',zIndex:2}}>
        <div style={{display:'flex',gap:'.3rem'}}>{[0,1,2,3,4].map(i=><FaceCard key={i} card={board[i]??null} animate={!!board[i]}/>)}</div>
        {Number(pot)>0&&<div style={{background:'rgba(0,0,0,.4)',borderRadius:20,padding:'.25rem .8rem',display:'flex',gap:'.4rem',alignItems:'center'}}><span style={{fontSize:'.65rem',color:'rgba(255,255,255,.5)',textTransform:'uppercase'}}>Pot</span><span style={{fontWeight:800,color:'#f4c430',fontSize:'.95rem'}}>{Number(pot).toLocaleString()}</span></div>}
        {street&&!['WAITING','FINISHED',''].includes(street)&&<div style={{background:'rgba(0,0,0,.45)',borderRadius:12,padding:'.12rem .55rem',fontSize:'.65rem',color:'rgba(255,255,255,.65)',textTransform:'uppercase',letterSpacing:'.08em'}}>{street}</div>}
      </div>
      {myIdx>=0&&holeCards.length===2&&<div style={{position:'absolute',bottom:'-38px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,zIndex:10}}><FaceCard card={holeCards[0]} small/><FaceCard card={holeCards[1]} small/></div>}
    </div>
    <div style={{padding:'0 .75rem .5rem',display:'flex',flexDirection:'column',gap:'.3rem'}}>
      {players.map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.5rem .85rem',background:actionIdx===i?'rgba(52,211,153,.08)':'#1e293b',borderRadius:10,border:actionIdx===i?'1px solid #34d399':i===myIdx?'1px solid #f4c430':'1px solid #334155',opacity:p.folded?.35:1,transition:'all .2s'}}>
        <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}><span>{p.isBot?'🤖':'👤'}</span>
          <div><div style={{fontWeight:600,fontSize:'.82rem',color:i===myIdx?'#f4c430':'#e2e8f0'}}>{p.name}{i===myIdx&&<span style={{fontSize:'.68rem',color:'#64748b'}}> (you)</span>}</div>
          {actionIdx===i&&<div style={{color:'#34d399',fontSize:'.65rem',fontWeight:700}}>▶ Acting...</div>}
          {p.folded&&<div style={{color:'#ef4444',fontSize:'.65rem'}}>folded</div>}</div>
        </div>
        <div style={{textAlign:'right'}}><div style={{color:p.chips==='0'?'#475569':'#f4c430',fontWeight:700,fontSize:'.82rem'}}>{Number(p.chips).toLocaleString()}</div>
        {Number(p.bet)>0&&<div style={{color:'#60a5fa',fontSize:'.68rem'}}>bet {Number(p.bet)}</div>}
        {p.allIn&&<div style={{color:'#a78bfa',fontSize:'.67rem',fontWeight:700}}>ALL IN</div>}</div>
      </div>)}
    </div>
    <ActionBar isMyTurn={isMyTurn} canCheck={toCall===0} toCall={toCall} myChips={myPlayer?.chips} pot={pot} timer={timer} onFold={()=>send('fold')} onCheck={()=>send('check')} onCall={()=>send('call')} onRaise={a=>send('raise',a)} onAllIn={()=>send('allin')}/>
    <HandToast event={toast} players={players} onDismiss={()=>setToast(null)}/>
  </div>;
}

// ── DIFFICULTY SELECTOR ────────────────────────────────────────────────────────
function DifficultyModal({username,address,wallet,onStarted,onClose}){
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(null);

  const [txStatus,setTxStatus]=useState(null);

  const start=async(diff)=>{
    setLoading(diff.id);
    try{
      // 1. Create the table and get on-chain table ID
      const r=await fetch(`${SERVER}/rooms/create`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hostName:username,difficulty:diff.id,address:address||'0xDEV'})});
      const d=await r.json();
      if(!d.tableId) throw new Error('No tableId');

      // 2. If real wallet connected, trigger on-chain buy-in
      if(address && window.ethereum && wallet) {
        const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS||'0x4EdB68a7EE036D7438f6E8fcBE43b35539e55Ec3';
        const CUSD     = process.env.NEXT_PUBLIC_CUSD_ADDRESS    ||'0x765DE816845861e75A25fCA122bb6898B8B1282a';

        // We need the on-chain tableId — backend returns it if available
        // For now, trigger approve+join flow if wallet exists
        if(wallet.buyIn) {
          const txResult = await wallet.buyIn(d.onChainTableId||1, diff.buyIn, address);
          if(!txResult.ok && txResult.error !== 'No wallet') {
            console.warn('TX failed:', txResult.error);
            // Continue anyway for dev mode
          }
        }
      }

      onStarted(d.tableId,d.humanPlayerId,diff.buyIn,diff);
    }catch(e){console.error(e);}
    finally{setLoading(null);setTxStatus(null);}
  };

  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}}>
    <div className="fade-in" style={{background:'#0f172a',borderTopLeftRadius:24,borderTopRightRadius:24,padding:'1.5rem',width:'100%',maxWidth:480,border:'1px solid #1e293b'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
        <div style={{fontWeight:800,fontSize:'1.1rem',color:'#f4c430'}}>🎮 Choose Difficulty</div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:'1.2rem'}}>✕</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'.6rem'}}>
        {DIFFICULTIES.map(d=><button key={d.id} onClick={()=>start(d)} disabled={!!loading} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.85rem 1rem',background:selected===d.id?`${d.bg}`:
          '#1e293b',border:`1px solid ${selected===d.id?d.color:'#334155'}`,borderRadius:14,cursor:'pointer',transition:'all .15s',opacity:loading&&loading!==d.id?.5:1}}>
          <span style={{fontSize:'1.6rem'}}>{loading===d.id?'⏳':d.emoji}</span>
          <div style={{flex:1,textAlign:'left'}}>
            <div style={{fontWeight:800,color:d.color,fontSize:'1rem'}}>{d.label}</div>
            <div style={{color:'#64748b',fontSize:'.78rem'}}>{d.desc}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#f4c430',fontWeight:800,fontSize:'.95rem'}}>${d.buyIn.toFixed(2)}</div>
            <div style={{color:'#475569',fontSize:'.7rem'}}>buy-in</div>
          </div>
        </button>)}
      </div>
      <div style={{marginTop:'1rem',textAlign:'center',color:'#334155',fontSize:'.75rem'}}>You play vs 3 bots · 90% to winner · On-chain</div>
    </div>
  </div>;
}

// ── PRIVATE ROOM MODAL ────────────────────────────────────────────────────────
function PrivateRoomModal({username,address,onStarted,onClose}){
  const [mode,setMode]=useState(null); // 'create' | 'join'
  const [code,setCode]=useState('');
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [created,setCreated]=useState(null);

  const createRoom=async()=>{
    setLoading(true);setErr('');
    try{
      const r=await fetch(`${SERVER}/rooms/create`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hostName:username,difficulty:'private',address:address||'0xDEV'})});
      const d=await r.json();
      setCreated(d);
    }catch{setErr('Could not create room');}
    finally{setLoading(false);}
  };

  const joinRoom=async()=>{
    if(!code.trim()){setErr('Enter a room code');return;}
    setLoading(true);setErr('');
    try{
      const r=await fetch(`${SERVER}/rooms/${code.trim()}`);
      const d=await r.json();
      if(!d.found){setErr('Room not found. Check the code.');return;}
      onStarted(d.tableId,null,d.buyInUSD||0.2,{label:'Private',id:'private'});
    }catch{setErr('Could not connect');}
    finally{setLoading(false);}
  };

  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200}}>
    <div className="fade-in" style={{background:'#0f172a',borderTopLeftRadius:24,borderTopRightRadius:24,padding:'1.5rem',width:'100%',maxWidth:480,border:'1px solid #1e293b'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
        <div style={{fontWeight:800,fontSize:'1.1rem',color:'#f4c430'}}>🔒 Private Room</div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:'1.2rem'}}>✕</button>
      </div>

      {!mode&&!created&&<div style={{display:'flex',gap:'.75rem'}}>
        <button onClick={()=>setMode('create')} style={{flex:1,background:'#1e293b',border:'1px solid #334155',color:'#e2e8f0',borderRadius:14,padding:'1.25rem',cursor:'pointer',fontWeight:700,fontSize:'.95rem'}}>
          <div style={{fontSize:'1.5rem',marginBottom:'.4rem'}}>🏠</div>Create Room
        </button>
        <button onClick={()=>setMode('join')} style={{flex:1,background:'#1e293b',border:'1px solid #334155',color:'#e2e8f0',borderRadius:14,padding:'1.25rem',cursor:'pointer',fontWeight:700,fontSize:'.95rem'}}>
          <div style={{fontSize:'1.5rem',marginBottom:'.4rem'}}>🚪</div>Join Room
        </button>
      </div>}

      {mode==='create'&&!created&&<div>
        <div style={{color:'#94a3b8',fontSize:'.85rem',marginBottom:'1rem'}}>Create a private room and share the code with friends to invite them.</div>
        <button onClick={createRoom} disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#f4c430,#d4a017)',color:'#000',border:'none',borderRadius:12,padding:'1rem',cursor:'pointer',fontWeight:800,fontSize:'1rem'}}>
          {loading?'Creating...':'Create Room →'}
        </button>
      </div>}

      {created&&<div style={{textAlign:'center'}}>
        <div style={{color:'#86efac',fontSize:'.85rem',marginBottom:'.75rem'}}>✅ Room created! Share this code:</div>
        <div style={{background:'#1e293b',borderRadius:16,padding:'1.25rem',border:'2px solid #f4c430',marginBottom:'1rem'}}>
          <div style={{fontSize:'2.2rem',fontWeight:900,color:'#f4c430',letterSpacing:'.2em'}}>{created.code}</div>
          <div style={{color:'#64748b',fontSize:'.75rem',marginTop:'.25rem'}}>Share with friends to join</div>
        </div>
        <button onClick={()=>{ navigator.clipboard?.writeText(created.code); }} style={{background:'#334155',color:'#e2e8f0',border:'none',borderRadius:10,padding:'.6rem 1.25rem',cursor:'pointer',fontWeight:700,marginBottom:'1rem',fontSize:'.9rem'}}>📋 Copy Code</button>
        <br/>
        <button onClick={()=>onStarted(created.tableId,created.humanPlayerId,created.buyInUSD||0.2,{label:'Private',id:'private'})} style={{width:'100%',background:'linear-gradient(135deg,#f4c430,#d4a017)',color:'#000',border:'none',borderRadius:12,padding:'1rem',cursor:'pointer',fontWeight:800,fontSize:'1rem'}}>Enter Room →</button>
      </div>}

      {mode==='join'&&<div>
        <div style={{color:'#94a3b8',fontSize:'.85rem',marginBottom:'.75rem'}}>Enter the 6-character code shared by your friend.</div>
        <div style={{display:'flex',gap:'.5rem',marginBottom:'.75rem'}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,6))} placeholder="ABC123" maxLength={6}
            style={{flex:1,background:'#1e293b',border:'1px solid #334155',borderRadius:12,padding:'.85rem',color:'#e2e8f0',fontSize:'1.2rem',textAlign:'center',letterSpacing:'.2em',fontWeight:700,outline:'none'}}
            onKeyDown={e=>e.key==='Enter'&&joinRoom()}/>
          <button onClick={joinRoom} disabled={loading||code.length<6} style={{background:'#f4c430',color:'#000',border:'none',borderRadius:12,padding:'.85rem 1.25rem',cursor:'pointer',fontWeight:800,fontSize:'1rem',opacity:code.length<6?.5:1}}>
            {loading?'...':'Join'}
          </button>
        </div>
      </div>}

      {err&&<div style={{color:'#f87171',fontSize:'.82rem',textAlign:'center',marginTop:'.5rem'}}>{err}</div>}
      {mode&&!created&&<button onClick={()=>{setMode(null);setErr('');}} style={{width:'100%',marginTop:'.75rem',background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:'.85rem'}}>← Back</button>}
    </div>
  </div>;
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────
function Lobby({address,username,wallet,onJoined}){
  const [tables,setTables]=useState([]);
  const [leaderboard,setLeaderboard]=useState([]);
  const [stats,setStats]=useState(null);
  const [activeTab,setActiveTab]=useState('play');
  const [showDifficulty,setShowDifficulty]=useState(false);
  const [showPrivate,setShowPrivate]=useState(false);
  const [voucherCode,setVoucherCode]=useState('');
  const [voucherMsg,setVoucherMsg]=useState(null);

  useEffect(()=>{const f=()=>fetch(`${SERVER}/tables`).then(r=>r.json()).then(setTables).catch(()=>{});f();const t=setInterval(f,2500);return()=>clearInterval(t);},[]);
  useEffect(()=>{fetch(`${SERVER}/leaderboard`).then(r=>r.json()).then(setLeaderboard).catch(()=>{});if(address)fetch(`${SERVER}/stats/${address}`).then(r=>r.json()).then(setStats).catch(()=>{});},[address]);

  const redeemVoucher=async()=>{
    if(!voucherCode.trim())return;
    try{const r=await fetch(`${SERVER}/vouchers/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:voucherCode.trim(),address:address||'0xGUEST'})});const d=await r.json();setVoucherMsg(d.ok?{ok:true,text:`🎉 ${d.message}`}:{ok:false,text:`❌ ${d.error}`});}
    catch{setVoucherMsg({ok:false,text:'Server unreachable'});}
  };

  const tabStyle=(t)=>({flex:1,padding:'.65rem',border:'none',cursor:'pointer',fontWeight:700,fontSize:'.82rem',background:activeTab===t?'#1e293b':'transparent',color:activeTab===t?'#f4c430':'#64748b',borderBottom:activeTab===t?'2px solid #f4c430':'2px solid transparent',transition:'all .15s'});

  return <div style={{display:'flex',flexDirection:'column',minHeight:'100dvh',background:'#0a0f1a'}}>
    <AnimStyles/>

    {/* Header */}
    <div style={{background:'linear-gradient(135deg,#0f172a,#1a0f2e)',borderBottom:'1px solid #1e293b',padding:'1.25rem 1.25rem .75rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'.85rem'}}>
        <div>
          <div style={{fontSize:'1.6rem',fontWeight:900,color:'#f4c430',letterSpacing:'-.02em'}}>♠ CeloPoker</div>
          <div style={{fontSize:'.78rem',color:'#334155',marginTop:'.1rem'}}>No-Limit Texas Hold'em · Celo Mainnet</div>
        </div>
        <div style={{textAlign:'right'}}>
          {address?<><div style={{background:'#14532d',color:'#4ade80',padding:'.25rem .6rem',borderRadius:20,fontSize:'.72rem',fontWeight:700,marginBottom:'.2rem'}}>🟢 Connected</div><div style={{color:'#475569',fontSize:'.7rem'}}>{address.slice(0,6)}...{address.slice(-4)}</div></>
          :<div style={{background:'#1e293b',color:'#64748b',padding:'.25rem .6rem',borderRadius:20,fontSize:'.72rem',fontWeight:700}}>No Wallet</div>}
        </div>
      </div>

      {/* Personal stats */}
      {stats&&stats.sessions>0&&<div style={{display:'flex',gap:'.6rem',marginBottom:'.75rem'}}>
        {[{l:'Net P&L',v:`${stats.netUSD>=0?'+':''}$${stats.netUSD?.toFixed(2)||'0.00'}`,c:stats.netUSD>=0?'#4ade80':'#ef4444'},{l:'Won',v:`$${stats.totalWonUSD?.toFixed(2)||'0.00'}`,c:'#f4c430'},{l:'Games',v:stats.sessions||0,c:'#94a3b8'}]
          .map(s=><div key={s.l} style={{flex:1,background:'rgba(255,255,255,.04)',borderRadius:10,padding:'.5rem .5rem',textAlign:'center',border:'1px solid #1e293b'}}><div style={{color:s.c,fontWeight:800,fontSize:'.9rem'}}>{s.v}</div><div style={{color:'#334155',fontSize:'.65rem'}}>{s.l}</div></div>)}
      </div>}

      {/* Quick facts */}
      <div style={{display:'flex',gap:'.4rem',overflowX:'auto',paddingBottom:'.1rem'}}>
        {[['💰','Min $0.10'],['🏆','90% payout'],['⏱','1 min start'],['🎮','3-6 players'],['🔒','On-chain']].map(([i,t])=><div key={t} style={{background:'rgba(244,196,48,.07)',border:'1px solid rgba(244,196,48,.12)',borderRadius:20,padding:'.25rem .65rem',display:'flex',alignItems:'center',gap:'.3rem',whiteSpace:'nowrap',flexShrink:0}}><span style={{fontSize:'.8rem'}}>{i}</span><span style={{fontSize:'.7rem',color:'#64748b',fontWeight:600}}>{t}</span></div>)}
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:'flex',background:'#0f172a',borderBottom:'1px solid #1e293b'}}>
      {[['play','🎮 Play'],['rooms','🌐 Tables'],['leaderboard','🏆 Leaders'],['howto','❓ Rules']].map(([t,l])=><button key={t} style={tabStyle(t)} onClick={()=>setActiveTab(t)}>{l}</button>)}
    </div>

    <div style={{flex:1,padding:'1rem',display:'flex',flexDirection:'column',gap:'.75rem',overflowY:'auto'}}>

      {/* PLAY TAB */}
      {activeTab==='play'&&<>
        <div style={{fontWeight:700,color:'#64748b',fontSize:'.8rem',textTransform:'uppercase',letterSpacing:'.06em'}}>Play vs Bots</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.6rem'}}>
          {DIFFICULTIES.map(d=><button key={d.id} className="slide-up" onClick={()=>setShowDifficulty(true)} style={{background:'#1e293b',border:`1px solid #334155`,borderRadius:14,padding:'1rem',cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
            <div style={{fontSize:'1.6rem',marginBottom:'.35rem'}}>{d.emoji}</div>
            <div style={{fontWeight:800,color:d.color,fontSize:'.95rem'}}>{d.label}</div>
            <div style={{color:'#475569',fontSize:'.72rem',marginBottom:'.35rem'}}>{d.desc}</div>
            <div style={{color:'#f4c430',fontWeight:800,fontSize:'.9rem'}}>${d.buyIn.toFixed(2)}</div>
          </button>)}
        </div>

        <div style={{fontWeight:700,color:'#64748b',fontSize:'.8rem',textTransform:'uppercase',letterSpacing:'.06em',marginTop:'.25rem'}}>Play with Friends</div>
        <button onClick={()=>setShowPrivate(true)} className="slide-up" style={{background:'linear-gradient(135deg,rgba(124,58,237,.2),rgba(124,58,237,.1))',border:'1px solid #7c3aed',borderRadius:14,padding:'1rem 1.25rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'1rem'}}>
          <div style={{fontSize:'1.8rem'}}>🔒</div>
          <div style={{textAlign:'left'}}>
            <div style={{fontWeight:800,color:'#a78bfa',fontSize:'1rem'}}>Private Room</div>
            <div style={{color:'#64748b',fontSize:'.8rem'}}>Create or join with a 6-char code</div>
          </div>
          <div style={{marginLeft:'auto',color:'#7c3aed',fontSize:'1.2rem'}}>→</div>
        </button>

        {/* Voucher */}
        <div style={{background:'#1e293b',borderRadius:14,padding:'1rem',border:'1px solid #334155'}}>
          <div style={{color:'#94a3b8',fontSize:'.82rem',marginBottom:'.6rem',fontWeight:600}}>🎟 Voucher Code</div>
          <div style={{display:'flex',gap:'.5rem'}}>
            <input value={voucherCode} onChange={e=>setVoucherCode(e.target.value.toUpperCase())} placeholder="e.g. CELO2025" maxLength={20}
              style={{flex:1,background:'#0f172a',border:'1px solid #334155',borderRadius:10,padding:'.6rem .75rem',color:'#e2e8f0',fontSize:'.9rem',outline:'none',letterSpacing:'.05em',fontWeight:700}}
              onKeyDown={e=>e.key==='Enter'&&redeemVoucher()}/>
            <button onClick={redeemVoucher} style={{background:'#f4c430',color:'#000',border:'none',borderRadius:10,padding:'.6rem 1rem',cursor:'pointer',fontWeight:800,whiteSpace:'nowrap'}}>Redeem</button>
          </div>
          {voucherMsg&&<div style={{marginTop:'.5rem',fontSize:'.82rem',color:voucherMsg.ok?'#4ade80':'#f87171'}}>{voucherMsg.text}</div>}
        </div>
      </>}

      {/* ROOMS TAB */}
      {activeTab==='rooms'&&<>
        {tables.length===0?<div style={{textAlign:'center',padding:'2.5rem',color:'#334155'}}><div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>🃏</div><div>No open tables</div></div>
        :<div style={{display:'flex',flexDirection:'column',gap:'.6rem'}}>
          {tables.map(t=>{const secs=t.startAt?Math.max(0,Math.round((t.startAt-Date.now())/1000)):null;return <div key={t.tableId} className="slide-up" style={{background:'#1e293b',borderRadius:14,padding:'1rem',border:'1px solid #334155'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.4rem'}}>
              <span style={{fontWeight:700,color:'#e2e8f0'}}>{t.name}</span>
              <span style={{background:t.playerCount>=3?'#78350f':'#14532d',color:t.playerCount>=3?'#fbbf24':'#4ade80',padding:'.2rem .5rem',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>{t.playerCount>=3?'⏱ Starting':'● Open'}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',color:'#64748b',fontSize:'.78rem',marginBottom:'.6rem'}}>
              <span>Min: <strong style={{color:'#f4c430'}}>${t.minBuyInUSD}</strong></span>
              {secs!=null&&<span style={{color:'#fbbf24'}}>{Math.floor(secs/60)}:{(secs%60).toString().padStart(2,'0')}</span>}
              <span>{t.playerCount}/6</span>
            </div>
            <div style={{height:4,background:'#0f172a',borderRadius:2,marginBottom:'.75rem',overflow:'hidden'}}><div style={{height:'100%',background:'linear-gradient(90deg,#f4c430,#d4a017)',width:`${(t.playerCount/6)*100}%`,borderRadius:2}}/></div>
            <button onClick={()=>onJoined(t.tableId,null,t.minBuyInUSD)} style={{width:'100%',background:'linear-gradient(135deg,#f4c430,#d4a017)',color:'#000',border:'none',borderRadius:10,padding:'.7rem',cursor:'pointer',fontWeight:800}}>{address?'Join Table →':'Watch →'}</button>
          </div>;})}
        </div>}
      </>}

      {/* LEADERBOARD TAB */}
      {activeTab==='leaderboard'&&<>
        <div style={{background:'#1e293b',borderRadius:14,border:'1px solid #334155',overflow:'hidden'}}>
          <div style={{padding:'.75rem 1rem',borderBottom:'1px solid #334155',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontWeight:700,color:'#e2e8f0'}}>Top Players</span>
            <span style={{color:'#475569',fontSize:'.75rem'}}>All time</span>
          </div>
          {leaderboard.length===0?<div style={{padding:'2rem',textAlign:'center',color:'#334155'}}>No games played yet</div>
          :leaderboard.map((p,i)=><div key={p.address} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.65rem 1rem',borderBottom:i<leaderboard.length-1?'1px solid #1e293b':'none',background:i===0?'rgba(244,196,48,.05)':'transparent'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
              <span style={{fontSize:'1.1rem'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</span>
              <div><div style={{fontWeight:600,fontSize:'.88rem',color:'#e2e8f0'}}>{p.name}</div><div style={{fontSize:'.7rem',color:'#475569'}}>{p.sessions} games</div></div>
            </div>
            <div style={{textAlign:'right'}}><div style={{color:'#4ade80',fontWeight:800,fontSize:'.9rem'}}>+${p.totalWonUSD}</div><div style={{color:'#475569',fontSize:'.7rem'}}>net ${p.netUSD>=0?'+':''}{p.netUSD}</div></div>
          </div>)}
        </div>
        {address&&stats&&<div style={{background:'#1e293b',borderRadius:14,padding:'1rem',border:'1px solid #334155'}}>
          <div style={{fontWeight:700,color:'#f4c430',marginBottom:'.75rem'}}>Your Stats</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.5rem'}}>
            {[{l:'Games',v:stats.sessions||0},{l:'Won',v:`$${stats.totalWonUSD?.toFixed(2)||'0'}`},{l:'Net',v:`${stats.netUSD>=0?'+':''}$${stats.netUSD?.toFixed(2)||'0'}`}]
              .map(s=><div key={s.l} style={{background:'#0f172a',borderRadius:10,padding:'.6rem',textAlign:'center',border:'1px solid #334155'}}><div style={{fontWeight:800,color:'#e2e8f0',fontSize:'.95rem'}}>{s.v}</div><div style={{color:'#475569',fontSize:'.7rem'}}>{s.l}</div></div>)}
          </div>
        </div>}
      </>}

      {/* HOW TO PLAY TAB */}
      {activeTab==='howto'&&<div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
        {[{icon:'🎯',title:'Objective',text:"Make the best 5-card hand from your 2 hole cards + 5 community cards. Win the pot!"},
          {icon:'🃏',title:'Hand Rankings',text:"Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card"},
          {icon:'⚡',title:'Game Flow',text:"Pre-flop → Flop (3 cards) → Turn (4th) → River (5th) → Showdown. Bet on each street."},
          {icon:'💰',title:'Actions',text:"FOLD: give up. CHECK: pass free. CALL: match bet. RAISE: increase bet. ALL IN: bet everything!"},
          {icon:'🎮',title:'Difficulty Modes',text:"Easy ($0.10) — casual bots. Normal ($0.15) — smart bots. Hard ($0.50) — aggressive. Super ($1) — GTO bots."},
          {icon:'🔒',title:'Private Rooms',text:"Create a private room → get a 6-char code → share with friends → they enter the code to join your table."},
          {icon:'⏱',title:'Timers',text:"30 seconds per action. Game starts 1 minute after 3+ players join. +15s per extra player."},
          {icon:'🏆',title:'Payouts',text:"Winner gets 90% of pot paid in cUSD on Celo mainnet. 10% is the house fee. All automatic, no claiming needed."},
        ].map(item=><div key={item.title} className="slide-up" style={{background:'#1e293b',borderRadius:14,padding:'1rem',border:'1px solid #334155'}}>
          <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.5rem'}}><span style={{fontSize:'1.3rem'}}>{item.icon}</span><span style={{fontWeight:700,color:'#f4c430',fontSize:'.95rem'}}>{item.title}</span></div>
          <div style={{color:'#94a3b8',fontSize:'.85rem',lineHeight:1.5}}>{item.text}</div>
        </div>)}
      </div>}
    </div>

    {showDifficulty&&<DifficultyModal username={username} address={address} wallet={wallet} onStarted={(tid,hpid,buyIn,diff)=>{setShowDifficulty(false);onJoined(tid,hpid,buyIn,diff);}} onClose={()=>setShowDifficulty(false)}/>}
    {showPrivate&&<PrivateRoomModal username={username} address={address} onStarted={(tid,hpid,buyIn,diff)=>{setShowPrivate(false);onJoined(tid,hpid,buyIn,diff);}} onClose={()=>setShowPrivate(false)}/>}
  </div>;
}

// ── CONNECT ───────────────────────────────────────────────────────────────────
function ConnectScreen({wallet,onDone}){
  const [name,setName]=useState('');
  useEffect(()=>{
    const s=localStorage.getItem('poker_username');
    if(s) setName(s);
    // Only auto-connect on MiniPay — desktop users must click the button
    if(wallet.address && wallet.isMiniPay){
      onDone(wallet.address, s||'Player');
    }
  },[wallet.address, wallet.isMiniPay]);
  const handle=async()=>{if(!name.trim())return;localStorage.setItem('poker_username',name.trim());const addr=await wallet.connect();onDone(addr||null,name.trim());};
  return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'linear-gradient(135deg,#0a0f1a 0%,#0f172a 50%,#1a0a2e 100%)',padding:'2rem',gap:'1.5rem',textAlign:'center'}}>
    <AnimStyles/>
    <div style={{fontSize:'4.5rem',filter:'drop-shadow(0 0 20px rgba(244,196,48,.4))'}}>🃏</div>
    <div><div style={{fontSize:'2.2rem',fontWeight:900,color:'#f4c430',letterSpacing:'-.03em',marginBottom:'.25rem'}}>CeloPoker</div>
      <div style={{color:'#475569',fontSize:'.9rem'}}>No-Limit Texas Hold'em</div>
      <div style={{color:'#334155',fontSize:'.8rem',marginTop:'.2rem'}}>Powered by cUSD · Celo Mainnet</div>
    </div>
    {wallet.isMiniPay&&<div style={{background:'#14532d',color:'#4ade80',padding:'.4rem .8rem',borderRadius:20,fontSize:'.82rem',fontWeight:700}}>✓ MiniPay detected</div>}
    <div style={{width:'100%',maxWidth:320,display:'flex',flexDirection:'column',gap:'.75rem'}}>
      <input style={{width:'100%',padding:'.85rem 1rem',background:'#1e293b',border:'1px solid #334155',borderRadius:14,color:'#e2e8f0',fontSize:'1rem',outline:'none',textAlign:'center',letterSpacing:'.02em'}} placeholder="Choose a username" value={name} maxLength={16} autoFocus onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()}/>
      <button onClick={handle} disabled={!name.trim()||wallet.loading} style={{width:'100%',padding:'1rem',background:name.trim()?'linear-gradient(135deg,#f4c430,#d4a017)':'#1e293b',color:name.trim()?'#000':'#475569',border:'none',borderRadius:14,fontWeight:800,fontSize:'1.05rem',cursor:name.trim()?'pointer':'not-allowed',transition:'all .2s'}}>
        {wallet.loading?'Connecting...':(wallet.address?'Enter Lobby →':'Connect Wallet →')}
      </button>
      <button onClick={()=>{const n=name.trim()||'Guest';localStorage.setItem('poker_username',n);onDone(null,n);}} style={{background:'none',border:'none',color:'#475569',fontSize:'.85rem',cursor:'pointer'}}>Continue without wallet (watch only)</button>
    </div>
    {wallet.error&&<div style={{color:'#f87171',fontSize:'.85rem',background:'rgba(239,68,68,.1)',padding:'.5rem 1rem',borderRadius:10}}>⚠ {wallet.error}</div>}
    <div style={{position:'absolute',bottom:'1.5rem',color:'#1e293b',fontSize:'.72rem'}}>Contract: 0xa2e7...Eb4 · Celo Mainnet</div>
  </div>;
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState('connect');
  const [username,setUsername]=useState('');
  const [tableId,setTableId]=useState(null);
  const [humanPlayerId,setHumanPlayerId]=useState(null);
  const [buyInUSD,setBuyInUSD]=useState(0.2);
  const wallet=useMiniPay();

  useEffect(()=>{
    const u=localStorage.getItem('poker_username');
    if(u) setUsername(u); // restore name but ALWAYS show connect screen
    // Only auto-skip on MiniPay (wallet connects automatically)
  },[]);

  const handleJoined=(tid,hpid,buyIn)=>{setTableId(tid);setHumanPlayerId(hpid||null);setBuyInUSD(buyIn||0.2);setScreen('game');};

  if(screen==='connect')return <ConnectScreen wallet={wallet} onDone={(_,name)=>{setUsername(name);setScreen('lobby');}}/>;
  if(screen==='game')return <div className="app"><GameTable tableId={tableId} address={wallet.address} username={username} humanPlayerId={humanPlayerId} buyInUSD={buyInUSD} onBack={()=>setScreen('lobby')} onPlayAgain={()=>setScreen('lobby')}/></div>;
  return <Lobby address={wallet.address} username={username} wallet={wallet} onJoined={handleJoined}/>;
}
