import Head from "next/head";
import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────
// 時間パース
// ─────────────────────────────────────────
function parseTime(text) {
  const ampm = text.match(/午([前後])\s*(\d{1,2})\s*時\s*(\d{1,2})?\s*分?/);
  if (ampm) {
    let h = parseInt(ampm[2]); const m = ampm[3] ? parseInt(ampm[3]) : 0;
    if (ampm[1] === "後" && h < 12) h += 12;
    if (ampm[1] === "前" && h === 12) h = 0;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  const half = text.match(/(\d{1,2})\s*時半/);
  if (half) return `${String(parseInt(half[1])).padStart(2,"0")}:30`;
  const jwm = text.match(/(\d{1,2})\s*時\s*(\d{1,2})\s*分?/);
  if (jwm) return `${String(parseInt(jwm[1])).padStart(2,"0")}:${String(parseInt(jwm[2])).padStart(2,"0")}`;
  const jo = text.match(/(\d{1,2})\s*時/);
  if (jo) return `${String(parseInt(jo[1])).padStart(2,"0")}:00`;
  const col = text.match(/(\d{1,2})[：:](\d{2})/);
  if (col) return `${String(parseInt(col[1])).padStart(2,"0")}:${String(parseInt(col[2])).padStart(2,"0")}`;
  return null;
}
function parseTasksFromText(text) {
  return text.split(/[、。,，\n \u3000]+/).map(s => s.trim()).filter(Boolean).map(part => {
    const time = parseTime(part);
    let name = part;
    if (time) {
      name = part
        .replace(/午[前後]\s*\d{1,2}\s*時\s*(\d{1,2}\s*分?)?/g,"")
        .replace(/\d{1,2}\s*時半/g,"").replace(/\d{1,2}\s*時\s*\d{1,2}\s*分?/g,"")
        .replace(/\d{1,2}\s*時/g,"").replace(/\d{1,2}[：:]\d{2}/g,"")
        .replace(/^\s*[-にで]\s*/,"").trim();
    }
    return { id: Math.random().toString(36).slice(2), name: name||part, time, done: false };
  });
}

// ─────────────────────────────────────────
// データ定義
// ─────────────────────────────────────────
const PETS = [
  { id:"bear",    emoji:"🐻",  image:"/darakumaup.jpeg", name:"だらクマ",       cost:0,    desc:"最初からいる相棒" },
  { id:"cat",     emoji:"🐱",  name:"ねこ",       cost:300,  desc:"気まぐれだけど可愛い" },
  { id:"dog",     emoji:"🐶",  name:"いぬ",       cost:400,  desc:"いつも応援してくれる" },
  { id:"rabbit",  emoji:"🐰",  name:"うさぎ",     cost:500,  desc:"ぴょんぴょん元気" },
  { id:"hamster", emoji:"🐹",  name:"ハムスター", cost:350,  desc:"ほっぺがぷくぷく" },
  { id:"fox",     emoji:"🦊",  name:"きつね",     cost:800,  desc:"ちょっとミステリアス" },
  { id:"penguin", emoji:"🐧",  name:"ペンギン",   cost:600,  desc:"よちよち歩きが愛しい" },
];
const OMAMORI = { id:"omamori", emoji:"🧿", name:"おまもり", cost:1000, desc:"ストリークが途切れても1回だけ守ってくれる" };
const MOODS = [
  { min:0,  max:0,  mood:"zzz…",     color:"#b0b0b0" },
  { min:1,  max:2,  mood:"ん…",      color:"#c8a96e" },
  { min:3,  max:4,  mood:"まあね",   color:"#e8b84b" },
  { min:5,  max:7,  mood:"いいね！", color:"#f4c842" },
  { min:8,  max:99, mood:"最高！！", color:"#7dd6f0" },
];
const getMood = (n) => MOODS.find(s => n >= s.min && n <= s.max) || MOODS[0];

const BADGE_DEFS = [
  { id:"first_task",    emoji:"🌱", name:"はじめの一歩",   desc:"初めてタスクを完了した",       check:(s)=> s.totalTasks >= 1 },
  { id:"task10",        emoji:"⭐", name:"10タスク達成",    desc:"累計タスク完了10個",           check:(s)=> s.totalTasks >= 10 },
  { id:"task50",        emoji:"🌟", name:"50タスク達成",    desc:"累計タスク完了50個",           check:(s)=> s.totalTasks >= 50 },
  { id:"task100",       emoji:"💫", name:"100タスク達成",   desc:"累計タスク完了100個",          check:(s)=> s.totalTasks >= 100 },
  { id:"first_day",     emoji:"🔥", name:"初日クリア",      desc:"初めて全タスクを達成した",     check:(s)=> s.achievedDays >= 1 },
  { id:"day7",          emoji:"🔥", name:"7日達成",         desc:"累計7日全タスク達成",          check:(s)=> s.achievedDays >= 7 },
  { id:"day30",         emoji:"🏆", name:"30日達成",        desc:"累計30日全タスク達成",         check:(s)=> s.achievedDays >= 30 },
  { id:"streak3",       emoji:"⚡", name:"3日連続",         desc:"3日連続でタスクを全完了",      check:(s)=> s.streak >= 3 },
  { id:"streak7",       emoji:"⚡", name:"7日連続",         desc:"7日連続でタスクを全完了",      check:(s)=> s.streak >= 7 },
  { id:"points1000",    emoji:"💰", name:"1000pt突破",      desc:"累計ポイント1000pt達成",       check:(s)=> s.totalPoints >= 1000 },
  { id:"pet_owner",     emoji:"🐾", name:"ペットオーナー",  desc:"初めてペットを購入した",       check:(s)=> s.ownedPets.length > 1 },
  { id:"omamori_owner", emoji:"🧿", name:"おまもり持ち",    desc:"おまもりを手に入れた",         check:(s)=> s.hasOmamori },
];

const todayKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

// ─────────────────────────────────────────
// だらクマのセリフ
// ─────────────────────────────────────────
const BEAR_LINES = {
  tap: [
    "もう少し寝かせて","ごはんが自動で出てきたらいいのに","……用？","いま考えるのめんどい",
    "あとでいい？","生きてるだけでえらいってことで","今日は低燃費モード","動く理由が見つからない",
    "それ、急ぎ？","静かにしてくれたら助かる","まあ…見てるだけなら","やる気は今どっか行ってる",
  ],
  nudge: [
    "やるなら短くやろう","5分だけでよくない？","雑でいいから触るだけ","始めるのが一番めんどい",
    "とりあえず一個だけ","途中でやめても別にいいし","どうせ後でやるなら今少し","体動かすと楽になるらしいよ、知らんけど",
  ],
  progress: [
    "まだやってる、えらい","休みつつでいい","速度より継続","そのまま惰性でいけ","完璧は後回しで",
    "詰まったら放置も手","戻ってこれたら勝ち","そのうちやるでしょ","忘れてないならOK","戻ってきたら少しやろう",
  ],
  done: [
    "いいね","おつかれ","それで十分","ちゃんと終わらせたな","いい流れ",
    "思ったよりやるね","継続できてるのがすごい","まあ、やるか…","悪くないじゃん",
  ],
  allDone: [
    "もう今日はいいだろ","これ以上は贅沢","ちゃんと区切ったな","……で、寝る？","人間やるじゃん","明日の自分が楽する",
  ],
  zero: [
    "狩りなんて行きたくないよだ","やること多いってたいへんだ","今日もやるのか","何もしない日も必要",
    "空っぽって逆に不安","一個だけ置いとけば？","軽いのだけ決めとく？","あとで困るやつではある","まあ、今日は様子見でも",
  ],
  idle: [],
  morning: ["朝か…","起きただけで合格","今日は軽めでいこう","無理しない前提で","一個やれば十分"],
  night:   ["今日はここまででいい","ちゃんと終われたな"],
  gadget: [
    "自動で終わる仕組み、考えたい","頑張るより仕組み","放置で進むのが理想","効率化は正義",
    "一回楽すると戻れない","今、鮭の動線を研究してる","次は「自動タスク消化装置」かな",
  ],
};
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getTimeCategory = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return "morning";
  if (h >= 19 || h < 5) return "night";
  return null;
};
const pickTapLine = () => {
  const cat = getTimeCategory();
  const pool = [...BEAR_LINES.tap, ...BEAR_LINES.gadget, ...(cat ? BEAR_LINES[cat] : [])];
  return pickRandom(pool);
};

// ─────────────────────────────────────────
// ペット表示ヘルパー（画像 or 絵文字）
// ─────────────────────────────────────────
function PetIcon({ pet, size = 52, style: extraStyle = {} }) {
  if (pet.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pet.image}
        alt={pet.name}
        style={{ width: size, height: size, objectFit: "contain", ...extraStyle }}
      />
    );
  }
  return <span style={{ fontSize: size * 0.72, lineHeight: 1, ...extraStyle }}>{pet.emoji}</span>;
}

// ─────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────
const Icon = ({ name, size=22, color="#aaa" }) => {
  const s = { width:size, height:size, display:"block" };
  if (name==="home")     return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (name==="calendar") return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (name==="shop")     return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>;
  if (name==="badge")    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>;
  if (name==="pet")      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="15" rx="5" ry="4"/><circle cx="8.5" cy="9" r="1.5"/><circle cx="15.5" cy="9" r="1.5"/><circle cx="5.5" cy="12.5" r="1.2"/><circle cx="18.5" cy="12.5" r="1.2"/></svg>;
  if (name==="menu")     return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
  if (name==="chevron")  return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
  if (name==="back")     return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
  return null;
};

// ─────────────────────────────────────────
// オンボーディング
// ─────────────────────────────────────────
const ONBOARDING_SLIDES = [
  { bg:"linear-gradient(160deg,#fff7e0,#fde8bb)", bear:"😴", title:"だらタスクへようこそ", sub:"やる気ゼロでも続けられる\nタスク管理アプリ", desc:"だらクマと一緒に、\n今日をちょっとだけ頑張ろう。", accent:"#f97316" },
  { bg:"linear-gradient(160deg,#f0f9ff,#dbeafe)", bear:"📝", title:"タスクを入れるだけ", sub:"脳内そのままでOK", desc:"「ゴミ出し 洗濯 12時に銀行」みたいに\nスペースや読点で区切るだけ。\n時間も自動で認識するよ！", accent:"#3b82f6" },
  { bg:"linear-gradient(160deg,#f0fdf4,#dcfce7)", bear:"⭐", title:"こなすとポイントがもらえる", sub:"1タスク = 10pt　全完了 = +100pt", desc:"貯めたポイントでペットを増やそう！\nバッジを集めて記録を伸ばそう！", accent:"#16a34a" },
  { bg:"linear-gradient(160deg,#faf7f2,#f0e6d3)", bear:"🐻", title:"さあ、はじめよう", sub:"ニックネームを教えてね", desc:"🧿 おまもりを1個プレゼント！\nストリークが途切れそうな時に\n1回だけ守ってくれるよ。", accent:"#f97316", isLast:true },
];

function OnboardingScreen({ onComplete }) {
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState("");
  const [exiting, setExiting] = useState(false);
  const s = ONBOARDING_SLIDES[slide];
  const isLast = s.isLast;
  const next = () => {
    if (slide < ONBOARDING_SLIDES.length - 1) {
      setExiting(true);
      setTimeout(() => { setSlide(v => v+1); setExiting(false); }, 250);
    }
  };
  const finish = () => { if (isLast) onComplete(name.trim() || "だら"); };
  return (
    <div style={{ minHeight:"100vh", background:s.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"space-between", padding:"48px 32px 52px", maxWidth:420, margin:"0 auto", transition:"background 0.4s", opacity:exiting?0:1, transform:exiting?"translateX(-20px)":"translateX(0)", transitionProperty:"opacity,transform" }}>
      <div style={{ display:"flex", gap:8, alignSelf:"center" }}>
        {ONBOARDING_SLIDES.map((_,i)=>(
          <div key={i} style={{ width:i===slide?20:8, height:8, borderRadius:99, background:i===slide?s.accent:"#ddd", transition:"all 0.3s" }}/>
        ))}
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", gap:20, width:"100%" }}>
        <div style={{ fontSize:80, lineHeight:1 }}>{s.bear}</div>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:s.accent, letterSpacing:2, marginBottom:8 }}>{slide+1} / {ONBOARDING_SLIDES.length}</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#222", margin:"0 0 8px", lineHeight:1.3 }}>{s.title}</h1>
          <div style={{ fontSize:15, fontWeight:700, color:s.accent, marginBottom:14, whiteSpace:"pre-line" }}>{s.sub}</div>
          {s.desc && <p style={{ fontSize:14, color:"#666", lineHeight:1.8, whiteSpace:"pre-line", margin:0 }}>{s.desc}</p>}
        </div>
        {isLast && (
          <div style={{ width:"100%", marginTop:4, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", border:"1.5px solid #c4b5fd", borderRadius:16, padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ fontSize:40 }}>🧿</div>
              <div>
                <div style={{ fontSize:14, fontWeight:900, color:"#7c3aed" }}>おまもりプレゼント！</div>
                <div style={{ fontSize:12, color:"#888", marginTop:3, lineHeight:1.5 }}>ストリークが途切れた時に<br/>1回だけ守ってくれるよ</div>
              </div>
            </div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="ニックネームを入力" maxLength={12}
              style={{ width:"100%", boxSizing:"border-box", padding:"14px 18px", fontSize:16, fontFamily:"inherit", border:"2px solid #f0e6d3", borderRadius:14, outline:"none", background:"#fff", textAlign:"center", color:"#333" }}/>
            <div style={{ fontSize:11, color:"#bbb", textAlign:"center" }}>あとから変更できます（最大12文字）</div>
          </div>
        )}
      </div>
      <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
        {isLast ? (
          <button onClick={finish} style={{ width:"100%", padding:"16px", borderRadius:99, border:"none", background:`linear-gradient(90deg,#f4c842,${s.accent})`, color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", boxShadow:"0 4px 20px rgba(249,115,22,0.3)" }}>
            はじめる 🐻
          </button>
        ) : (
          <>
            <button onClick={next} style={{ width:"100%", padding:"16px", borderRadius:99, border:"none", background:`linear-gradient(90deg,#f4c842,${s.accent})`, color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer" }}>つぎへ</button>
            <button onClick={()=>setSlide(ONBOARDING_SLIDES.length-1)} style={{ background:"none", border:"none", color:"#bbb", fontSize:13, cursor:"pointer", padding:"4px" }}>スキップ</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ポイントバー
// ─────────────────────────────────────────
function PointBar({ points }) {
  const progress = points % 100;
  const tier = Math.floor(points / 100);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:11, color:"#888", fontWeight:700, minWidth:28 }}>⭐{tier}</span>
      <div style={{ flex:1, height:7, background:"#eee", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg,#f4c842,#f97316)", borderRadius:99, transition:"width 0.6s cubic-bezier(.22,1,.36,1)" }}/>
      </div>
      <span style={{ fontSize:11, color:"#aaa", minWidth:52, textAlign:"right" }}>{points} pt</span>
    </div>
  );
}

// ─────────────────────────────────────────
// タスクカード
// ─────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete }) {
  const [pop, setPop] = useState(false);
  const handle = () => { if(!task.done){setPop(true);setTimeout(()=>setPop(false),400);} onToggle(task.id); };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:task.done?"#f9f9f9":"#fff", borderRadius:14, border:`1.5px solid ${task.done?"#ebebeb":"#f0e6d3"}`, opacity:task.done?0.55:1, transform:pop?"scale(1.03)":"scale(1)", transition:"all 0.25s" }}>
      <button onClick={handle} style={{ width:24, height:24, borderRadius:"50%", border:`2px solid ${task.done?"#bbb":"#f4c842"}`, background:task.done?"#e0e0e0":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:13 }}>
        {task.done?"✓":""}
      </button>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:500, color:task.done?"#aaa":"#333", textDecoration:task.done?"line-through":"none" }}>{task.name}</div>
        {task.time && <div style={{ fontSize:11, color:"#f97316", marginTop:2 }}>⏰ {task.time}</div>}
      </div>
      <button onClick={()=>onDelete(task.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#ddd", padding:"2px 4px" }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────
// 全完了モーダル
// ─────────────────────────────────────────
function AllDoneModal({ onClose, streak, bonus, newBadges }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:"32px 28px", textAlign:"center", maxWidth:320, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", animation:"popIn 0.4s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ fontSize:56, marginBottom:6 }}>🎉</div>
        <div style={{ fontSize:20, fontWeight:900, color:"#333", marginBottom:4 }}>全部終わった！</div>
        <div style={{ fontSize:13, color:"#888", fontStyle:"italic", marginBottom:4 }}>{"「" + pickRandom(BEAR_LINES.allDone) + "」"}</div>
        <div style={{ background:"linear-gradient(135deg,#fff7e0,#fde8bb)", borderRadius:14, padding:"12px 20px", margin:"16px 0" }}>
          <div style={{ fontSize:26, fontWeight:900, color:"#f97316" }}>+{bonus} pt</div>
          <div style={{ fontSize:11, color:"#b07030" }}>全完了ボーナス！</div>
        </div>
        <div style={{ fontSize:13, color:"#aaa", marginBottom:newBadges.length?12:20 }}>🔥 {streak}日連続達成中！</div>
        {newBadges.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:8 }}>🏅 新バッジ獲得！</div>
            <div style={{ display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
              {newBadges.map(b=><div key={b.id} style={{ background:"#faf7f2", borderRadius:10, padding:"6px 10px", fontSize:12 }}>{b.emoji} {b.name}</div>)}
            </div>
          </div>
        )}
        <button onClick={onClose} style={{ background:"linear-gradient(90deg,#f4c842,#f97316)", border:"none", borderRadius:99, padding:"12px 32px", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>やった！</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// バッジポップアップ
// ─────────────────────────────────────────
function BadgePopup({ badge, onClose }) {
  if (!badge) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500, padding:24 }}>
      <div style={{ background:"#fff", borderRadius:28, padding:"36px 28px", textAlign:"center", maxWidth:300, width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.2)", animation:"popIn 0.45s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"#f97316", marginBottom:12 }}>バッジ獲得！</div>
        <div style={{ fontSize:72, lineHeight:1, marginBottom:16, animation:"badgeBounce 0.6s cubic-bezier(.22,1,.36,1)" }}>{badge.emoji}</div>
        <div style={{ fontSize:20, fontWeight:900, color:"#222", marginBottom:6 }}>{badge.name}</div>
        <div style={{ fontSize:13, color:"#aaa", lineHeight:1.6, marginBottom:24 }}>{badge.desc}</div>
        <button onClick={onClose} style={{ background:"linear-gradient(90deg,#f4c842,#f97316)", border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>OK！</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// おまもり発動ポップアップ
// ─────────────────────────────────────────
function OmamoriPopup({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500, padding:24 }}>
      <div style={{ background:"#fff", borderRadius:28, padding:"36px 28px", textAlign:"center", maxWidth:300, width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.2)", animation:"popIn 0.45s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"#7c3aed", marginBottom:12 }}>おまもり発動！</div>
        <div style={{ fontSize:72, lineHeight:1, marginBottom:8, animation:"badgeBounce 0.6s cubic-bezier(.22,1,.36,1)" }}>🧿</div>
        <div style={{ fontSize:36, lineHeight:1, marginBottom:16 }}>🐻</div>
        <div style={{ fontSize:18, fontWeight:900, color:"#222", marginBottom:8 }}>だらクマが守ってくれた！</div>
        <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", borderRadius:14, padding:"12px 16px", marginBottom:20 }}>
          <div style={{ fontSize:13, color:"#7c3aed", lineHeight:1.7 }}>「まあ、今回だけは<br/>見逃してやるか…」</div>
        </div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:20 }}>連続記録が守られました🔥</div>
        <button onClick={onClose} style={{ background:"linear-gradient(90deg,#a78bfa,#7c3aed)", border:"none", borderRadius:99, padding:"13px 40px", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>ありがとう！</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// カレンダー画面
// ─────────────────────────────────────────
function CalendarScreen({ achievedDates }) {
  const today = new Date();
  const year = today.getFullYear(), month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const dayLabels = ["日","月","火","水","木","金","土"];
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  const dk = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  return (
    <div style={{ padding:"0 20px 20px" }}>
      <div style={{ padding:"20px 0 16px" }}>
        <div style={{ fontSize:18, fontWeight:900, color:"#222" }}>継続カレンダー</div>
        <div style={{ fontSize:12, color:"#aaa" }}>{year}年{month+1}月 · {achievedDates.size}日達成</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:6 }}>
        {dayLabels.map((d,i)=><div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:i===0?"#f97316":i===6?"#60a5fa":"#aaa" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {cells.map((d,i) => {
          if (!d) return <div key={i}/>;
          const isToday = d===today.getDate();
          const achieved = achievedDates.has(dk(d));
          return (
            <div key={i} style={{ aspectRatio:"1", borderRadius:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:achieved?"linear-gradient(135deg,#f4c842,#f97316)":isToday?"#fff8ed":"#fafafa", border:isToday?"1.5px solid #f4c842":"1.5px solid transparent", fontSize:13, fontWeight:isToday?900:500, color:achieved?"#fff":isToday?"#f97316":"#555" }}>
              {d}{achieved&&<div style={{fontSize:8,lineHeight:1}}>✓</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:16, display:"flex", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:14, height:14, borderRadius:4, background:"linear-gradient(135deg,#f4c842,#f97316)" }}/><span style={{ fontSize:11, color:"#888" }}>全完了した日</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:14, height:14, borderRadius:4, background:"#fff8ed", border:"1.5px solid #f4c842" }}/><span style={{ fontSize:11, color:"#888" }}>今日</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ショップ画面
// ─────────────────────────────────────────
function ShopScreen({ points, ownedPets, activePet, hasOmamori, onBuyPet, onSelectPet, onBuyOmamori }) {
  const [tab, setTab] = useState("pet");
  return (
    <div style={{ padding:"0 20px 20px" }}>
      <div style={{ padding:"20px 0 16px" }}>
        <div style={{ fontSize:18, fontWeight:900, color:"#222" }}>ショップ</div>
        <div style={{ fontSize:12, color:"#aaa" }}>所持ポイント: <span style={{ color:"#f97316", fontWeight:700 }}>{points} pt</span></div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["pet","🐾 ペット"],["item","🧿 アイテム"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"8px 0", borderRadius:99, border:"none", background:tab===id?"linear-gradient(90deg,#f4c842,#f97316)":"#eee", color:tab===id?"#fff":"#aaa", fontWeight:700, fontSize:13, cursor:"pointer" }}>{label}</button>
        ))}
      </div>
      {tab==="pet" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {PETS.map(pet => {
            const owned = ownedPets.includes(pet.id);
            const active = activePet===pet.id;
            const canBuy = points>=pet.cost && !owned;
            return (
              <div key={pet.id} style={{ background:active?"linear-gradient(135deg,#fff7e0,#fde8bb)":"#faf7f2", border:`1.5px solid ${active?"#f4c842":owned?"#e0e0e0":"#f0e6d3"}`, borderRadius:16, padding:"14px 12px", textAlign:"center", position:"relative" }}>
                {active && <div style={{ position:"absolute", top:7, right:7, fontSize:9, background:"#f4c842", color:"#fff", borderRadius:99, padding:"2px 6px", fontWeight:700 }}>使用中</div>}
                <div style={{ fontSize:34, marginBottom:4, display:"flex", justifyContent:"center", alignItems:"center", height:40 }}>
                  <PetIcon pet={pet} size={36}/>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:"#333" }}>{pet.name}</div>
                <div style={{ fontSize:10, color:"#aaa", margin:"2px 0 10px" }}>{pet.desc}</div>
                {owned
                  ? <button onClick={()=>onSelectPet(pet.id)} style={{ width:"100%", padding:"6px 0", borderRadius:99, border:"none", background:active?"#eee":"linear-gradient(90deg,#f4c842,#f97316)", color:active?"#aaa":"#fff", fontWeight:700, fontSize:12, cursor:active?"default":"pointer" }}>{active?"選択中":"つかう"}</button>
                  : <button onClick={()=>canBuy&&onBuyPet(pet)} disabled={!canBuy} style={{ width:"100%", padding:"6px 0", borderRadius:99, border:"none", background:canBuy?"linear-gradient(90deg,#f4c842,#f97316)":"#eee", color:canBuy?"#fff":"#bbb", fontWeight:700, fontSize:12, cursor:canBuy?"pointer":"default" }}>{pet.cost===0?"無料":`${pet.cost} pt`}</button>
                }
              </div>
            );
          })}
        </div>
      )}
      {tab==="item" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#faf7f2", border:`1.5px solid ${hasOmamori?"#a78bfa":"#f0e6d3"}`, borderRadius:16, padding:"18px 16px", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:40 }}>{OMAMORI.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#333" }}>{OMAMORI.name}</div>
              <div style={{ fontSize:11, color:"#888", marginTop:2, lineHeight:1.5 }}>{OMAMORI.desc}</div>
              {hasOmamori && <div style={{ fontSize:11, color:"#a78bfa", fontWeight:700, marginTop:4 }}>✓ 所持中</div>}
            </div>
            <button onClick={()=>!hasOmamori&&points>=OMAMORI.cost&&onBuyOmamori()} disabled={hasOmamori||points<OMAMORI.cost} style={{ padding:"8px 14px", borderRadius:99, border:"none", background:hasOmamori?"#eee":points>=OMAMORI.cost?"linear-gradient(90deg,#a78bfa,#7c3aed)":"#eee", color:hasOmamori||points<OMAMORI.cost?"#bbb":"#fff", fontWeight:700, fontSize:12, cursor:hasOmamori||points<OMAMORI.cost?"default":"pointer", whiteSpace:"nowrap" }}>
              {hasOmamori?"所持済":OMAMORI.cost+" pt"}
            </button>
          </div>
          <div style={{ background:"#f0f9ff", borderRadius:12, padding:"12px 14px", fontSize:12, color:"#60a5fa", lineHeight:1.7 }}>
            💡 おまもりを持っていると、ストリークが途切れそうな日に1回だけ守ってくれます
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ペット画面（だらクマの部屋）
// ─────────────────────────────────────────
function PetScreen({ activePet, ownedPets, completedToday, onGoShop, onSelectPet }) {
  const petData = PETS.find(p=>p.id===activePet)||PETS[0];
  const mood = getMood(completedToday);
  const isBear = activePet === "bear";
  const [speech, setSpeech] = useState(null);
  const [speechTimer, setSpeechTimer] = useState(null);

  const showSpeech = (line) => {
    setSpeech(line);
    if (speechTimer) clearTimeout(speechTimer);
    const t = setTimeout(() => setSpeech(null), 3000);
    setSpeechTimer(t);
  };
  const handleTap = () => { if (isBear) showSpeech(pickTapLine()); };

  const RoomBg = () => (
    <svg width="100%" viewBox="0 0 360 220" style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
      <rect width="360" height="220" fill="#f5efe6"/>
      <rect y="160" width="360" height="60" fill="#e8d5b7"/>
      <line x1="0" y1="160" x2="360" y2="160" stroke="#d4b896" strokeWidth="2"/>
      <rect x="240" y="20" width="90" height="70" rx="6" fill="#c8e6f5" stroke="#bbb" strokeWidth="1.5"/>
      <line x1="285" y1="20" x2="285" y2="90" stroke="#bbb" strokeWidth="1"/>
      <line x1="240" y1="55" x2="330" y2="55" stroke="#bbb" strokeWidth="1"/>
      <circle cx="305" cy="38" r="10" fill="#fff9c4" opacity="0.9"/>
      <path d="M240 20 Q250 55 245 90 L240 90 Z" fill="#e8a87c" opacity="0.7"/>
      <path d="M330 20 Q320 55 325 90 L330 90 Z" fill="#e8a87c" opacity="0.7"/>
      <circle cx="60" cy="148" r="14" fill="#f4c842" opacity="0.8"/>
      <circle cx="54" cy="137" r="6" fill="#f4c842" opacity="0.8"/>
      <circle cx="66" cy="137" r="6" fill="#f4c842" opacity="0.8"/>
      <circle cx="54" cy="137" r="3" fill="#e8b84b" opacity="0.6"/>
      <circle cx="66" cy="137" r="3" fill="#e8b84b" opacity="0.6"/>
      <rect x="100" y="152" width="28" height="16" rx="3" fill="#444" transform="rotate(-15,114,160)"/>
      <rect x="102" y="154" width="24" height="12" rx="2" fill="#7dd6f0" transform="rotate(-15,114,160)"/>
      <ellipse cx="290" cy="158" rx="16" ry="10" fill="#f97316" opacity="0.7"/>
      <ellipse cx="290" cy="155" rx="10" ry="5" fill="#fde8bb" opacity="0.8"/>
    </svg>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ position:"relative", height:220, overflow:"hidden", cursor:isBear?"pointer":"default", marginBottom:0 }} onClick={handleTap}>
        <RoomBg/>
        <div style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)", background:"#fff", border:`1.5px solid ${speech?"#f0e6d3":mood.color+"55"}`, borderRadius:12, padding:"8px 14px", fontSize:13, fontWeight:700, color:speech?"#555":mood.color, whiteSpace:"nowrap", zIndex:10, boxShadow:"0 4px 16px rgba(0,0,0,0.08)", transition:"all 0.3s" }}>
          {speech || mood.mood}
          <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:0, height:0, borderLeft:"7px solid transparent", borderRight:"7px solid transparent", borderTop:`8px solid ${speech?"#f0e6d3":mood.color+"55"}` }}/>
          <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)", width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"7px solid #fff" }}/>
        </div>
        {/* ペット本体 */}
        <div style={{ position:"absolute", bottom:50, left:"50%", transform:"translateX(-50%)", lineHeight:1, filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.15))", userSelect:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <PetIcon pet={petData} size={72}/>
        </div>
        {isBear && <div style={{ position:"absolute", bottom:4, right:12, fontSize:9, color:"#ccc" }}>タップで話す</div>}
      </div>
      <div style={{ textAlign:"center", padding:"12px 0 16px", borderBottom:"1px solid #f0e6d3" }}>
        <div style={{ fontSize:16, fontWeight:900, color:"#333" }}>{petData.name}</div>
        <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>タスクをこなすと元気になるよ！</div>
      </div>
      <div style={{ padding:"16px 20px 0" }}>
        {ownedPets.length > 1 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:10 }}>持っているペット</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {ownedPets.map(id => {
                const p = PETS.find(pp=>pp.id===id); if (!p) return null;
                const isActive = activePet===id;
                return (
                  <button key={id} onClick={()=>onSelectPet(id)} style={{ background:isActive?"linear-gradient(135deg,#fff7e0,#fde8bb)":"#faf7f2", border:`1.5px solid ${isActive?"#f4c842":"#f0e6d3"}`, borderRadius:12, padding:"10px 14px", textAlign:"center", cursor:"pointer" }}>
                    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:32 }}><PetIcon pet={p} size={28}/></div>
                    <div style={{ fontSize:10, color:isActive?"#f97316":"#aaa" }}>{p.name}</div>
                    {isActive && <div style={{ fontSize:9, color:"#f97316", fontWeight:700 }}>使用中</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={onGoShop} style={{ width:"100%", padding:"12px", borderRadius:14, border:"1.5px solid #f0e6d3", background:"#fff", color:"#f97316", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          🏪 ショップでペットを増やす
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// バッジ画面
// ─────────────────────────────────────────
function BadgeScreen({ stats }) {
  const earned = BADGE_DEFS.filter(b=>b.check(stats));
  const notYet = BADGE_DEFS.filter(b=>!b.check(stats));
  return (
    <div style={{ padding:"0 20px 20px" }}>
      <div style={{ padding:"20px 0 16px" }}>
        <div style={{ fontSize:18, fontWeight:900, color:"#222" }}>バッジ</div>
        <div style={{ fontSize:12, color:"#aaa" }}>{earned.length} / {BADGE_DEFS.length} 獲得</div>
      </div>
      {earned.length > 0 && (
        <>
          <div style={{ fontSize:12, color:"#f97316", fontWeight:700, marginBottom:10 }}>獲得済み ✓</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
            {earned.map(b=>(
              <div key={b.id} style={{ background:"linear-gradient(135deg,#fff7e0,#fde8bb)", border:"1.5px solid #f4c842", borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:4 }}>{b.emoji}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#333" }}>{b.name}</div>
                <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {notYet.length > 0 && (
        <>
          <div style={{ fontSize:12, color:"#bbb", fontWeight:700, marginBottom:10 }}>まだのバッジ</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {notYet.map(b=>(
              <div key={b.id} style={{ background:"#fafafa", border:"1.5px solid #eee", borderRadius:14, padding:"12px 10px", textAlign:"center", opacity:0.6 }}>
                <div style={{ fontSize:32, marginBottom:4, filter:"grayscale(1)" }}>{b.emoji}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#aaa" }}>{b.name}</div>
                <div style={{ fontSize:10, color:"#ccc", marginTop:2 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ハンバーガーメニュー
// ─────────────────────────────────────────
function HamburgerMenu({ onClose, onOpen }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:300 }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)" }} onClick={onClose}/>
      <div style={{ position:"absolute", top:0, right:0, width:270, height:"100%", background:"#fff", boxShadow:"-4px 0 20px rgba(0,0,0,0.1)", display:"flex", flexDirection:"column", animation:"slideFromRight 0.3s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding:"56px 24px 20px", borderBottom:"1px solid #f5f0e8" }}>
          <div style={{ fontSize:11, color:"#f97316", fontWeight:700, letterSpacing:1 }}>だらタスク</div>
          <div style={{ fontSize:16, fontWeight:900, color:"#222", marginTop:2 }}>メニュー</div>
        </div>
        {[
          { id:"shop",     emoji:"🏪", label:"ショップ",     sub:"ポイントでペットを増やす" },
          { id:"pet",      emoji:"🐾", label:"マイペット",   sub:"ペットの部屋" },
          { id:"badge",    emoji:"🏅", label:"バッジ",       sub:"実績コレクション" },
          { id:"settings", emoji:"⚙️", label:"設定",         sub:"通知・テーマ" },
          { id:"profile",  emoji:"👤", label:"ユーザー情報", sub:"プロフィール・実績" },
          { id:"help",     emoji:"❓", label:"ヘルプ",       sub:"使い方・FAQ" },
        ].map(item=>(
          <button key={item.id} onClick={()=>{ onClose(); onOpen(item.id); }} style={{ background:"none", border:"none", padding:"18px 24px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:14, borderBottom:"1px solid #f9f5f0" }}>
            <span style={{ fontSize:24 }}>{item.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#333" }}>{item.label}</div>
              <div style={{ fontSize:11, color:"#bbb" }}>{item.sub}</div>
            </div>
            <Icon name="chevron" size={16} color="#ddd"/>
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <div style={{ padding:"20px 24px", fontSize:11, color:"#ccc" }}>v4.0 · だらタスク</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 設定パネル
// ─────────────────────────────────────────
function SettingsPanel({ onClose, notifOn, setNotifOn, planTime, setPlanTime, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 24px 48px", width:"100%", maxWidth:420, animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="back" size={20} color="#888"/></button>
          <div style={{ fontSize:17, fontWeight:900, color:"#222" }}>⚙️ 設定</div>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:12, letterSpacing:1 }}>通知</div>
          <div style={{ background:"#faf7f2", borderRadius:14, overflow:"hidden" }}>
            <label style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #f0e6d3", cursor:"pointer" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:"#333" }}>タスク開始通知</div>
                <div style={{ fontSize:11, color:"#aaa" }}>設定時間になったらお知らせする</div>
              </div>
              <div onClick={()=>setNotifOn(v=>!v)} style={{ width:44, height:26, borderRadius:99, background:notifOn?"#f97316":"#ddd", position:"relative", transition:"background 0.2s", cursor:"pointer", flexShrink:0 }}>
                <div style={{ position:"absolute", top:3, left:notifOn?20:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
              </div>
            </label>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#333", marginBottom:6 }}>計画リマインド時間</div>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:8 }}>毎日この時間に「計画を立てよう！」と通知</div>
              <input type="time" value={planTime} onChange={e=>setPlanTime(e.target.value)} style={{ padding:"8px 12px", borderRadius:10, border:"1.5px solid #f0e6d3", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff" }}/>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:12, letterSpacing:1 }}>データ</div>
          <div style={{ background:"#faf7f2", borderRadius:14, overflow:"hidden" }}>
            {!confirmReset ? (
              <button onClick={()=>setConfirmReset(true)} style={{ width:"100%", padding:"14px 16px", background:"none", border:"none", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#ef4444" }}>データをリセット</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>ポイント・バッジ・タスクを初期化</div>
                </div>
                <Icon name="chevron" size={16} color="#ef4444"/>
              </button>
            ) : (
              <div style={{ padding:"16px" }}>
                <div style={{ fontSize:13, color:"#ef4444", fontWeight:700, marginBottom:12 }}>本当にリセットしますか？この操作は取り消せません。</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setConfirmReset(false)} style={{ flex:1, padding:"10px", borderRadius:99, border:"1.5px solid #eee", background:"#fff", color:"#888", fontWeight:700, fontSize:13, cursor:"pointer" }}>キャンセル</button>
                  <button onClick={()=>{ onReset(); setConfirmReset(false); onClose(); }} style={{ flex:1, padding:"10px", borderRadius:99, border:"none", background:"#ef4444", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>リセット</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ユーザー情報パネル
// ─────────────────────────────────────────
function ProfilePanel({ onClose, nickname, setNickname, stats, ownedPets, activePet, points, streak }) {
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(nickname);
  const earnedCount = BADGE_DEFS.filter(b=>b.check(stats)).length;
  const activePetData = PETS.find(p=>p.id===activePet)||PETS[0];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 24px 48px", width:"100%", maxWidth:420, animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="back" size={20} color="#888"/></button>
          <div style={{ fontSize:17, fontWeight:900, color:"#222" }}>👤 ユーザー情報</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#fff7e0,#fde8bb)", borderRadius:18, padding:"20px", marginBottom:20, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:56, height:56 }}>
            <PetIcon pet={activePetData} size={52}/>
          </div>
          <div style={{ flex:1 }}>
            {editing ? (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input value={tempName} onChange={e=>setTempName(e.target.value)} maxLength={12}
                  style={{ flex:1, padding:"6px 10px", borderRadius:8, border:"1.5px solid #f0e6d3", fontSize:16, fontFamily:"inherit", fontWeight:700, outline:"none" }}/>
                <button onClick={()=>{ setNickname(tempName||"だら"); setEditing(false); }} style={{ padding:"6px 12px", borderRadius:8, border:"none", background:"#f97316", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>保存</button>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:20, fontWeight:900, color:"#333" }}>{nickname}のだらタスク</div>
                <button onClick={()=>setEditing(true)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:"#aaa" }}>✏️</button>
              </div>
            )}
            <div style={{ fontSize:12, color:"#b07030", marginTop:4 }}>{activePetData.name}といっしょ</div>
          </div>
        </div>
        <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:12, letterSpacing:1 }}>実績</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {[
            { label:"累計タスク完了", value:`${stats.totalTasks}個`, emoji:"✅" },
            { label:"全完了した日数", value:`${stats.achievedDays}日`, emoji:"📅" },
            { label:"現在のストリーク", value:`${streak}日連続`, emoji:"🔥" },
            { label:"所持ポイント", value:`${points} pt`, emoji:"⭐" },
            { label:"獲得バッジ", value:`${earnedCount} / ${BADGE_DEFS.length}`, emoji:"🏅" },
            { label:"持っているペット", value:`${ownedPets.length}匹`, emoji:"🐾" },
          ].map(item=>(
            <div key={item.label} style={{ background:"#faf7f2", borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{item.emoji}</div>
              <div style={{ fontSize:18, fontWeight:900, color:"#333" }}>{item.value}</div>
              <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:10, letterSpacing:1 }}>持っているペット</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {ownedPets.map(id => {
            const p = PETS.find(pp=>pp.id===id); if (!p) return null;
            return (
              <div key={id} style={{ background:activePet===id?"linear-gradient(135deg,#fff7e0,#fde8bb)":"#faf7f2", border:`1.5px solid ${activePet===id?"#f4c842":"#f0e6d3"}`, borderRadius:12, padding:"8px 14px", textAlign:"center" }}>
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:32 }}><PetIcon pet={p} size={28}/></div>
                <div style={{ fontSize:10, color:"#aaa" }}>{p.name}</div>
                {activePet===id && <div style={{ fontSize:9, color:"#f97316", fontWeight:700 }}>使用中</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ヘルプパネル
// ─────────────────────────────────────────
function HelpPanel({ onClose }) {
  const [open, setOpen] = useState(null);
  const items = [
    { q:"タスクの入れ方", a:"テキストボックスにやることを入力してEnterまたは「追加」を押します。スペース・読点・改行で複数のタスクを一気に入れられます。\n\n例：「ゴミ出し 洗濯 買い物」" },
    { q:"時間はどう書けばいい？", a:"自然な書き方に対応しています。\n\n・12時 / 12:00 / 12：00\n・12時半 / 12時30分\n・午後3時 / 午前10時30分\n\n時間を書くとタスクカードに⏰が表示されます。" },
    { q:"ポイントの仕組みは？", a:"・タスク1つ完了 → 10pt\n・全タスク完了ボーナス → 100pt（1日1回のみ）\n\n貯めたポイントでショップのペットやアイテムが買えます。" },
    { q:"おまもりって何？", a:"ショップで1000ptで買えるアイテムです。\n\n毎日タスクを全完了するとストリーク（連続日数）が伸びますが、おまもりを持っていると途切れた時に1回だけ守ってくれます。" },
    { q:"バッジはどうもらえる？", a:"タスク完了数・連続日数・ポイントなどの節目で自動的にもらえます。バッジタブで全種類と取得条件を確認できます。" },
    { q:"ペットの気分は変わる？", a:"今日完了したタスクの数によって変わります。\n\n0個：zzz…（寝てる）\n1〜2個：ん…\n3〜4個：まあね\n5〜7個：いいね！\n8個以上：最高！！" },
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 24px 48px", width:"100%", maxWidth:420, animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="back" size={20} color="#888"/></button>
          <div style={{ fontSize:17, fontWeight:900, color:"#222" }}>❓ ヘルプ</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {items.map((item,i)=>(
            <div key={i} style={{ background:"#faf7f2", borderRadius:14, overflow:"hidden" }}>
              <button onClick={()=>setOpen(open===i?null:i)} style={{ width:"100%", padding:"14px 16px", background:"none", border:"none", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#333" }}>{item.q}</div>
                <div style={{ transform:open===i?"rotate(90deg)":"none", transition:"0.2s", flexShrink:0 }}><Icon name="chevron" size={16} color="#aaa"/></div>
              </button>
              {open===i && (
                <div style={{ padding:"0 16px 14px", fontSize:13, color:"#555", lineHeight:1.8, whiteSpace:"pre-line", borderTop:"1px solid #f0e6d3" }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop:20, background:"#fff8ed", borderRadius:14, padding:"14px 16px", fontSize:12, color:"#b07030", lineHeight:1.7 }}>
          🐻 だらクマより：<br/>やる気がない日も、1つだけやれたら十分です。少しずつでいいよ。
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// BottomNav
// ─────────────────────────────────────────
function BottomNav({ tab, onTab }) {
  const items = [
    { id:"home",     icon:"home",     label:"ホーム" },
    { id:"calendar", icon:"calendar", label:"カレンダー" },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, background:"#fff", borderTop:"1.5px solid #f0e6d3", display:"flex", boxSizing:"border-box", zIndex:50 }}>
      {items.map(item=>{
        const active = tab===item.id;
        const color = active?"#f97316":"#aaa";
        return (
          <button key={item.id} onClick={()=>onTab(item.id)} style={{ flex:1, border:"none", background:"none", padding:"10px 0 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative" }}>
            {active && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:32, height:3, background:"#f97316", borderRadius:"0 0 3px 3px" }}/>}
            <Icon name={item.icon} size={22} color={color}/>
            <span style={{ fontSize:10, fontWeight:active?700:500, color }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
// Main App
// ─────────────────────────────────────────
export default function App() {
  // localStorage helpers
  const load = (key, fallback) => {
    if (typeof window === "undefined") return fallback;
    try {
      const v = localStorage.getItem("daratask_" + key);
      if (v === null) return fallback;
      return JSON.parse(v);
    } catch { return fallback; }
  };
  const savedDate = load("lastDate", null);
  const isNewDay = savedDate !== todayKey();

  const [nickname, setNickname] = useState(() => load("nickname", "だら"));
  const [tab, setTab] = useState("home");
  const [tasks, setTasks] = useState(() => load("tasks", []));
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [newIds, setNewIds] = useState([]);
  const [showDone, setShowDone] = useState(false);

  const [points, setPoints] = useState(() => load("points", 0));
  const [totalPoints, setTotalPoints] = useState(() => load("totalPoints", 0));
  const [totalTasks, setTotalTasks] = useState(() => load("totalTasks", 0));
  const [streak, setStreak] = useState(() => load("streak", 1));
  const [completedToday, setCompletedToday] = useState(() => isNewDay ? 0 : load("completedToday", 0));
  const [bonusPaidToday, setBonusPaidToday] = useState(() => isNewDay ? false : load("bonusPaidToday", false));
  const [achievedDates, setAchievedDates] = useState(() => new Set(load("achievedDates", [])));

  const [showBonus, setShowBonus] = useState(false);
  const [bonusAmt, setBonusAmt] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [taskSpeech, setTaskSpeech] = useState(null);
  const [showOmamori, setShowOmamori] = useState(false);
  const [idleSpeech, setIdleSpeech] = useState(null);
  const [zeroSpeech, setZeroSpeech] = useState(() => Math.random() > 0.4 ? pickRandom(BEAR_LINES.zero) : pickRandom(BEAR_LINES.nudge));

  useEffect(() => {
    if (tasks.length > 0 && completedToday === 0) {
      setZeroSpeech(Math.random() > 0.4 ? pickRandom(BEAR_LINES.zero) : pickRandom(BEAR_LINES.nudge));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  const [ownedPets, setOwnedPets] = useState(() => load("ownedPets", ["bear"]));
  const [activePet, setActivePet] = useState(() => load("activePet", "bear"));
  const [hasOmamori, setHasOmamori] = useState(() => load("hasOmamori", true));

  const [earnedBadges, setEarnedBadges] = useState(() => load("earnedBadges", []));
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [notifOn, setNotifOn] = useState(true);
  const [planTime, setPlanTime] = useState("09:00");

  // localStorage save effects
  useEffect(() => { localStorage.setItem("daratask_nickname",      JSON.stringify(nickname));      }, [nickname]);
  useEffect(() => { localStorage.setItem("daratask_tasks",         JSON.stringify(tasks));         }, [tasks]);
  useEffect(() => { localStorage.setItem("daratask_points",        JSON.stringify(points));        }, [points]);
  useEffect(() => { localStorage.setItem("daratask_totalPoints",   JSON.stringify(totalPoints));   }, [totalPoints]);
  useEffect(() => { localStorage.setItem("daratask_totalTasks",    JSON.stringify(totalTasks));    }, [totalTasks]);
  useEffect(() => { localStorage.setItem("daratask_streak",        JSON.stringify(streak));        }, [streak]);
  useEffect(() => { localStorage.setItem("daratask_completedToday",JSON.stringify(completedToday));}, [completedToday]);
  useEffect(() => { localStorage.setItem("daratask_bonusPaidToday",JSON.stringify(bonusPaidToday));}, [bonusPaidToday]);
  useEffect(() => { localStorage.setItem("daratask_achievedDates", JSON.stringify([...achievedDates])); }, [achievedDates]);
  useEffect(() => { localStorage.setItem("daratask_ownedPets",     JSON.stringify(ownedPets));     }, [ownedPets]);
  useEffect(() => { localStorage.setItem("daratask_activePet",     JSON.stringify(activePet));     }, [activePet]);
  useEffect(() => { localStorage.setItem("daratask_hasOmamori",    JSON.stringify(hasOmamori));    }, [hasOmamori]);
  useEffect(() => { localStorage.setItem("daratask_earnedBadges",  JSON.stringify(earnedBadges));  }, [earnedBadges]);
  useEffect(() => { localStorage.setItem("daratask_lastDate",      JSON.stringify(todayKey()));    }, []);

  const inputRef = useRef(null);
  const idleTimer = useRef(null);

  useEffect(() => {
    const reset = () => {
      setIdleSpeech(null);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setIdleSpeech(pickRandom(BEAR_LINES.idle));
        setTimeout(() => setIdleSpeech(null), 4000);
      }, 3 * 60 * 1000);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    reset();
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const activeTasks = tasks.filter(t=>!t.done);
  const doneTasks   = tasks.filter(t=>t.done);
  const activePetData = PETS.find(p=>p.id===activePet)||PETS[0];
  const stats = { totalTasks, totalPoints, streak, achievedDays:achievedDates.size, ownedPets, hasOmamori };

  const checkBadges = (newStats) => {
    const newly = BADGE_DEFS.filter(b => b.check(newStats) && !earnedBadges.includes(b.id));
    if (newly.length > 0) {
      setEarnedBadges(prev => [...prev, ...newly.map(b=>b.id)]);
      setBadgeQueue(q => [...q, ...newly]);
      return newly;
    }
    return [];
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setParsing(true);
    await new Promise(r=>setTimeout(r,300));
    const parsed = parseTasksFromText(input);
    const ids = parsed.map(t=>t.id);
    setNewIds(ids); setTasks(prev=>[...prev,...parsed]);
    setInput(""); setParsing(false);
    setTimeout(()=>setNewIds([]),1000);
    inputRef.current?.focus();
  };

  const handleToggle = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id!==id) return t;
      const nowDone = !t.done;
      if (nowDone) {
        setPoints(p=>p+10); setTotalPoints(p=>p+10);
        setTotalTasks(n=>n+1); setCompletedToday(c=>c+1);
        const speech = pickRandom(BEAR_LINES.done);
        setTaskSpeech(speech);
        setTimeout(() => setTaskSpeech(null), 2500);
        const newTT = totalTasks+1; const newTP = totalPoints+10;
        checkBadges({ totalTasks:newTT, totalPoints:newTP, streak, achievedDays:achievedDates.size, ownedPets, hasOmamori });
        const remaining = prev.filter(tt=>!tt.done&&tt.id!==id);
        if (remaining.length===0 && prev.some(tt=>!tt.done)) {
          const bonus = bonusPaidToday ? 0 : 100;
          if (!bonusPaidToday) { setPoints(p=>p+bonus); setTotalPoints(p=>p+bonus); setBonusPaidToday(true); }
          setAchievedDates(s=>new Set([...s,todayKey()]));
          const newAD = achievedDates.size+1;
          const newStats = { totalTasks:newTT, totalPoints:newTP+bonus, streak, achievedDays:newAD, ownedPets, hasOmamori };
          const newly = checkBadges(newStats);
          setBonusAmt(bonus); setNewBadges(newly);
          setTaskSpeech(pickRandom(BEAR_LINES.allDone));
          setTimeout(() => setTaskSpeech(null), 4000);
          setTimeout(()=>setShowBonus(true),300);
        }
      }
      return {...t,done:nowDone};
    }));
  };

  const handleDelete = (id) => setTasks(prev=>prev.filter(t=>t.id!==id));

  const handleMarkAllDone = () => {
    const activeCount = activeTasks.length; if (!activeCount) return;
    const taskPts = activeCount*10;
    const bonus = bonusPaidToday ? 0 : 100;
    setPoints(p=>p+taskPts+bonus); setTotalPoints(p=>p+taskPts+bonus);
    setTotalTasks(n=>n+activeCount); setCompletedToday(c=>c+activeCount);
    if (!bonusPaidToday) setBonusPaidToday(true);
    setTasks(prev=>prev.map(t=>({...t,done:true})));
    setAchievedDates(s=>new Set([...s,todayKey()]));
    const newStats = { totalTasks:totalTasks+activeCount, totalPoints:totalPoints+taskPts+bonus, streak, achievedDays:achievedDates.size+1, ownedPets, hasOmamori };
    const newly = checkBadges(newStats);
    setTaskSpeech(pickRandom(BEAR_LINES.allDone));
    setTimeout(() => setTaskSpeech(null), 4000);
    setBonusAmt(bonus); setNewBadges(newly); setShowBonus(true);
  };

  const handleBuyPet = (pet) => {
    if (points<pet.cost||ownedPets.includes(pet.id)) return;
    setPoints(p=>p-pet.cost); setOwnedPets(prev=>[...prev,pet.id]); setActivePet(pet.id);
    checkBadges({...stats, ownedPets:[...ownedPets,pet.id]});
  };
  const handleBuyOmamori = () => {
    if (points<OMAMORI.cost||hasOmamori) return;
    setPoints(p=>p-OMAMORI.cost); setHasOmamori(true);
    checkBadges({...stats,hasOmamori:true});
  };
  const handleReset = () => {
    ["nickname","tasks","points","totalPoints","totalTasks","streak","completedToday","bonusPaidToday","achievedDates","ownedPets","activePet","hasOmamori","earnedBadges","lastDate"].forEach(k=>localStorage.removeItem("daratask_"+k));
    setTasks([]); setPoints(0); setTotalPoints(0); setTotalTasks(0);
    setStreak(1); setCompletedToday(0); setBonusPaidToday(false);
    setAchievedDates(new Set()); setOwnedPets(["bear"]); setActivePet("bear");
    setHasOmamori(false); setEarnedBadges([]); setBadgeQueue([]);
  };

  return (
    <>
      <Head>
        <title>だらタスク</title>
        <meta name="description" content="やる気ゼロでも続けられるタスク管理アプリ"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="icon" href="/favicon.ico"/>
      </Head>
      <div style={{ minHeight:"100vh", background:"#faf7f2", fontFamily:"'Hiragino Sans','Hiragino Kaku Gothic ProN','Meiryo',sans-serif", maxWidth:420, margin:"0 auto", paddingBottom:80 }}>
        <style>{`
          @keyframes popIn        { from{transform:scale(0.85);opacity:0} to{transform:scale(1);opacity:1} }
          @keyframes slideIn      { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes slideUp      { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes slideFromRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
          @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.5} }
          @keyframes badgeBounce  { 0%{transform:scale(0) rotate(-10deg)} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0deg)} }
          .task-new { animation: slideIn 0.35s cubic-bezier(.22,1,.36,1) forwards; }
          * { box-sizing: border-box; }
        `}</style>

        {showMenu    && <HamburgerMenu onClose={()=>setShowMenu(false)} onOpen={id=>setActivePanel(id)}/>}
        {showOmamori && <OmamoriPopup onClose={()=>setShowOmamori(false)}/>}
        {showBonus   && <AllDoneModal onClose={()=>setShowBonus(false)} streak={streak} bonus={bonusAmt} newBadges={newBadges}/>}
        {badgeQueue.length > 0 && !showBonus && <BadgePopup badge={badgeQueue[0]} onClose={()=>setBadgeQueue(q=>q.slice(1))}/>}
        {idleSpeech && !taskSpeech && (
          <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"#fff", border:"1.5px solid #e0e0e0", borderRadius:99, padding:"10px 20px", fontSize:14, fontWeight:700, color:"#888", boxShadow:"0 4px 20px rgba(0,0,0,0.1)", zIndex:150, whiteSpace:"nowrap", animation:"popIn 0.3s cubic-bezier(.22,1,.36,1)", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>🐻</span>{idleSpeech}
          </div>
        )}
        {activePanel==="settings" && <SettingsPanel onClose={()=>setActivePanel(null)} notifOn={notifOn} setNotifOn={setNotifOn} planTime={planTime} setPlanTime={setPlanTime} onReset={handleReset}/>}
        {activePanel==="profile"  && <ProfilePanel  onClose={()=>setActivePanel(null)} nickname={nickname} setNickname={setNickname} stats={stats} ownedPets={ownedPets} activePet={activePet} points={points} streak={streak}/>}
        {activePanel==="help"     && <HelpPanel     onClose={()=>setActivePanel(null)}/>}
        {activePanel==="shop"  && <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)"}}><div style={{display:"flex",alignItems:"center",gap:12,padding:"24px 24px 0"}}><button onClick={()=>setActivePanel(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon name="back" size={20} color="#888"/></button><div style={{fontSize:17,fontWeight:900,color:"#222"}}>🏪 ショップ</div></div><ShopScreen points={points} ownedPets={ownedPets} activePet={activePet} hasOmamori={hasOmamori} onBuyPet={handleBuyPet} onSelectPet={id=>{setActivePet(id);setActivePanel(null);}} onBuyOmamori={handleBuyOmamori}/></div></div>}
        {activePanel==="pet"   && <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)"}}><div style={{display:"flex",alignItems:"center",gap:12,padding:"24px 24px 0"}}><button onClick={()=>setActivePanel(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon name="back" size={20} color="#888"/></button><div style={{fontSize:17,fontWeight:900,color:"#222"}}>🐾 マイペット</div></div><PetScreen activePet={activePet} ownedPets={ownedPets} completedToday={completedToday} onGoShop={()=>setActivePanel("shop")} onSelectPet={id=>setActivePet(id)}/></div></div>}
        {activePanel==="badge" && <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.35s cubic-bezier(.22,1,.36,1)"}}><div style={{display:"flex",alignItems:"center",gap:12,padding:"24px 24px 0"}}><button onClick={()=>setActivePanel(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Icon name="back" size={20} color="#888"/></button><div style={{fontSize:17,fontWeight:900,color:"#222"}}>🏅 バッジ</div></div><BadgeScreen stats={stats}/></div></div>}

        {/* トップバー */}
        <div style={{ position:"sticky", top:0, background:"#faf7f2", zIndex:40, borderBottom:"1px solid #f0e6d3" }}>
          {tab === "home" ? (
            <div style={{ padding:"14px 20px 0", display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:"#f97316", letterSpacing:1 }}>だらタスク</div>
                    <h1 style={{ fontSize:19, fontWeight:900, color:"#222", margin:"2px 0 0" }}>{nickname}のタスク</h1>
                    <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>🔥 {streak}日連続</div>
                  </div>
                  <button onClick={()=>setShowMenu(true)} style={{ background:"#fff", border:"1.5px solid #f0e6d3", borderRadius:12, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                    <Icon name="menu" size={18} color="#888"/>
                  </button>
                </div>
                <PointBar points={points}/>
                <div style={{ height:10 }}/>
              </div>
              <div style={{ position:"relative", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center" }}>
                {taskSpeech && (
                  <div style={{ background:"#fff", border:"1.5px solid #f4c842", borderRadius:12, padding:"6px 10px", fontSize:11, fontWeight:700, color:"#f97316", whiteSpace:"nowrap", marginBottom:6, position:"relative", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", animation:"popIn 0.3s cubic-bezier(.22,1,.36,1)" }}>
                    {taskSpeech}
                    <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:0, height:0, borderLeft:"7px solid transparent", borderRight:"7px solid transparent", borderTop:"8px solid #f4c842" }}/>
                    <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)", width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"7px solid #fff" }}/>
                  </div>
                )}
                <div style={{ width:90, height:90, borderRadius:"50%", border:"2px solid #f0e6d3", background:"linear-gradient(135deg,#fff7e0,#fde8bb)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  <PetIcon pet={activePetData} size={72}/>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding:"14px 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#f97316", letterSpacing:1 }}>だらタスク</div>
                <h1 style={{ fontSize:18, fontWeight:900, color:"#222", margin:"2px 0 0" }}>{{home:"今日のタスク",calendar:"カレンダー"}[tab]}</h1>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", border:"1.5px solid #f0e6d3", background:"linear-gradient(135deg,#fff7e0,#fde8bb)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  <PetIcon pet={activePetData} size={34}/>
                </div>
                <button onClick={()=>setShowMenu(true)} style={{ background:"#fff", border:"1.5px solid #f0e6d3", borderRadius:12, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <Icon name="menu" size={18} color="#888"/>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ホーム */}
        {tab==="home" && (
          <div style={{ padding:"16px 20px 0" }}>
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #f0e6d3", overflow:"hidden", boxShadow:"0 2px 12px rgba(244,200,66,0.08)", marginBottom:16 }}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSubmit();}}}
                placeholder={"ゴミ出し 洗濯 12時半に銀行入金\n（スペースや読点でまとめてOK！）"} rows={3}
                style={{ width:"100%", border:"none", outline:"none", padding:"14px 16px", fontSize:14, fontFamily:"inherit", resize:"none", background:"transparent", color:"#333", lineHeight:1.7 }}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderTop:"1px solid #f5f0e8" }}>
                <span style={{ fontSize:11, color:"#bbb" }}>Enterで追加・時間も認識するよ</span>
                <button onClick={handleSubmit} disabled={!input.trim()||parsing} style={{ background:input.trim()?"linear-gradient(90deg,#f4c842,#f97316)":"#eee", border:"none", borderRadius:99, padding:"8px 18px", color:input.trim()?"#fff":"#bbb", fontWeight:700, fontSize:13, cursor:input.trim()?"pointer":"default", animation:parsing?"pulse 0.8s infinite":"none" }}>
                  {parsing?"分割中…":"追加"}
                </button>
              </div>
            </div>

            {activeTasks.length>0&&(
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:12, color:"#aaa", fontWeight:700 }}>やること ({activeTasks.length}) · 1つ10pt</span>
                  {activeTasks.length>1&&<button onClick={handleMarkAllDone} style={{ fontSize:11, color:"#f97316", background:"none", border:"1px solid #f97316", borderRadius:99, padding:"3px 10px", cursor:"pointer" }}>全部完了</button>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {activeTasks.map(t=>(
                    <div key={t.id} className={newIds.includes(t.id)?"task-new":""}>
                      <TaskCard task={t} onToggle={handleToggle} onDelete={handleDelete}/>
                    </div>
                  ))}
                </div>
              </>
            )}
            {doneTasks.length>0&&(
              <div style={{ marginTop:20 }}>
                <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#bbb", fontWeight:700, display:"flex", alignItems:"center", gap:4, padding:0, marginBottom:8 }}>
                  <span style={{ display:"inline-block", transform:showDone?"rotate(90deg)":"none", transition:"0.2s" }}>▶</span>完了 ({doneTasks.length})
                </button>
                {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:8 }}>{doneTasks.map(t=><TaskCard key={t.id} task={t} onToggle={handleToggle} onDelete={handleDelete}/>)}</div>}
              </div>
            )}
            {bonusPaidToday&&(
              <div style={{ margin:"16px 0 0", background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:12, padding:"10px 14px", fontSize:12, color:"#16a34a" }}>
                ✓ 今日の全完了ボーナス（100pt）は獲得済み！
              </div>
            )}
          </div>
        )}

        {tab==="calendar" && <CalendarScreen achievedDates={achievedDates}/>}

        <BottomNav tab={tab} onTab={setTab}/>
      </div>
    </>
  );
}
