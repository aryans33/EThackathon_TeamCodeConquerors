"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOHLCV, getStocks } from "@/lib/api";

/* ─────────────────────────────────────────────
   TRUE CSS 3D CUBOID  helper
   w / h / d  = width / height / depth (px)
   children rendered on the FRONT face only
───────────────────────────────────────────── */
function Cuboid({
  w, h, d,
  faceColor = "rgba(10,10,14,0.98)",
  topColor   = "rgba(18,18,26,0.98)",
  sideColor  = "rgba(6,6,10,0.98)",
  borderColor = "rgba(212,175,55,0.25)",
  children,
  style = {},
}: {
  w: number; h: number; d: number;
  faceColor?: string; topColor?: string; sideColor?: string; borderColor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const shared: React.CSSProperties = {
    position: "absolute",
    boxSizing: "border-box",
    border: `1px solid ${borderColor}`,
    backfaceVisibility: "hidden",
  };

  return (
    <div style={{ width: w, height: h, position: "relative", transformStyle: "preserve-3d", ...style }}>
      {/* FRONT */}
      <div style={{
        ...shared,
        width: w, height: h,
        background: faceColor,
        transform: `translateZ(${d / 2}px)`,
        borderRadius: 2,
        overflow: "hidden",
      }}>
        {/* top accent line */}
        <div style={{ position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.6),rgba(56,189,248,0.4),transparent)" }}/>
        {/* corner accent TL */}
        <div style={{ position:"absolute",top:0,left:0,width:16,height:16,borderTop:"1px solid rgba(212,175,55,0.7)",borderLeft:"1px solid rgba(212,175,55,0.7)" }}/>
        {/* corner accent BR */}
        <div style={{ position:"absolute",bottom:0,right:0,width:16,height:16,borderBottom:"1px solid rgba(212,175,55,0.7)",borderRight:"1px solid rgba(212,175,55,0.7)" }}/>
        {children}
      </div>

      {/* BACK */}
      <div style={{
        ...shared,
        width: w, height: h,
        background: sideColor,
        transform: `translateZ(${-d / 2}px) rotateY(180deg)`,
        borderRadius: 2,
      }}/>

      {/* LEFT */}
      <div style={{
        ...shared,
        width: d, height: h,
        background: sideColor,
        left: -d / 2,
        transform: `rotateY(-90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "right center",
      }}/>

      {/* RIGHT */}
      <div style={{
        ...shared,
        width: d, height: h,
        background: sideColor,
        left: w - d / 2,
        transform: `rotateY(90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "left center",
      }}/>

      {/* TOP */}
      <div style={{
        ...shared,
        width: w, height: d,
        background: topColor,
        top: -d / 2,
        transform: `rotateX(90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "center bottom",
      }}/>

      {/* BOTTOM */}
      <div style={{
        ...shared,
        width: w, height: d,
        background: "rgba(0,0,0,0.7)",
        top: h - d / 2,
        transform: `rotateX(-90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "center top",
      }}/>
    </div>
  );
}

/* ── mini bar chart ── */
function MiniBar({ vals, accent = "#d4af37" }: { vals: number[]; accent?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:40 }}>
      {vals.map((v,i) => (
        <div key={i} style={{
          flex:1, height:`${v}%`, borderRadius:"1px 1px 0 0",
          background: i===3
            ? accent
            : `rgba(212,175,55,${0.15+v/250})`,
          transition: `height .5s ease ${i*.07}s`,
          boxShadow: i===3 ? `0 0 8px rgba(212,175,55,0.5)` : "none",
        }}/>
      ))}
    </div>
  );
}

/* ── mini line chart ── */
function MiniLine({ id, color="#d4af37", path, fillPath }: { id:string; color?:string; path:string; fillPath:string }) {
  return (
    <svg width="100%" height="42" viewBox="0 0 180 42" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

/* ─────────── card contents ─────────── */
const PortfolioContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
      <div style={{ fontSize:7, color:"#d4af37", fontWeight:700, letterSpacing:2, fontFamily:"'Space Mono',monospace" }}>PORTFOLIO</div>
      <div style={{ fontSize:7, color:"rgba(212,175,55,0.5)", fontFamily:"'Space Mono',monospace" }}>Q4 2024</div>
    </div>
    <MiniBar vals={[55,80,42,100,68,50,75]}/>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, marginTop:6 }}>
      {["₹2.4L","₹89K","₹1.1L","₹34K"].map((v,i)=>(
        <div key={i} style={{
          background:"rgba(212,175,55,0.05)",
          borderLeft: "1px solid rgba(212,175,55,0.3)",
          padding:"3px 5px",
        }}>
          <div style={{ fontSize:5.5, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace", letterSpacing:0.5 }}>{["EQ","NFT","COIN","F&O"][i]}</div>
          <div style={{ fontSize:9, color:"#d4af37", fontWeight:700, fontFamily:"'Space Mono',monospace" }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

const NiftyContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
      <div style={{ fontSize:7, color:"#d4af37", fontWeight:700, letterSpacing:2, fontFamily:"'Space Mono',monospace" }}>NIFTY 50</div>
      <span style={{ fontSize:6, background:"rgba(56,189,248,0.1)", color:"#d4af37", border:"1px solid rgba(56,189,248,0.25)", padding:"1px 5px", letterSpacing:0.5, fontFamily:"'Space Mono',monospace" }}>▲ +1.24%</span>
    </div>
    <div style={{ fontSize:17, fontWeight:700, color:"#ffffff", marginBottom:1, fontFamily:"'Space Mono',monospace", letterSpacing:-0.5 }}>22,419<span style={{fontSize:8, color:"rgba(255,255,255,0.3)", marginLeft:3}}>pts</span></div>
    <MiniLine id="niftyG" color="#d4af37"
      path="M0,38 C25,32 45,24 70,18 C95,12 110,20 135,10 C155,4 170,5 180,3"
      fillPath="M0,38 C25,32 45,24 70,18 C95,12 110,20 135,10 C155,4 170,5 180,3 L180,42 L0,42Z"/>
    <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
      {["NSE","BSE","MCX","NCDEX"].map(ex=>(
        <div key={ex} style={{ fontSize:5.5, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace" }}>{ex}</div>
      ))}
    </div>
    <div style={{ marginTop:5, padding:"4px 6px", background:"rgba(212,175,55,0.06)", borderLeft:"1.5px solid rgba(212,175,55,0.4)" }}>
      <div style={{ fontSize:6.5, color:"#d4af37", fontWeight:600, fontFamily:"'Space Mono',monospace" }}>TOP: HDFC NIFTY 50 ETF</div>
    </div>
  </div>
);

const MutualContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
      <div style={{ fontSize:7, color:"#d4af37", fontWeight:700, letterSpacing:2, fontFamily:"'Space Mono',monospace" }}>MF ANALYSIS</div>
      <span style={{ fontSize:9, color:"#4ade80", fontWeight:700, fontFamily:"'Space Mono',monospace" }}>+18.4%</span>
    </div>
    <MiniLine id="mfG" color="#d4af37"
      path="M0,40 C30,34 55,28 80,20 C105,13 125,18 155,10 C168,7 175,6 180,5"
      fillPath="M0,40 C30,34 55,28 80,20 C105,13 125,18 155,10 C168,7 175,6 180,5 L180,42 L0,42Z"/>
    <div style={{ marginTop:2, fontSize:6.5, color:"rgba(255,255,255,0.35)", fontFamily:"'Space Mono',monospace" }}>vs Nifty 15 benchmark</div>
    <div style={{ display:"flex", gap:4, marginTop:6 }}>
      {[["TOP","Axis BF","▲31%","#4ade80"],["LOW","SBI Cons","▲9%","rgba(212,175,55,0.6)"]].map(([l,n,v,c],i)=>(
        <div key={i} style={{ flex:1, background:"rgba(255,255,255,0.03)", borderTop:`1px solid ${c}`, padding:"4px 5px" }}>
          <div style={{ fontSize:5.5, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace", marginBottom:1 }}>{l}</div>
          <div style={{ fontSize:7, color:"#e2e8f0", fontWeight:600, fontFamily:"'Space Mono',monospace" }}>{n}</div>
          <div style={{ fontSize:8.5, color:c as string, fontFamily:"'Space Mono',monospace" }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

const AIContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ fontSize:7, color:"#d4af37", fontWeight:700, letterSpacing:2, fontFamily:"'Space Mono',monospace", marginBottom:5 }}>AI SIGNALS</div>
    {[
      ["Parag Parikh FC","MULTI","24.3%"],
      ["ICICI Pru Tech","SECTOR","31.1%"],
      ["HDFC Balanced","HYBRID","15.7%"],
      ["Nippon Small","S.CAP","19.2%"],
    ].map(([name,tag,ret],i)=>(
      <div key={i} style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"3px 5px", marginBottom:2.5,
        background:"rgba(255,255,255,0.02)",
        borderLeft:`1.5px solid rgba(212,175,55,${0.2+i*0.15})`
      }}>
        <div>
          <div style={{ fontSize:7, color:"#e2e8f0", fontWeight:600, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"'Space Mono',monospace" }}>{name}</div>
          <div style={{ fontSize:5.5, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace", letterSpacing:0.5 }}>{tag}</div>
        </div>
        <div style={{ fontSize:9, color:"#d4af37", fontWeight:700, fontFamily:"'Space Mono',monospace" }}>+{ret}</div>
      </div>
    ))}
  </div>
);

/* ── Connector lines with animated current flow ── */
function Connectors({ cx, cy, firing, centreGlow }: {
  cx: number; cy: number;
  firing: boolean;
  centreGlow: boolean;
}) {
  const pts = [
    { x: -220, y: -10 },
    { x:  220, y: -110 },
    { x: -220, y:  110 },
    { x:  220, y:  110 },
  ];
  const W = 700, H = 440;
  const ox = W/2 + cx, oy = H/2 + cy;

  return (
    <svg width={W} height={H} style={{ position:"absolute", top:0, left:0, pointerEvents:"none", zIndex:0 }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ballGlow">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="centreGlowF" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="10" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {pts.map((_,i) => (
          <linearGradient key={i} id={`trail${i}`} gradientUnits="userSpaceOnUse"
            x1={ox + pts[i].x} y1={oy + pts[i].y} x2={ox} y2={oy}>
            <stop offset="0%"   stopColor="#d4af37" stopOpacity="0"/>
            <stop offset="55%"  stopColor="#d4af37" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#fde68a" stopOpacity="1"/>
          </linearGradient>
        ))}
      </defs>

      {/* static dashed base lines */}
      {pts.map((p,i) => (
        <line key={i}
          x1={ox} y1={oy} x2={ox+p.x} y2={oy+p.y}
          stroke="rgba(212,175,55,0.1)" strokeWidth={1} strokeDasharray="4 6"
        />
      ))}

      {/* endpoint dots */}
      {pts.map((p,i) => (
        <circle key={i} cx={ox+p.x} cy={oy+p.y} r={2.5} fill="rgba(212,175,55,0.35)"/>
      ))}

      {/* animated glowing trails + orbs */}
      {firing && pts.map((p,i) => {
        const delay = `${i * 0.12}s`;
        const dur   = "3s";
        const x1 = ox + p.x, y1 = oy + p.y;
        const x2 = ox,        y2 = oy;
        return (
          <g key={`trail-${i}`}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`url(#trail${i})`} strokeWidth={2.5}
              strokeDasharray="600" strokeDashoffset="600"
              style={{ animation: `dashFlow 3s ${delay} linear forwards` }}
            />
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`url(#trail${i})`} strokeWidth={7} opacity={0.15}
              strokeDasharray="600" strokeDashoffset="600"
              style={{ animation: `dashFlow 3s ${delay} linear forwards` }}
            />
            <circle r={5} fill="#fde68a" filter="url(#ballGlow)" opacity="0">
              <animateMotion dur={dur} begin={delay} fill="freeze" calcMode="linear"
                path={`M${x1},${y1} L${x2},${y2}`}/>
              <animate attributeName="opacity" values="0;1;1;0"
                keyTimes="0;0.05;0.92;1" dur={dur} begin={delay} fill="freeze"/>
            </circle>
            <circle r={10} fill="#d4af37" filter="url(#ballGlow)" opacity="0">
              <animateMotion dur={dur} begin={delay} fill="freeze" calcMode="linear"
                path={`M${x1},${y1} L${x2},${y2}`}/>
              <animate attributeName="opacity" values="0;0.2;0.2;0"
                keyTimes="0;0.05;0.92;1" dur={dur} begin={delay} fill="freeze"/>
            </circle>
          </g>
        );
      })}

      {/* centre hub */}
      {!centreGlow && (
        <circle cx={ox} cy={oy} r={5} fill="rgba(212,175,55,0.6)" filter="url(#glow)"/>
      )}
      {centreGlow && (
        <>
          <circle cx={ox} cy={oy} r={26} fill="rgba(212,175,55,0.08)" filter="url(#centreGlowF)"
            style={{ animation:"centreBurst 0.8s ease-out forwards" }}/>
          <circle cx={ox} cy={oy} r={10} fill="rgba(253,230,138,0.95)" filter="url(#ballGlow)"
            style={{ animation:"centreBurst 0.8s ease-out forwards" }}/>
        </>
      )}
    </svg>
  );
}

/* ── Skeleton loader ── */
function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(212,175,55,0.07)" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        <div style={{ width: 90, height: 10, background: "rgba(255,255,255,0.06)", animation: "stockPulse 1.5s infinite" }} />
        <div style={{ width: 140, height: 8, background: "rgba(255,255,255,0.04)", animation: "stockPulse 1.5s infinite" }} />
      </div>
      <div style={{ width: 70, height: 10, background: "rgba(255,255,255,0.06)", animation: "stockPulse 1.5s infinite" }} />
    </div>
  );
}

/* ── Watchlist component ── */
function WatchlistSection({ isMobile = false }: { isMobile?: boolean }) {
  const router = useRouter();
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const FALLBACK_STOCKS = [
    { symbol: "TATAMOTORS", name: "Tata Motors Ltd", current_price: 670.26, change_pct: -0.51, closes: [678.4, 676.9, 675.8, 674.6, 673.9, 672.4, 671.5, 670.26] },
    { symbol: "HDFCBANK", name: "HDFC Bank", current_price: 1308.61, change_pct: -1.03, closes: [1328.8, 1324.1, 1320.4, 1318.2, 1315.4, 1312.8, 1310.6, 1308.61] },
    { symbol: "INFY", name: "Infosys Ltd", current_price: 2120.04, change_pct: 1.93, closes: [2054.8, 2061.7, 2070.2, 2082.5, 2093.1, 2104.6, 2112.3, 2120.04] },
    { symbol: "RELIANCE", name: "Reliance Industries Ltd", current_price: 2901.01, change_pct: -0.50, closes: [2931.6, 2927.2, 2922.7, 2918.8, 2914.5, 2910.9, 2906.3, 2901.01] },
    { symbol: "SBIN", name: "State Bank of India", current_price: 1229.55, change_pct: 1.44, closes: [1206.2, 1210.6, 1215.3, 1219.8, 1222.9, 1225.7, 1228.1, 1229.55] },
  ];

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const allStocks = await getStocks();
      const enriched = await Promise.all(
        allStocks.map(async (stock) => {
          try {
            const ohlcv = await getOHLCV(stock.symbol, 14);
            const rows = (ohlcv || [])
              .slice()
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(-12);
            if (rows.length < 2) return null;

            const prev = Number(rows[rows.length - 2].close);
            const latest = Number(rows[rows.length - 1].close);
            const change = latest - prev;
            const changePct = prev ? (change / prev) * 100 : 0;

            return {
              symbol: stock.symbol,
              name: stock.name,
              current_price: latest,
              prev_price: prev,
              change,
              change_pct: changePct,
              closes: rows.map((r) => Number(r.close)),
            };
          } catch {
            return null;
          }
        })
      );

      const valid = enriched.filter(Boolean);
      if (valid.length === 0) {
        setStocks(FALLBACK_STOCKS);
      } else {
        const liveMap = new Map(valid.map((s: any) => [s.symbol, s]));
        const merged = FALLBACK_STOCKS.map((f) => liveMap.get(f.symbol) || f);
        setStocks(merged);
      }
    } catch {
      setStocks(FALLBACK_STOCKS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const id = setInterval(() => { fetchStocks(); }, 60000);
    return () => clearInterval(id);
  }, []);

  const Sparkline = ({ closes, positive }: { closes: number[]; positive: boolean }) => {
    const rawPoints = closes.length > 1 ? closes : [closes[0] || 0, closes[0] || 0];
    const points = rawPoints.length > 12
      ? rawPoints.filter((_, i) => i % Math.ceil(rawPoints.length / 12) === 0).slice(-12)
      : rawPoints;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(max - min, 1);
    const width = 72;
    const height = 26;
    const baseY = height - 1;
    const stroke = positive ? "#4ade80" : "#f87171";

    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1 || 1)) * width;
      const y = 2 + (1 - (v - min) / range) * (height - 6);
      return { x, y };
    });

    const linePath = coords
      .map((p, i, arr) => {
        if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        const prev = arr[i - 1];
        const cx = ((prev.x + p.x) / 2).toFixed(1);
        return `Q${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${cx},${((prev.y + p.y) / 2).toFixed(1)} T${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");

    const areaPath = `${linePath} L${width},${baseY} L0,${baseY} Z`;
    const last = coords[coords.length - 1];

    return (
      <svg width="72" height="26" viewBox="0 0 72 26">
        <path d={areaPath} fill={stroke} opacity={0.1} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="2" fill={stroke} />
        <circle cx={last.x} cy={last.y} r="4" fill={stroke} opacity="0.25" />
      </svg>
    );
  };

  return (
    <div style={{
      background: "rgba(8,8,12,0.95)",
      border: "1px solid rgba(212,175,55,0.2)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* top accent bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px", background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.6),rgba(56,189,248,0.4),transparent)" }}/>
      {/* corner accents */}
      <div style={{ position:"absolute", top:0, left:0, width:20, height:20, borderTop:"1px solid rgba(212,175,55,0.7)", borderLeft:"1px solid rgba(212,175,55,0.7)" }}/>
      <div style={{ position:"absolute", bottom:0, right:0, width:20, height:20, borderBottom:"1px solid rgba(212,175,55,0.7)", borderRight:"1px solid rgba(212,175,55,0.7)" }}/>

      {/* header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px 12px",
        borderBottom: "1px solid rgba(212,175,55,0.1)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:2, height:14, background:"linear-gradient(to bottom, #d4af37, rgba(212,175,55,0))" }}/>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.9)", fontWeight:700, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>TRACKED STOCKS</span>
        </div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:9, color:"#4ade80", fontFamily:"'Space Mono',monospace", letterSpacing:1 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"#4ade80", display:"inline-block", boxShadow:"0 0 6px #4ade80", animation:"stockPulse 1.5s infinite" }} />
          LIVE
        </div>
      </div>

      {/* column headers */}
      <div style={{
        display:"grid",
        gridTemplateColumns: isMobile ? "1fr auto auto" : "1fr auto auto auto",
        gap:0,
        padding: isMobile ? "6px 12px" : "6px 20px",
        background:"rgba(212,175,55,0.03)",
        borderBottom:"1px solid rgba(212,175,55,0.08)",
      }}>
        {(["SYMBOL", ...(isMobile ? [] : ["CHART"]), "PRICE", "CHANGE"] as string[]).map(h => (
          <div key={h} style={{ fontSize:7.5, color:"rgba(255,255,255,0.25)", fontFamily:"'Space Mono',monospace", letterSpacing:1.5, textAlign: h==="SYMBOL" ? "left" : "right" }}>{h}</div>
        ))}
      </div>

      {loading ? (
        <div>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : (
        <div>
          {stocks.slice(0, 5).map((stock, idx) => {
            const pct = Number(stock.change_pct || 0);
            const positive = pct >= 0;
            return (
              <div
                key={stock.symbol}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr auto auto" : "1fr auto auto auto",
                  alignItems: "center",
                  gap: isMobile ? 10 : 16,
                  padding: isMobile ? "12px 12px" : "12px 20px",
                  borderBottom: idx < 4 ? "1px solid rgba(212,175,55,0.06)" : "none",
                  cursor: "pointer",
                  transition: "background 0.2s, border-left 0.2s",
                  borderLeft: "2px solid transparent",
                }}
                onClick={() => router.push(`/stock/${stock.symbol}`)}
                onMouseOver={(e) => {
                  (e.currentTarget as any).style.background = "rgba(212,175,55,0.04)";
                  (e.currentTarget as any).style.borderLeft = "2px solid rgba(212,175,55,0.4)";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as any).style.background = "transparent";
                  (e.currentTarget as any).style.borderLeft = "2px solid transparent";
                }}
              >
                <div>
                  <div style={{ fontWeight:700, color:"#ffffff", fontSize: isMobile ? 11 : 12, fontFamily:"'Space Mono',monospace", letterSpacing:0.5 }}>{stock.symbol}</div>
                  <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, maxWidth: isMobile ? 120 : 160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2, fontFamily:"'DM Sans',sans-serif" }}>
                    {stock.name}
                  </div>
                </div>
                {!isMobile && <Sparkline closes={stock.closes || [stock.prev_price || stock.current_price, stock.current_price]} positive={positive} />}
                <div style={{ textAlign:"right", fontFamily:"'Space Mono',monospace" }}>
                  <div style={{ color:"#ffffff", fontSize: isMobile ? 11 : 12, fontWeight:600, letterSpacing:-0.3 }}>
                    ₹{Number(stock.current_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{
                  minWidth: isMobile ? 56 : 62, textAlign:"right",
                  fontSize:10, fontWeight:700, fontFamily:"'Space Mono',monospace",
                  color: positive ? "#4ade80" : "#f87171",
                  background: positive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                  border: `1px solid ${positive ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                  padding:"2px 6px",
                }}>
                  {positive ? "▲" : "▼"} {positive ? "+" : ""}{pct.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function EtRadarBrain3D() {
  const [mounted, setMounted] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isNarrow, setIsNarrow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [firing, setFiring] = useState(false);
  const [centreGlow, setCentreGlow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 120);
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1100);
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();

    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setMouse({
        x: (e.clientX - r.left - r.width  / 2) / (r.width  / 2),
        y: (e.clientY - r.top  - r.height / 2) / (r.height / 2),
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", handleResize);

    const runSequence = () => {
      setFiring(true);
      setCentreGlow(false);
      setTimeout(() => { setFiring(false); setCentreGlow(true); }, 3150);
      setTimeout(() => { setCentreGlow(false); }, 4400);
    };

    const t0 = setTimeout(runSequence, 800);
    const interval = setInterval(runSequence, 7000);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", handleResize);
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, []);

  const baseRX = isMobile ? 14 : 22;
  const baseRY = isMobile ? -18 : -28;
  const sceneTransform = `rotateX(${baseRX + mouse.y * -4}deg) rotateY(${baseRY + mouse.x * 5}deg)`;
  const sceneWidth = isNarrow ? 560 : 700;
  const sceneHeight = isNarrow ? 360 : 440;

  const cards = [
    { id:"tl", dx:-220, dy:-110, dz:0, w:210, h:155, d:14, content:<PortfolioContent/> },
    { id:"tr", dx: 220, dy:-110, dz:0, w:210, h:155, d:14, content:<NiftyContent/>    },
    { id:"bl", dx:-220, dy: 110, dz:0, w:210, h:145, d:14, content:<MutualContent/>   },
    { id:"br", dx: 220, dy: 110, dz:0, w:210, h:175, d:14, content:<AIContent/>       },
  ];

  return (
    <div
      ref={ref}
      className="scene-3d"
      style={{
        width:"100%", minHeight:"100dvh",
        background:"#060608",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start",
        fontFamily:"'DM Sans',sans-serif",
        overflow:"hidden", position:"relative",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet"/>

      {/* — BACKGROUND LAYERS — */}
      {/* subtle dot grid */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:"radial-gradient(circle, rgba(212,175,55,0.07) 1px, transparent 1px)",
        backgroundSize:"32px 32px"
      }}/>
      {/* vignette */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.85) 100%)"
      }}/>
      {/* gold ambient top-left */}
      <div style={{ position:"absolute", left:"-5%", top:"-5%", width:500, height:400,
        background:"radial-gradient(ellipse, rgba(212,175,55,0.06) 0%, transparent 70%)",
        pointerEvents:"none"
      }}/>
      {/* teal ambient right */}
      <div style={{ position:"absolute", right:"-5%", bottom:"10%", width:400, height:400,
        background:"radial-gradient(ellipse, rgba(56,189,248,0.05) 0%, transparent 70%)",
        pointerEvents:"none"
      }}/>

      {/* — TICKER TOP BAR — */}
      <div style={{
        width:"100%", borderBottom:"1px solid rgba(212,175,55,0.12)",
        background:"rgba(0,0,0,0.6)", backdropFilter:"blur(12px)",
        padding: isMobile ? "8px 12px" : "8px 40px", display:"flex", alignItems:"center", gap: isMobile ? 10 : 32,
        position:"relative", zIndex:20,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:12, color:"#d4af37", fontWeight:700, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>ET RADAR</div>
          <div style={{ width:1, height:14, background:"rgba(212,175,55,0.3)" }}/>
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.35)", fontFamily:"'Space Mono',monospace", letterSpacing:1 }}>WEALTH INTELLIGENCE</div>
        </div>
        <div style={{ flex:1, display: isMobile ? "none" : "flex", gap:24, overflow:"hidden" }}>
          {[["NIFTY 50","22,419.20","▲ +1.24%",true],["SENSEX","73,872.29","▲ +0.98%",true],["USD/INR","83.42","▼ -0.12%",false],["GOLD","₹62,840","▲ +0.33%",true]].map(([name,val,chg,up])=>(
            <div key={name as string} style={{ display:"flex", gap:8, alignItems:"center", whiteSpace:"nowrap" }}>
              <span style={{ fontSize:8, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace" }}>{name}</span>
              <span style={{ fontSize:9, color:"#ffffff", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{val}</span>
              <span style={{ fontSize:8, color: up ? "#4ade80" : "#f87171", fontFamily:"'Space Mono',monospace" }}>{chg}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"#4ade80", display:"inline-block", animation:"stockPulse 1.5s infinite", boxShadow:"0 0 8px #4ade80" }}/>
          <span style={{ fontSize:8, color:"#4ade80", fontFamily:"'Space Mono',monospace", letterSpacing:1 }}>MARKETS OPEN</span>
        </div>
      </div>

      {/* — MAIN CONTENT — */}
      <div style={{
        maxWidth:1280, width:"100%", padding:isMobile ? "24px 16px 0" : isNarrow ? "40px 24px 0" : "52px 56px 0",
        display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "1fr 1.05fr", gap:isMobile ? 20 : isNarrow ? 40 : 80,
        alignItems:"center"
      }}>

        {/* ── LEFT TEXT ── */}
        <div style={{ zIndex:10 }}>
          {/* eyebrow tag */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            marginBottom: isMobile ? 14 : 24,
            opacity: mounted?1:0, transition:"opacity .5s ease",
          }}>
            <div style={{ width:24, height:1, background:"rgba(212,175,55,0.6)" }}/>
            <span style={{ fontSize:9, color:"rgba(212,175,55,0.7)", fontFamily:"'Space Mono',monospace", letterSpacing:3, fontWeight:700 }}>AI-POWERED WEALTH PLATFORM</span>
          </div>

          <h1 style={{
            fontFamily:"'Bebas Neue',sans-serif",
            fontSize:"clamp(42px,4.5vw,72px)",
            fontWeight:400,
            color:"#ffffff",
            lineHeight:0.95,
            margin:"0 0 6px",
            letterSpacing:1,
            opacity: mounted?1:0, transform: mounted?"translateY(0)":"translateY(24px)",
            transition:"all .7s ease",
          }}>
            Master<br/>
            Your <span style={{ color:"#d4af37", WebkitTextStroke:"1px rgba(212,175,55,0.3)" }}>Wealth.</span>
          </h1>
          <h2 style={{
            fontFamily:"'Bebas Neue',sans-serif",
            fontSize:"clamp(24px,2.8vw,44px)",
            fontWeight:400,
            color:"rgba(255,255,255,0.35)",
            lineHeight:1.1,
            margin: isMobile ? "0 0 18px" : "0 0 28px",
            letterSpacing:1,
            opacity: mounted?1:0, transform: mounted?"translateY(0)":"translateY(20px)",
            transition:"all .75s ease .1s",
          }}>
            Our AI Is Your<br/>Investment Brain.
          </h2>

          {/* stats row */}
          <div style={{
            display:"flex", gap:0, marginBottom: isMobile ? 18 : 32,
            flexWrap: isMobile ? "wrap" : "nowrap",
            borderTop:"1px solid rgba(212,175,55,0.1)",
            borderBottom:"1px solid rgba(212,175,55,0.1)",
            opacity: mounted?1:0, transition:"opacity .8s ease .2s",
          }}>
            {[["₹2.4Cr+","Assets Tracked"],["18.4%","Avg Alpha"],["4 Signals","Generated Daily"]].map(([val,label],i)=>(
              <div key={i} style={{
                flex: isMobile ? "0 0 50%" : 1,
                padding: isMobile ? "10px 0" : "14px 0",
                borderRight: isMobile ? "none" : i<2 ? "1px solid rgba(212,175,55,0.1)" : "none",
                paddingLeft: isMobile ? 0 : i>0 ? 20 : 0,
              }}>
                <div style={{ fontFamily:"'Space Mono',monospace", fontSize:16, color:"#d4af37", fontWeight:700, lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
              </div>
            ))}
          </div>

          <p style={{
            fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.8, maxWidth:400, margin: isMobile ? "0 0 18px" : "0 0 32px",
            fontWeight:300, fontStyle:"italic",
            opacity:mounted?1:0, transform:mounted?"translateY(0)":"translateY(12px)",
            transition:"all .8s ease .25s"
          }}>
            Actionable AI signals, real-time Nifty and Sensex snapshots,
            portfolio optimization, and deep mutual fund analysis — unified.
          </p>

          <div style={{
            display:"flex", gap:12, flexDirection: isMobile ? "column" : "row",
            opacity:mounted?1:0, transition:"opacity .8s ease .35s"
          }}>
            <button style={{
              padding:"12px 32px", cursor:"pointer", width: isMobile ? "100%" : "auto",
              fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:2,
              background:"#d4af37", color:"#000000",
              border:"none",
              boxShadow:"0 0 30px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.1)",
              transition:"all .25s",
            }}
            onMouseOver={e => { (e.currentTarget as any).style.background="#fde68a"; (e.currentTarget as any).style.boxShadow="0 0 40px rgba(212,175,55,0.5), 0 0 80px rgba(212,175,55,0.2)"; }}
            onMouseOut={e => { (e.currentTarget as any).style.background="#d4af37"; (e.currentTarget as any).style.boxShadow="0 0 30px rgba(212,175,55,0.3), 0 0 60px rgba(212,175,55,0.1)"; }}
            >
              START FREE TRIAL
            </button>
            <button style={{
              padding:"12px 28px", cursor:"pointer", width: isMobile ? "100%" : "auto",
              fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:2,
              background:"transparent", color:"rgba(255,255,255,0.5)",
              border:"1px solid rgba(255,255,255,0.15)",
              transition:"all .25s",
            }}
            onMouseOver={e => { (e.currentTarget as any).style.borderColor="rgba(212,175,55,0.4)"; (e.currentTarget as any).style.color="#d4af37"; }}
            onMouseOut={e => { (e.currentTarget as any).style.borderColor="rgba(255,255,255,0.15)"; (e.currentTarget as any).style.color="rgba(255,255,255,0.5)"; }}
            >
              CASE STUDIES →
            </button>
          </div>
        </div>

        {/* ── RIGHT 3D SCENE ── */}
        {!isMobile && <div style={{
          position:"relative", width:sceneWidth, height:sceneHeight,
          maxWidth:"100%",
          perspective:"1100px",
          perspectiveOrigin:"50% 50%",
        }}>
          <Connectors cx={0} cy={0} firing={firing} centreGlow={centreGlow}/>

          <div style={{
            position:"absolute", left:"50%", top:"50%",
            transform:`translate(-50%,-50%)`,
            transformStyle:"preserve-3d",
            width:0, height:0,
          }}>
            <div style={{
              transformStyle:"preserve-3d",
              transform: sceneTransform,
              transition:"transform 0.08s linear",
            }}>

              {/* ── 4 CUBOID CARDS ── */}
              {cards.map((c, idx) => (
                <div key={c.id} style={{
                  position:"absolute",
                  left: c.dx - c.w/2,
                  top:  c.dy - c.h/2,
                  transformStyle:"preserve-3d",
                  opacity: mounted?1:0,
                  transition:`opacity .6s ease ${idx*.12+.4}s`,
                }}>
                  <Cuboid w={c.w} h={c.h} d={c.d}>
                    {c.content}
                  </Cuboid>
                  <div style={{
                    position:"absolute",
                    bottom:-16, left:"10%", width:"80%", height:14,
                    background:"rgba(0,0,0,0.5)",
                    borderRadius:"50%", filter:"blur(10px)",
                    transform:"translateZ(-20px)",
                    pointerEvents:"none",
                  }}/>
                </div>
              ))}

              {/* ── CENTER CUBOID ── */}
              <div style={{
                position:"absolute",
                left:-80, top:-35,
                transformStyle:"preserve-3d",
                opacity: mounted?1:0,
                transition:"opacity .5s ease .2s",
              }}>
                <Cuboid w={160} h={70} d={60}
                  faceColor="rgba(8,8,12,0.99)"
                  topColor="rgba(26,22,8,0.99)"
                  sideColor="rgba(4,4,7,0.99)"
                  borderColor="rgba(212,175,55,0.55)"
                >
                  <div style={{
                    width:"100%", height:"100%",
                    display:"flex", flexDirection:"row",
                    alignItems:"center", justifyContent:"center",
                    gap:12,
                  }}>
                    {/* Glowing orb */}
                    <div style={{
                      width:40, height:40, borderRadius:"50%",
                      background:"radial-gradient(circle at 35% 35%, rgba(212,175,55,0.3), rgba(0,0,0,0.9))",
                      border:`1.5px solid rgba(212,175,55,${centreGlow ? 1 : 0.7})`,
                      boxShadow: centreGlow
                        ? "0 0 50px rgba(212,175,55,0.9), 0 0 100px rgba(212,175,55,0.4), inset 0 0 20px rgba(212,175,55,0.3)"
                        : "0 0 20px rgba(212,175,55,0.4), inset 0 0 12px rgba(212,175,55,0.1)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:18, color: centreGlow ? "#fde68a" : "#d4af37", fontWeight:700,
                      flexShrink:0, fontFamily:"'Space Mono',monospace",
                      transition:"box-shadow 0.3s ease, color 0.3s ease",
                      animation:"cubePulse 3s ease-in-out infinite",
                    }}>₹</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                      <div style={{ fontSize:16, color:"#d4af37", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:2, lineHeight:1 }}>ET</div>
                      <div style={{ fontSize:16, color:"rgba(212,175,55,0.7)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:2, lineHeight:1 }}>RADAR</div>
                    </div>
                  </div>
                </Cuboid>

                <div style={{
                  position:"absolute",
                  bottom:-20, left:"15%", width:"70%", height:16,
                  background:"rgba(212,175,55,0.15)",
                  borderRadius:"50%", filter:"blur(12px)",
                  transform:"translateZ(-30px)",
                  pointerEvents:"none",
                }}/>
              </div>

            </div>
          </div>
        </div>}
      </div>

      {/* ── WATCHLIST SECTION ── */}
      <div style={{
        marginTop: isMobile ? 28 : isNarrow ? 40 : 72,
        maxWidth: 1280,
        width: "100%",
        padding: isMobile ? "0 12px 28px" : isNarrow ? "0 24px 40px" : "0 56px 64px",
      }}>
        {/* section header */}
        <div style={{
          display:"flex", alignItems:"center", gap:16,
          marginBottom:24,
          paddingBottom:16,
          borderBottom:"1px solid rgba(212,175,55,0.12)",
        }}>
          <div style={{ width:2, height:22, background:"linear-gradient(to bottom, #d4af37, transparent)" }}/>
          <h2 style={{
            fontFamily:"'Bebas Neue',sans-serif",
            fontSize: isMobile ? 22 : 28, fontWeight:400, color:"#ffffff",
            margin:0, letterSpacing:2,
          }}>
            TODAY'S MARKET
          </h2>
          <div style={{ flex:1, height:1, background:"linear-gradient(to right, rgba(212,175,55,0.2), transparent)" }}/>
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", fontFamily:"'Space Mono',monospace", letterSpacing:1, display: isMobile ? "none" : "block" }}>
            REFRESHES 60s
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", maxWidth: 540 }}>
          <WatchlistSection isMobile={isMobile} />
        </div>
      </div>

      <style>{`
        @keyframes cubePulse {
          0%,100% { box-shadow: 0 0 16px rgba(212,175,55,0.25); }
          50%      { box-shadow: 0 0 30px rgba(212,175,55,0.5), 0 0 60px rgba(212,175,55,0.12); }
        }
        @keyframes dashFlow {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes centreBurst {
          0%   { opacity: 1; transform: scale(1); }
          50%  { opacity: 0.85; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes stockPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}