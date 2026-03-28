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
  faceColor = "rgba(13,27,42,0.97)",
  topColor   = "rgba(20,35,55,0.97)",
  sideColor  = "rgba(8,15,25,0.97)",
  borderColor = "rgba(125,211,252,0.22)",
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
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(125,211,252,0.15)",
      }}>
        {/* top shimmer line */}
        <div style={{ position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(125,211,252,0.35),transparent)" }}/>
        {children}
      </div>

      {/* BACK */}
      <div style={{
        ...shared,
        width: w, height: h,
        background: sideColor,
        transform: `translateZ(${-d / 2}px) rotateY(180deg)`,
        borderRadius: 8,
      }}/>

      {/* LEFT */}
      <div style={{
        ...shared,
        width: d, height: h,
        background: sideColor,
        left: -d / 2,
        transform: `rotateY(-90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "right center",
        borderRadius: 0,
      }}/>

      {/* RIGHT */}
      <div style={{
        ...shared,
        width: d, height: h,
        background: sideColor,
        left: w - d / 2,
        transform: `rotateY(90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "left center",
        borderRadius: 0,
      }}/>

      {/* TOP */}
      <div style={{
        ...shared,
        width: w, height: d,
        background: topColor,
        top: -d / 2,
        transform: `rotateX(90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "center bottom",
        borderRadius: "8px 8px 0 0",
      }}/>

      {/* BOTTOM */}
      <div style={{
        ...shared,
        width: w, height: d,
        background: "rgba(0,0,0,0.5)",
        top: h - d / 2,
        transform: `rotateX(-90deg) translateZ(${-d / 2}px)`,
        transformOrigin: "center top",
        borderRadius: "0 0 8px 8px",
      }}/>
    </div>
  );
}

/* ── mini bar chart ── */
function MiniBar({ vals, accent = "#7dd3fc" }: { vals: number[]; accent?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:44 }}>
      {vals.map((v,i) => (
        <div key={i} style={{
          flex:1, height:`${v}%`, borderRadius:"2px 2px 0 0",
          background: i===3 ? accent : `rgba(125,211,252,${0.2+v/200})`,
          transition: `height .5s ease ${i*.07}s`
        }}/>
      ))}
    </div>
  );
}

/* ── mini line chart ── */
function MiniLine({ id, color="#7dd3fc", path, fillPath }: { id:string; color?:string; path:string; fillPath:string }) {
  return (
    <svg width="100%" height="46" viewBox="0 0 180 46" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

/* ─────────── card contents ─────────── */
const PortfolioContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ fontSize:8, color:"#bae6fd", fontWeight:700, letterSpacing:1, marginBottom:6 }}>PERSONAL PORTFOLIO</div>
    <MiniBar vals={[55,80,42,100,68,50,75]}/>
    <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 8px", marginTop:7 }}>
      {["Stocks","NFT","Coin","F&O"].map((l,i)=>(
        <div key={l} style={{ display:"flex", alignItems:"center", gap:3 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:["#7dd3fc","#bae6fd","#7dd3fc","#38bdf8"][i] }}/>
          <span style={{ fontSize:7, color:"#9ca3af" }}>{l}</span>
        </div>
      ))}
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3, marginTop:7 }}>
      {["₹2.4L","₹89K","₹1.1L","₹34K"].map((v,i)=>(
        <div key={i} style={{ background:"rgba(125,211,252,0.07)", borderRadius:4, padding:"3px 6px" }}>
          <div style={{ fontSize:6, color:"#6b7280" }}>{["Stocks","NFT","Coin","F&O"][i]}</div>
          <div style={{ fontSize:9, color:"#7dd3fc", fontWeight:700 }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

const NiftyContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
      <div style={{ fontSize:8, color:"#bae6fd", fontWeight:700, letterSpacing:1 }}>NIFTY 50</div>
      <span style={{ fontSize:7, background:"rgba(125,211,252,0.15)", color:"#7dd3fc", borderRadius:3, padding:"1px 5px" }}>▲ +1.24%</span>
    </div>
    <div style={{ fontSize:15, fontWeight:800, color:"#f0fdf4", marginBottom:1 }}>22,419</div>
    <MiniLine id="niftyG"
      path="M0,38 C25,32 45,24 70,18 C95,12 110,20 135,10 C155,4 170,5 180,3"
      fillPath="M0,38 C25,32 45,24 70,18 C95,12 110,20 135,10 C155,4 170,5 180,3 L180,46 L0,46Z"/>
    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
      {["NSE","BSE","MCX","NCDEX"].map(ex=>(
        <div key={ex} style={{ fontSize:6, color:"#6b7280", background:"rgba(255,255,255,0.04)", padding:"2px 4px", borderRadius:3 }}>{ex}</div>
      ))}
    </div>
    <div style={{ marginTop:6, padding:"5px 7px", background:"rgba(125,211,252,0.08)", borderRadius:5, borderLeft:"2px solid #7dd3fc" }}>
      <div style={{ fontSize:7, color:"#bae6fd", fontWeight:600 }}>Nifty Fund Analysis</div>
      <div style={{ fontSize:6, color:"#6b7280", marginTop:1 }}>Top performer: HDFC Nifty 50 ETF</div>
    </div>
  </div>
);

const MutualContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ fontSize:8, color:"#bae6fd", fontWeight:700, letterSpacing:1, marginBottom:5 }}>MUTUAL FUND ANALYSIS</div>
    <MiniLine id="mfG" color="#7dd3fc"
      path="M0,40 C30,34 55,28 80,20 C105,13 125,18 155,10 C168,7 175,6 180,5"
      fillPath="M0,40 C30,34 55,28 80,20 C105,13 125,18 155,10 C168,7 175,6 180,5 L180,46 L0,46Z"/>
    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
      <span style={{ fontSize:7, color:"#9ca3af" }}>Performance vs <span style={{ color:"#7dd3fc" }}>Nifty 15</span></span>
      <span style={{ fontSize:8, color:"#7dd3fc", fontWeight:700 }}>+18.4%</span>
    </div>
    <div style={{ display:"flex", gap:6, marginTop:7 }}>
      {[["Top Gain","Axis BF","▲31%"],["Lowest","SBI Cons","▲9%"]].map(([l,n,v],i)=>(
        <div key={i} style={{ flex:1, background:"rgba(125,211,252,0.06)", borderRadius:5, padding:"4px 6px" }}>
          <div style={{ fontSize:6, color:"#6b7280" }}>{l}</div>
          <div style={{ fontSize:7, color:"#e2e8f0", fontWeight:600 }}>{n}</div>
          <div style={{ fontSize:8, color:"#7dd3fc" }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

const AIContent = () => (
  <div style={{ padding:"10px 10px 8px", height:"100%", boxSizing:"border-box" }}>
    <div style={{ fontSize:8, color:"#bae6fd", fontWeight:700, letterSpacing:1, marginBottom:6 }}>AI RECOMMENDATIONS</div>
    {[
      ["Parag Parikh Flexi Cap","MULTI CAP","+24.3%"],
      ["ICICI Pru Technology","SECTORAL","+31.1%"],
      ["HDFC Balanced Adv","HYBRID","+15.7%"],
      ["Nippon India Small","SMALL CAP","+19.2%"],
    ].map(([name,tag,ret],i)=>(
      <div key={i} style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"4px 6px", marginBottom:3,
        background:"rgba(125,211,252,0.05)",
        borderRadius:5, borderLeft:`2px solid rgba(125,211,252,${0.25+i*0.12})`
      }}>
        <div>
          <div style={{ fontSize:7.5, color:"#e2e8f0", fontWeight:600, maxWidth:115, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
          <div style={{ fontSize:6, color:"#4b5563" }}>{tag}</div>
        </div>
        <div style={{ fontSize:9, color:"#7dd3fc", fontWeight:700 }}>{ret}</div>
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
    { x: -220, y: -110 },
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
            <stop offset="0%"   stopColor="#7dd3fc" stopOpacity="0"/>
            <stop offset="55%"  stopColor="#7dd3fc" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1"/>
          </linearGradient>
        ))}
      </defs>

      {/* static dashed base lines */}
      {pts.map((p,i) => (
        <line key={i}
          x1={ox} y1={oy} x2={ox+p.x} y2={oy+p.y}
          stroke="rgba(125,211,252,0.15)" strokeWidth={1} strokeDasharray="5 5"
        />
      ))}

      {/* endpoint dots */}
      {pts.map((p,i) => (
        <circle key={i} cx={ox+p.x} cy={oy+p.y} r={3} fill="rgba(125,211,252,0.4)"/>
      ))}

      {/* animated glowing trails + orbs */}
      {firing && pts.map((p,i) => {
        const delay = `${i * 0.12}s`;
        const dur   = "3s";
        const x1 = ox + p.x, y1 = oy + p.y;
        const x2 = ox,        y2 = oy;
        return (
          <g key={`trail-${i}`}>
            {/* glowing trail — wider, softer, slow linear draw */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`url(#trail${i})`} strokeWidth={3}
              strokeDasharray="600" strokeDashoffset="600"
              style={{ animation: `dashFlow 3s ${delay} linear forwards` }}
            />
            {/* soft outer halo on the trail */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`url(#trail${i})`} strokeWidth={8} opacity={0.25}
              strokeDasharray="600" strokeDashoffset="600"
              style={{ animation: `dashFlow 3s ${delay} linear forwards` }}
            />
            {/* travelling orb */}
            <circle r={6} fill="#a7f3d0" filter="url(#ballGlow)" opacity="0">
              <animateMotion dur={dur} begin={delay} fill="freeze" calcMode="linear"
                path={`M${x1},${y1} L${x2},${y2}`}/>
              <animate attributeName="opacity" values="0;0.9;0.9;0"
                keyTimes="0;0.05;0.92;1" dur={dur} begin={delay} fill="freeze"/>
            </circle>
            {/* soft halo orb */}
            <circle r={12} fill="#7dd3fc" filter="url(#ballGlow)" opacity="0">
              <animateMotion dur={dur} begin={delay} fill="freeze" calcMode="linear"
                path={`M${x1},${y1} L${x2},${y2}`}/>
              <animate attributeName="opacity" values="0;0.25;0.25;0"
                keyTimes="0;0.05;0.92;1" dur={dur} begin={delay} fill="freeze"/>
            </circle>
          </g>
        );
      })}

      {/* centre hub */}
      {!centreGlow && (
            <circle cx={ox} cy={oy} r={6} fill="rgba(125,211,252,0.65)" filter="url(#glow)"/>
      )}
      {centreGlow && (
        <>
          <circle cx={ox} cy={oy} r={28} fill="rgba(125,211,252,0.10)" filter="url(#centreGlowF)"
            style={{ animation:"centreBurst 0.8s ease-out forwards" }}/>
          <circle cx={ox} cy={oy} r={11} fill="rgba(198,246,213,0.95)" filter="url(#ballGlow)"
            style={{ animation:"centreBurst 0.8s ease-out forwards" }}/>
        </>
      )}
    </svg>
  );
}

/* ── Skeleton loader ── */
function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 10px", borderBottom: "1px solid rgba(125,211,252,0.1)" }}>
      <div style={{ width: 120, height: 12, borderRadius: 6, background: "#475569", animation: "stockPulse 1.5s infinite" }} />
      <div style={{ width: 80, height: 12, borderRadius: 6, background: "#475569", animation: "stockPulse 1.5s infinite" }} />
    </div>
  );
}

/* ── Watchlist component ── */
function WatchlistSection() {
  const router = useRouter();
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const FALLBACK_STOCKS = [
    { symbol: "TATAMOTORS", name: "Tata Motors Ltd", current_price: 670.26, change_pct: -0.51, closes: [673.70, 670.26] },
    { symbol: "HDFCBANK", name: "HDFC Bank", current_price: 1308.61, change_pct: -1.03, closes: [1322.24, 1308.61] },
    { symbol: "INFY", name: "Infosys Ltd", current_price: 2120.04, change_pct: 1.93, closes: [2079.90, 2120.04] },
    { symbol: "RELIANCE", name: "Reliance Industries Ltd", current_price: 2901.01, change_pct: -0.50, closes: [2915.59, 2901.01] },
    { symbol: "SBIN", name: "State Bank of India", current_price: 1229.55, change_pct: 1.44, closes: [1212.10, 1229.55] },
  ];

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const allStocks = await getStocks();
      const enriched = await Promise.all(
        allStocks.map(async (stock) => {
          try {
            const ohlcv = await getOHLCV(stock.symbol, 2);
            const rows = (ohlcv || []).slice(-2);
            if (rows.length < 2) {
              return null;
            }

            const prev = Number(rows[0].close);
            const latest = Number(rows[1].close);
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
    const id = setInterval(() => {
      fetchStocks();
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const Sparkline = ({ closes, positive }: { closes: number[]; positive: boolean }) => {
    const points = closes.length > 1 ? closes : [closes[0] || 0, closes[0] || 0];
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(max - min, 1);

    const d = points
      .map((v, i) => {
        const x = (i / (points.length - 1 || 1)) * 60;
        const y = 22 - ((v - min) / range) * 20;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg width="60" height="24" viewBox="0 0 60 24" style={{ opacity: 0.9 }}>
        <path d={d} fill="none" stroke={positive ? "#22c55e" : "#ef4444"} strokeWidth="1.8" />
      </svg>
    );
  };

  return (
    <div style={{ padding: "20px", background: "rgba(13,20,35,0.6)", border: "1px solid rgba(125, 211, 252, 0.2)", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "14px", color: "#f0fdf4", fontWeight: "700" }}>Tracked Stocks</h3>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#86efac", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.28)", borderRadius: 999, padding: "2px 8px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "stockPulse 1.5s infinite" }} />
          Live
        </span>
      </div>

      {loading ? (
        <div style={{ maxHeight: "400px", overflow: "hidden", borderRadius: "4px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : (
        <div style={{ maxHeight: "400px", overflow: "auto", borderRadius: "4px" }}>
          {stocks.slice(0, 5).map((stock) => {
            const pct = Number(stock.change_pct || 0);
            const positive = pct >= 0;
            return (
            <div
              key={stock.symbol}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 10px",
                borderBottom: "1px solid rgba(125, 211, 252, 0.1)",
                transition: "background 0.2s",
                cursor: "pointer",
              }}
              onClick={() => router.push(`/stock/${stock.symbol}`)}
              onMouseOver={(e) => {
                (e.currentTarget as any).style.background = "rgba(59,130,246,0.08)";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as any).style.background = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>{stock.symbol}</div>
                  <div style={{ color: "#9ca3af", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {stock.name}
                  </div>
                </div>
                <Sparkline closes={stock.closes || [stock.prev_price || stock.current_price, stock.current_price]} positive={positive} />
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 600 }}>
                  ₹{Number(stock.current_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color: positive ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                  {positive ? "▲" : "▼"} {positive ? "+" : ""}{pct.toFixed(2)}%
                </div>
              </div>
            </div>
          )})}
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
  const [firing, setFiring] = useState(false);
  const [centreGlow, setCentreGlow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 120);
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1100);
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

    // Fire immediately after mount, then every 5s
    const runSequence = () => {
      setFiring(true);
      setCentreGlow(false);
      // orbs arrive at centre after ~3.1s (3s travel + small stagger)
      setTimeout(() => {
        setFiring(false);
        setCentreGlow(true);
      }, 3150);
      // centre glow holds then fades
      setTimeout(() => {
        setCentreGlow(false);
      }, 4400);
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

  // isometric-ish base rotation + gentle mouse parallax
  const baseRX = 22;
  const baseRY = -28;
  const sceneTransform = `rotateX(${baseRX + mouse.y * -4}deg) rotateY(${baseRY + mouse.x * 5}deg)`;
  const sceneWidth = isNarrow ? 560 : 700;
  const sceneHeight = isNarrow ? 360 : 440;

  // card layout: 4 corners of a diamond
  const cards = [
    { id:"tl", dx:-220, dy:-110, dz:0,  w:210, h:155, d:14, content:<PortfolioContent/> },
    { id:"tr", dx: 220, dy:-110, dz:0,  w:210, h:155, d:14, content:<NiftyContent/>    },
    { id:"bl", dx:-220, dy: 110, dz:0,  w:210, h:145, d:14, content:<MutualContent/>   },
    { id:"br", dx: 220, dy: 110, dz:0,  w:210, h:175, d:14, content:<AIContent/>       },
  ];

  return (
    <div
      ref={ref}
      className="scene-3d"
      style={{
        width:"100%", minHeight:"100vh",
        background:"radial-gradient(ellipse at 35% 50%, #0f2a4a 0%, #0a0f1c 45%, #020805 100%)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start",
        fontFamily:"'DM Sans',sans-serif",
        overflow:"hidden", position:"relative",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>

      {/* grid bg */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(125,211,252,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,0.025) 1px,transparent 1px)",
        backgroundSize:"44px 44px"
      }}/>
      {/* green ambient glow */}
      <div style={{ position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
        width:600,height:400,
        background:"radial-gradient(ellipse,rgba(125,211,252,0.10) 0%,transparent 70%)",
        pointerEvents:"none"
      }}/>

      <div style={{
        maxWidth:1260, width:"100%", padding:isNarrow ? "28px 16px 0" : "20px 40px 0",
        display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "1fr 1.05fr", gap:isNarrow ? 32 : 60,
        alignItems:"center"
      }}>

        {/* ── LEFT TEXT ── */}
        <div style={{ zIndex:10 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:6,
            background:"rgba(125,211,252,0.08)",border:"1px solid rgba(125,211,252,0.2)",
            borderRadius:20,padding:"4px 12px",marginBottom:18
          }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#7dd3fc",boxShadow:"0 0 8px #7dd3fc" }}/>
            <span style={{ fontSize:10,color:"#bae6fd",letterSpacing:1.5,fontWeight:700 }}>AI-POWERED WEALTH</span>
          </div>

          <h1 style={{
            fontFamily:"'Syne',sans-serif", fontSize:"clamp(26px,3.2vw,46px)",
            fontWeight:800, color:"#f0fdf4", lineHeight:1.15, margin:"0 0 18px",
            opacity: mounted?1:0, transform: mounted?"translateY(0)":"translateY(22px)",
            transition:"all .7s ease"
          }}>
            Master Your Wealth.<br/>
            <span style={{ color:"#7dd3fc" }}>Our AI</span> is Your<br/>
            Personalized<br/>Investment Brain.
          </h1>

          <p style={{
            fontSize:14,color:"#6b7280",lineHeight:1.75,maxWidth:410,margin:"0 0 30px",
            opacity:mounted?1:0, transform:mounted?"translateY(0)":"translateY(16px)",
            transition:"all .8s ease .15s"
          }}>
            Actionable AI signals, real-time Nifty and Sensex snapshots,
            portfolio optimization insights, and detailed mutual fund analysis,
            all in one place.
          </p>

          <div style={{ display:"flex",gap:12,
            opacity:mounted?1:0, transform:mounted?"translateY(0)":"translateY(12px)",
            transition:"all .8s ease .3s"
          }}>
            {[
              { label:"Start Free Trial", primary:true },
              { label:"See Case Studies", primary:false },
            ].map(({label,primary})=>(
              <button key={label} style={{
                padding:"11px 24px", borderRadius:30, cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600,
                background:"transparent",
                border:`1.5px solid ${primary?"#7dd3fc":"rgba(255,255,255,0.15)"}`,
                color: primary?"#7dd3fc":"#9ca3af",
                boxShadow: primary?"0 0 20px rgba(125,211,252,0.15)":"none",
                transition:"all .25s"
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT 3D SCENE ── */}
        <div style={{
          position:"relative", width:sceneWidth, height:sceneHeight,
          maxWidth:"100%",
          perspective:"1100px",
          perspectiveOrigin:"50% 50%",
        }}>
          {/* connector lines drawn behind everything */}
          <Connectors cx={0} cy={0} firing={firing} centreGlow={centreGlow}/>

          {/* The 3D stage — all cards share one transform */}
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
                  <Cuboid w={c.w} h={c.h} d={c.d}
                    faceColor="rgba(12,26,18,0.97)"
                    topColor="rgba(20,52,32,0.97)"
                    sideColor="rgba(5,15,9,0.97)"
                    borderColor="rgba(125,211,252,0.2)"
                  >
                    {c.content}
                  </Cuboid>
                  {/* drop shadow underneath */}
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

              {/* ── CENTER CUBOID (wide flat box, like the reference) ── */}
              {/* w=160 h=70 d=60 → clearly wider than tall, deep sides visible */}
              <div style={{
                position:"absolute",
                left:-80, top:-35,
                transformStyle:"preserve-3d",
                opacity: mounted?1:0,
                transition:"opacity .5s ease .2s",
              }}>
                <Cuboid w={160} h={70} d={60}
                  faceColor="rgba(10,32,22,0.98)"
                  topColor="rgba(28,72,42,0.98)"
                  sideColor="rgba(5,16,11,0.98)"
                  borderColor="rgba(125,211,252,0.45)"
                >
                  {/* Front face content */}
                  <div style={{
                    width:"100%", height:"100%",
                    display:"flex", flexDirection:"row",
                    alignItems:"center", justifyContent:"center",
                    gap:10,
                  }}>
                    {/* Glowing orb */}
                    <div style={{
                      width:38, height:38, borderRadius:"50%",
                      background:"radial-gradient(circle at 35% 35%, #1e5a30, #061209)",
                      border:`1.5px solid rgba(125,211,252,${centreGlow ? 1 : 0.6})`,
                      boxShadow: centreGlow
                        ? "0 0 50px rgba(125,211,252,0.95), 0 0 100px rgba(125,211,252,0.5), inset 0 0 20px rgba(125,211,252,0.4)"
                        : "0 0 22px rgba(125,211,252,0.45), inset 0 0 12px rgba(125,211,252,0.15)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:18, color: centreGlow ? "#ffffff" : "#7dd3fc", fontWeight:800,
                      flexShrink:0,
                      transition:"box-shadow 0.3s ease, color 0.3s ease, border-color 0.3s ease",
                      animation:"cubePulse 3s ease-in-out infinite",
                    }}>₹</div>
                    {/* Label */}
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      <div style={{ fontSize:13, color:"#bae6fd", fontWeight:800, letterSpacing:1, lineHeight:1 }}>ET</div>
                      <div style={{ fontSize:13, color:"#bae6fd", fontWeight:800, letterSpacing:1, lineHeight:1 }}>Radar</div>
                    </div>
                  </div>
                </Cuboid>

                {/* glow halo under the cuboid */}
                <div style={{
                  position:"absolute",
                  bottom:-20, left:"15%", width:"70%", height:16,
                  background:"rgba(125,211,252,0.18)",
                  borderRadius:"50%", filter:"blur(12px)",
                  transform:"translateZ(-30px)",
                  pointerEvents:"none",
                }}/>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── WATCHLIST SECTION ── */}
      <div style={{
        marginTop: isNarrow ? 30 : 60,
        maxWidth: 1260,
        width: "100%",
        padding: isNarrow ? "0 16px 28px" : "0 40px 48px",
      }}>
        <h2 style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#f0fdf4",
          marginBottom: 24,
          fontFamily: "'Syne',sans-serif",
        }}>
          Today's Market
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", maxWidth: 500 }}>
          <WatchlistSection />
        </div>
      </div>

      <style>{`
        @keyframes cubePulse {
          0%,100% { box-shadow: 0 0 18px rgba(125,211,252,0.3); }
          50%      { box-shadow: 0 0 32px rgba(125,211,252,0.55), 0 0 60px rgba(125,211,252,0.15); }
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
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
