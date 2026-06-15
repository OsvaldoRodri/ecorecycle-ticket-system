import { useState, useEffect } from "react";
 
// ─── DATA ────────────────────────────────────────────────────────────────────
// Order matches workflow: cans → pet → petsp → glass → glasssp → hdpe → hdpesp → #6 → #7 → bm
 
const DEFAULT_MATS = [
  { id:"alum",  name:"ALUM CANS", lbs:"", pLow:"2.10",  pHigh:"2.10",  isGlass:false },
  { id:"pet",   name:"PET #1",    lbs:"", pLow:"1.50",  pHigh:"1.50",  isGlass:false },
  { id:"sppet", name:"SP-PET",    lbs:"", pLow:"0.02",  pHigh:"0.02",  isGlass:false },
  { id:"glass", name:"GLASS",     lbs:"", pLow:"0.125", pHigh:"0.125", isGlass:true  },
  { id:"spgl",  name:"SP-GLASS",  lbs:"", pLow:"0.005", pHigh:"0.005", isGlass:true  },
  { id:"hdpe",  name:"HDPE",      lbs:"", pLow:"0.67",  pHigh:"0.67",  isGlass:false },
  { id:"sphd",  name:"SP-HDPE",   lbs:"", pLow:"0.02",  pHigh:"0.02",  isGlass:false },
  { id:"ps6",   name:"#6",        lbs:"", pLow:"5.45",  pHigh:"5.45",  isGlass:false },
  { id:"ps7",   name:"#7",        lbs:"", pLow:"0.31",  pHigh:"0.31",  isGlass:false },
  { id:"bm",    name:"BIOMETAL",  lbs:"", pLow:"0.43",  pHigh:"0.43",  isGlass:false },
];
 
const NAMES = [
  "MARIA GONZALEZ","JAKE WILLIAMS","CARLOS RAMIREZ","ASHLEY THOMPSON",
  "JAVIER HERNANDEZ","BRITTANY JOHNSON","ROBERTO FLORES","MIKE ANDERSON",
  "LUPITA MORALES","DIEGO SANCHEZ","JENNIFER DAVIS","PEDRO MARTINEZ",
  "ROSA LOPEZ","TYLER WILSON","ANA GARCIA","CHRIS MOORE","ELENA TORRES",
  "BRANDON LEE","GUADALUPE REYES","JESSICA MILLER","FRANCISCO JIMENEZ",
  "AMANDA TAYLOR","ISABEL CHAVEZ","DANIEL HARRIS","CARMEN RUIZ",
  "MATTHEW CLARK","PATRICIA MENDEZ","RYAN WALKER","DOLORES CASTILLO",
  "NATHAN HALL","YOLANDA VARGAS","AUSTIN YOUNG","ESPERANZA ROMERO",
  "CALEB SCOTT","LETICIA DOMINGUEZ","HUNTER WRIGHT","CONSUELO SILVA",
  "ZACHARY KING","ADRIANA AGUILAR","DYLAN GREEN","VERONICA LUNA",
];
 
const STORAGE_KEY = "ecorecycle-v6";
 
// ─── HELPERS ─────────────────────────────────────────────────────────────────
 
const r2 = n => Math.round(n * 100) / 100;
const r3 = n => Math.round(n * 1000) / 1000;
const pickRandomName = (used = new Set()) => {
  const pool = NAMES.filter(n => !used.has(n));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : NAMES[Math.floor(Math.random() * NAMES.length)];
};
 
// Sort items by material order
const orderItems = (items, mats) => {
  const order = {};
  mats.forEach((m, i) => { order[m.id] = i; });
  return [...items].sort((a, b) => (order[a.matId] ?? 999) - (order[b.matId] ?? 999));
};
 
// Renumber IDs sequentially (prefilled stays first)
const renumber = (tickets) => {
  const prefilled = tickets.filter(t => t.prefilled);
  const rest      = tickets.filter(t => !t.prefilled);
  return [...prefilled, ...rest].map((t, i) => ({
    ...t, id: `#${String(i + 1).padStart(3, "0")}`,
  }));
};
 
// ─── SKIP ASSIGNMENT (MORE VARIETY) ──────────────────────────────────────────
 
function assignSkipsPerTicket(active, count, maxVal, tiers) {
  const skips = Array.from({ length: count }, () => new Set());
  const N = active.length;
  if (N <= 2 || count <= 1) return skips;
 
  const avgP = m => tiers.reduce((s, t) => s + +(t === "HIGH" ? m.pHigh : m.pLow), 0) / count;
  const sorted = [...active]
    .map(m => ({ ...m, totalVal: +m.lbs * avgP(m) }))
    .sort((a, b) => b.totalVal - a.totalVal);
 
  const keepMin = Math.min(3, N);
 
  for (let i = 0; i < count; i++) {
    let keepCount;
    if (Math.random() < 0.10) {
      keepCount = N; // ~10% complete
    } else {
      const span = (N - 1) - keepMin;
      // Stronger bias → more 3-4-5 material tickets
      const biased = Math.pow(Math.random(), 2.0);
      keepCount = keepMin + Math.round(biased * Math.max(0, span));
    }
    keepCount = Math.max(keepMin, Math.min(N, keepCount));
    const numSkips = N - keepCount;
    if (numSkips <= 0) continue;
 
    const pool = sorted.map((m, idx) => ({
      id: m.id,
      w: Math.pow(idx + 1, 1.8), // heavy bias toward skipping cheap materials
    }));
    const chosen = new Set();
    let guard = 0;
    while (chosen.size < numSkips && guard < 300) {
      guard++;
      let totalW = 0;
      for (const p of pool) if (!chosen.has(p.id)) totalW += p.w;
      if (totalW <= 0) break;
      let r = Math.random() * totalW;
      for (const p of pool) {
        if (chosen.has(p.id)) continue;
        r -= p.w;
        if (r <= 0) { chosen.add(p.id); break; }
      }
    }
    chosen.forEach(id => skips[i].add(id));
  }
 
  // Capacity validation
  for (const mat of sorted) {
    const minTickets   = Math.max(1, Math.ceil(mat.totalVal / maxVal));
    const maxSkippable = Math.max(0, count - minTickets - 1);
    let skipping = skips.filter(s => s.has(mat.id)).length;
    while (skipping > maxSkippable) {
      const idxs = [];
      for (let i = 0; i < count; i++) if (skips[i].has(mat.id)) idxs.push(i);
      const pick = idxs[Math.floor(Math.random() * idxs.length)];
      skips[pick].delete(mat.id);
      skipping--;
    }
  }
  return skips;
}
 
// ─── ALGORITHM ───────────────────────────────────────────────────────────────
 
function generateTickets(mats, count, minVal, maxVal, opts = {}) {
  const active = mats.filter(m => +m.lbs > 0.001);
  if (!active.length || count < 1) return [];
 
  const tiers = Array.from({ length: count }, (_, i) =>
    opts.tiers?.[i] ?? (Math.random() < 0.5 ? "HIGH" : "LOW")
  );
  const excludeNames = new Set(opts.excludeNames || []);
  const pool = NAMES.filter(n => !excludeNames.has(n)).sort(() => Math.random() - 0.5);
  const names = Array.from({ length: count }, (_, i) =>
    opts.names?.[i] ?? pool[i % pool.length] ?? NAMES[i % NAMES.length]
  );
 
  const getP = (m, t) => +(t === "HIGH" ? m.pHigh : m.pLow);
  const avgPrice = m => tiers.reduce((s, t) => s + getP(m, t), 0) / count;
  const totalVal = active.reduce((s, m) => s + +m.lbs * avgPrice(m), 0);
 
  const skips = assignSkipsPerTicket(active, count, maxVal, tiers);
 
  let targets;
  let attempts = 0;
  do {
    targets = Array.from({ length: count }, () =>
      minVal + Math.random() * (maxVal - minVal)
    );
    const tSum = targets.reduce((a, b) => a + b, 0);
    targets = targets.map(t => (t / tSum) * totalVal);
    attempts++;
  } while (
    attempts < 30 &&
    (Math.max(...targets) > maxVal || Math.min(...targets) < minVal * 0.7)
  );
  targets = targets.map(t => Math.max(1, Math.min(maxVal, t)));
 
  const itemMap = Array.from({ length: count }, () => ({}));
  const valMap  = Array(count).fill(0);
 
  const sorted = [...active].sort((a, b) =>
    +b.lbs * avgPrice(b) - +a.lbs * avgPrice(a)
  );
 
  for (const mat of sorted) {
    distributeMat(mat, +mat.lbs, tiers, targets, valMap, itemMap, maxVal, getP, skips);
  }
  rebalance(active, tiers, valMap, itemMap, maxVal, getP, skips);
 
  const baseMin = 7 * 60 + 30;
  const span = count > 1 ? (8 * 60) / (count - 1) : 60;
 
  return tiers.map((tier, i) => {
    const items = Object.entries(itemMap[i])
      .filter(([, lbs]) => lbs > 0.0001)
      .map(([matId, lbs]) => {
        const mat = active.find(m => m.id === matId);
        const price = getP(mat, tier);
        const lbsRound = mat.isGlass ? Math.round(lbs) : Math.round(lbs * 10) / 10;
        return { matId, lbs: lbsRound, price, sub: r2(lbsRound * price) };
      });
    const sortedItems = orderItems(items, mats);
    const total = r2(sortedItems.reduce((s, it) => s + it.sub, 0));
    const jitter = Math.round((Math.random() - 0.5) * 10);
    const mins   = baseMin + Math.round(span * i) + jitter;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(((mins % 60) + 60) % 60).padStart(2, "0");
    return {
      id: `#${String(i + 1).padStart(3, "0")}`,
      name: names[i], tier, locked: false, prefilled: false,
      items: sortedItems, total,
      time: `${hh}:${mm}`,
    };
  });
}
 
function distributeMat(mat, totalLbs, tiers, targets, valMap, itemMap, maxVal, getP, skips) {
  const count   = tiers.length;
  const step    = mat.isGlass ? 1 : 0.1;
  const floorTo = v => mat.isGlass ? Math.floor(v) : Math.floor(v * 10) / 10;
  const roundTo = v => mat.isGlass ? Math.round(v) : Math.round(v * 10) / 10;
  const allowed = i => !skips[i].has(mat.id);
 
  let rem = totalLbs;
 
  for (let pass = 0; pass < 6 && rem >= step; pass++) {
    const weights = tiers.map((tier, i) => {
      if (!allowed(i)) return 0;
      const p = getP(mat, tier);
      if (p <= 0) return 0;
      const room = pass === 0
        ? Math.max(0.5, targets[i] - valMap[i])
        : Math.max(0, maxVal - valMap[i]);
      if (room < p * step) return 0;
      const noise = pass === 0 ? 0.55 + Math.random() * 0.9 : 0.85 + Math.random() * 0.3;
      return (room / p) * noise;
    });
    const wSum = weights.reduce((a, b) => a + b, 0);
    if (wSum < 0.001) break;
 
    const portions = tiers.map((tier, i) => {
      if (!allowed(i)) return 0;
      const p = getP(mat, tier);
      if (p <= 0) return 0;
      const desired   = (weights[i] / wSum) * rem;
      const maxByRoom = (maxVal - valMap[i]) / p;
      return floorTo(Math.max(0, Math.min(desired, maxByRoom)));
    });
 
    let allocated = 0;
    for (let i = 0; i < count; i++) {
      if (portions[i] >= step) {
        const p = getP(mat, tiers[i]);
        itemMap[i][mat.id] = (itemMap[i][mat.id] || 0) + portions[i];
        valMap[i] += portions[i] * p;
        allocated += portions[i];
      }
    }
    rem = r3(rem - allocated);
    if (allocated < step) break;
  }
 
  let safety = 50;
  while (rem >= step && safety-- > 0) {
    const candidates = tiers
      .map((tier, i) => ({ i, price: getP(mat, tier), room: maxVal - valMap[i] }))
      .filter(c => allowed(c.i) && c.price > 0 && c.room >= c.price * step)
      .sort((a, b) => b.room - a.room);
    if (!candidates.length) break;
    const c = candidates[0];
    const maxByRoom = floorTo(c.room / c.price);
    const portion   = Math.min(rem, maxByRoom);
    const rounded   = roundTo(portion);
    if (rounded < step) break;
    itemMap[c.i][mat.id] = (itemMap[c.i][mat.id] || 0) + rounded;
    valMap[c.i] += rounded * c.price;
    rem = r3(rem - rounded);
  }
 
  if (rem >= step) {
    safety = 30;
    while (rem >= step && safety-- > 0) {
      const candidates = tiers
        .map((tier, i) => ({ i, price: getP(mat, tier), room: maxVal - valMap[i] }))
        .filter(c => c.price > 0 && c.room >= c.price * step)
        .sort((a, b) => b.room - a.room);
      if (!candidates.length) break;
      const c = candidates[0];
      const maxByRoom = floorTo(c.room / c.price);
      const portion   = Math.min(rem, maxByRoom);
      const rounded   = roundTo(portion);
      if (rounded < step) break;
      itemMap[c.i][mat.id] = (itemMap[c.i][mat.id] || 0) + rounded;
      valMap[c.i] += rounded * c.price;
      skips[c.i].delete(mat.id);
      rem = r3(rem - rounded);
    }
  }
 
  if (rem >= step * 0.5) {
    const lowest = valMap.indexOf(Math.min(...valMap));
    const portion = roundTo(rem);
    if (portion > 0) {
      itemMap[lowest][mat.id] = (itemMap[lowest][mat.id] || 0) + portion;
      valMap[lowest] += portion * getP(mat, tiers[lowest]);
      skips[lowest].delete(mat.id);
    }
  }
}
 
function rebalance(active, tiers, valMap, itemMap, maxVal, getP, skips) {
  let safety = 80;
  while (safety-- > 0) {
    const overIdx = valMap.findIndex(v => v > maxVal + 0.01);
    if (overIdx === -1) return;
    const overflow = valMap[overIdx] - maxVal;
    const allTargets = tiers
      .map((_, i) => ({ i, room: maxVal - valMap[i] }))
      .filter(t => t.i !== overIdx && t.room > 0.5)
      .sort((a, b) => b.room - a.room);
    const items = Object.entries(itemMap[overIdx])
      .map(([matId, lbs]) => {
        const m = active.find(x => x.id === matId);
        return { matId, lbs, mat: m, price: getP(m, tiers[overIdx]) };
      })
      .sort((a, b) => b.lbs * b.price - a.lbs * a.price);
    let moved = false;
    for (const item of items) {
      const step    = item.mat.isGlass ? 1 : 0.1;
      const floorTo = v => item.mat.isGlass ? Math.floor(v) : Math.floor(v * 10) / 10;
      const lbsToShave = Math.min(item.lbs, overflow / item.price);
      let toMove = floorTo(lbsToShave);
      if (toMove < step) continue;
      const nonSkip = allTargets.filter(t => !skips[t.i].has(item.matId));
      const ordered = [...nonSkip, ...allTargets.filter(t => skips[t.i].has(item.matId))];
      for (const t of ordered) {
        if (toMove < step) break;
        const tPrice = getP(item.mat, tiers[t.i]);
        const maxAccept = floorTo(t.room / tPrice);
        const moveAmt = Math.min(toMove, maxAccept);
        if (moveAmt < step) continue;
        itemMap[overIdx][item.matId] = r3(itemMap[overIdx][item.matId] - moveAmt);
        if (itemMap[overIdx][item.matId] < step / 2) delete itemMap[overIdx][item.matId];
        valMap[overIdx] -= moveAmt * item.price;
        itemMap[t.i][item.matId] = (itemMap[t.i][item.matId] || 0) + moveAmt;
        valMap[t.i] += moveAmt * tPrice;
        t.room -= moveAmt * tPrice;
        if (skips[t.i].has(item.matId)) skips[t.i].delete(item.matId);
        toMove = r3(toMove - moveAmt);
        moved = true;
      }
      if (moved) break;
    }
    if (!moved) return;
  }
}
 
// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
 
function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (e) {
    alert("Error al descargar: " + e.message);
  }
}
 
function generateTxtReport({ mats, tickets, minVal, maxVal, ticketCount }) {
  const lines = [];
  const date = new Date().toLocaleString();
  const SEP = "═══════════════════════════════════════════════════════";
  const SUB = "───────────────────────────────────────────────────────";
 
  lines.push(SEP);
  lines.push("       ECORECYCLE — REPORTE COMPLETO DEL DÍA");
  lines.push(SEP);
  lines.push(`Generado: ${date}`);
  lines.push("");
 
  lines.push(SUB);
  lines.push("MATERIALES Y PRECIOS");
  lines.push(SUB);
  lines.push(`${"Material".padEnd(14)} ${"Lbs día".padStart(10)} ${"$ Bajo".padStart(10)} ${"$ Alto".padStart(10)}`);
  mats.forEach(m => {
    const lbs = m.lbs || "0";
    lines.push(`${m.name.padEnd(14)} ${String(lbs).padStart(10)} ${("$"+m.pLow).padStart(10)} ${("$"+m.pHigh).padStart(10)}`);
  });
  lines.push("");
  lines.push(`Config: ${ticketCount} tickets · rango $${minVal} - $${maxVal}`);
  lines.push("");
 
  lines.push(SUB);
  lines.push(`TICKETS (${tickets.length})`);
  lines.push(SUB);
 
  const orderIdx = {};
  mats.forEach((m, i) => { orderIdx[m.id] = i; });
 
  tickets.forEach(t => {
    const tags = [];
    if (t.prefilled) tags.push("⭐ PRE-INGRESADO");
    else if (t.locked) tags.push("🔒 INGRESADO");
    lines.push("");
    lines.push(`${t.id} · ${t.name} · ${t.tier === "HIGH" ? "▲ HIGH" : "▼ LOW"} · ${t.time}${tags.length ? " · " + tags.join(" · ") : ""}`);
    const sorted = [...t.items].sort((a, b) => (orderIdx[a.matId] ?? 999) - (orderIdx[b.matId] ?? 999));
    sorted.forEach(it => {
      const m = mats.find(x => x.id === it.matId);
      const lbsStr = m?.isGlass ? String(Math.round(it.lbs)) : it.lbs.toFixed(1);
      lines.push(`   ${(m?.name || it.matId).padEnd(12)} ${(lbsStr+" lb").padStart(9)} @ $${it.price.toFixed(3).padStart(7)} = $${it.sub.toFixed(2).padStart(7)}`);
    });
    lines.push(`   TOTAL: $${t.total.toFixed(2)}`);
  });
 
  lines.push("");
  lines.push(SUB);
  lines.push("RESUMEN POR MATERIAL");
  lines.push(SUB);
  const byLbs = {};
  const bySub = {};
  tickets.forEach(t => t.items.forEach(it => {
    byLbs[it.matId] = (byLbs[it.matId] || 0) + it.lbs;
    bySub[it.matId] = (bySub[it.matId] || 0) + it.sub;
  }));
  lines.push(`${"Material".padEnd(14)} ${"Total Lbs".padStart(11)} ${"Total $".padStart(11)} ${"En tickets".padStart(12)}`);
  mats.forEach(m => {
    const lbs = byLbs[m.id] || 0;
    if (lbs <= 0) return;
    const tot = bySub[m.id] || 0;
    const inT = tickets.filter(t => t.items.some(it => it.matId === m.id)).length;
    const lbsStr = m.isGlass ? String(Math.round(lbs)) : lbs.toFixed(1);
    lines.push(`${m.name.padEnd(14)} ${(lbsStr+" lb").padStart(11)} ${("$"+tot.toFixed(2)).padStart(11)} ${(inT+"/"+tickets.length).padStart(12)}`);
  });
 
  const grand = tickets.reduce((s, t) => s + t.total, 0);
  const high  = tickets.filter(t => t.tier === "HIGH");
  const low   = tickets.filter(t => t.tier === "LOW");
  const pre   = tickets.filter(t => t.prefilled);
 
  lines.push("");
  lines.push(SUB);
  lines.push("TOTALES");
  lines.push(SUB);
  lines.push(`Gran Total del Día:    $${grand.toFixed(2)}`);
  lines.push(`Total Precio ALTO:     $${high.reduce((s,t)=>s+t.total,0).toFixed(2)}   (${high.length} tickets)`);
  lines.push(`Total Precio BAJO:     $${low.reduce((s,t)=>s+t.total,0).toFixed(2)}    (${low.length} tickets)`);
  lines.push(`Tickets pre-ingresados: ${pre.length}`);
  lines.push(`Tickets bloqueados:    ${tickets.filter(t => t.locked && !t.prefilled).length}`);
  lines.push("");
  lines.push(SEP);
 
  return lines.join("\n");
}
 
// ─── STYLES ──────────────────────────────────────────────────────────────────
 
const C = {
  bg:"#0f1117", surface:"#1a1d27", border:"#2a2d3a", text:"#e8eaf0", muted:"#6b7280",
  paper:"#f5f0e8", green:"#22c55e", greenDim:"#14532d", amber:"#f59e0b", amberDim:"#78350f",
  red:"#ef4444", purple:"#a855f7", purpleDim:"#581c87",
};
 
const S = {
  page:{ background:C.bg, minHeight:"100vh", fontFamily:"'Share Tech Mono', monospace", color:C.text, paddingBottom:48 },
  topbar:{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"center", overflowX:"auto" },
  logo:{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.35rem", letterSpacing:".15em", color:C.green, textTransform:"uppercase", marginRight:24, padding:"14px 0", whiteSpace:"nowrap" },
  tab:(active)=>({ padding:"14px 18px", fontSize:".72rem", letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer", background:"none", border:"none", borderBottom: active ? `2px solid ${C.green}` : "2px solid transparent", color: active ? C.green : C.muted, fontFamily:"'Share Tech Mono', monospace", whiteSpace:"nowrap" }),
  card:{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:20, marginBottom:16 },
  label:{ display:"block", fontSize:".65rem", letterSpacing:".1em", textTransform:"uppercase", color:C.muted, marginBottom:4 },
  input:{ background:"#0f1117", border:`1px solid ${C.border}`, borderRadius:4, color:C.text, padding:"6px 10px", fontSize:".8rem", fontFamily:"'Share Tech Mono', monospace", width:"100%", outline:"none" },
  btn:(color=C.green)=>({ background:color, color:"#000", border:"none", borderRadius:4, padding:"8px 20px", fontSize:".75rem", letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Share Tech Mono', monospace", fontWeight:"bold" }),
  btnGhost:{ background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:4, padding:"7px 16px", fontSize:".72rem", letterSpacing:".08em", cursor:"pointer", fontFamily:"'Share Tech Mono', monospace" },
  sectionTitle:{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1rem", letterSpacing:".15em", textTransform:"uppercase", marginBottom:12, color:C.text },
};
 
// ─── COMPONENTS ──────────────────────────────────────────────────────────────
 
function TierBadge({ tier }) {
  const high = tier === "HIGH";
  return (
    <span style={{
      display:"inline-block", padding:"2px 8px", borderRadius:3, fontSize:".6rem",
      letterSpacing:".12em", fontWeight:"bold", fontFamily:"'Barlow Condensed', sans-serif",
      background: high ? C.greenDim : C.amberDim,
      color: high ? "#4ade80" : "#fbbf24",
      border: `1px solid ${high ? "#22c55e44" : "#f59e0b44"}`,
    }}>{high ? "▲ HIGH" : "▼ LOW"}</span>
  );
}
 
function TicketCard({ ticket, mats, activeMatCount, minVal, maxVal, onToggleLock, onDeletePrefilled }) {
  const mat = id => mats.find(m => m.id === id);
  const tierColor = ticket.tier === "HIGH" ? "#4ade80" : "#fbbf24";
  const tierBg    = ticket.tier === "HIGH" ? "#052e1644" : "#2d190044";
  const overMax   = ticket.total > maxVal + 0.01;
  const underMin  = ticket.total < minVal - 0.01;
  const missing   = activeMatCount - ticket.items.length;
  const sortedItems = orderItems(ticket.items, mats);
  const isPre = ticket.prefilled;
 
  return (
    <div style={{
      background: ticket.locked || isPre ? "#12141a" : C.paper,
      borderRadius:4, overflow:"hidden",
      boxShadow: ticket.locked || isPre ? "2px 2px 0 #050608" : "4px 4px 0 #060709, 7px 7px 0 rgba(0,0,0,.25)",
      opacity: ticket.locked || isPre ? 0.85 : 1,
      border: isPre ? `1px solid ${C.purple}` : (ticket.locked ? "1px solid #2a2d3a" : (overMax || underMin ? `2px solid ${C.red}` : "none")),
    }}>
      {isPre && (
        <div style={{ background:"#2e1065", color:"#c084fc", fontSize:".6rem", letterSpacing:".12em", textAlign:"center", padding:"3px 0", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700 }}>
          ⭐ PRE-INGRESADO (entrado manualmente)
        </div>
      )}
      {!isPre && ticket.locked && (
        <div style={{ background:"#1f1500", color:"#f59e0b", fontSize:".6rem", letterSpacing:".12em", textAlign:"center", padding:"3px 0", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700 }}>
          🔒 TICKET INGRESADO — BLOQUEADO
        </div>
      )}
      {(overMax || underMin) && !ticket.locked && !isPre && (
        <div style={{ background:"#3b0d0d", color:"#fca5a5", fontSize:".58rem", letterSpacing:".1em", textAlign:"center", padding:"3px 0", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700 }}>
          ⚠ {overMax ? `EXCEDE MÁXIMO ($${maxVal})` : `BAJO MÍNIMO ($${minVal})`}
        </div>
      )}
 
      <div style={{ background:"#1a1a1a", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1rem", letterSpacing:".12em", color: ticket.locked || isPre ? "#6b7280" : "#c8e6c8", textTransform:"uppercase" }}>♻ EcoRecycle</div>
          <div style={{ fontSize:".6rem", color:"#666", letterSpacing:".06em", marginTop:2 }}>TKT {ticket.id}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <TierBadge tier={ticket.tier} />
          <div style={{ fontSize:".58rem", color:"#666", marginTop:4 }}>
            {ticket.time}
          </div>
        </div>
      </div>
 
      <div style={{ background:"#2a2a2a", padding:"6px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:".92rem", color: ticket.locked || isPre ? "#6b7280" : "#f0e8d8", letterSpacing:".05em" }}>{ticket.name}</span>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {missing === 0 && (
            <span style={{ background:"#1e3a8a44", color:"#93c5fd", fontSize:".55rem", padding:"2px 6px", borderRadius:3, fontWeight:"bold", letterSpacing:".06em", border:"1px solid #1e3a8a" }}>✓ COMPLETO</span>
          )}
          <div style={{ background:tierBg, color:tierColor, fontSize:".6rem", padding:"2px 8px", borderRadius:3, fontWeight:"bold", letterSpacing:".08em" }}>
            {ticket.tier === "HIGH" ? "PRECIO ALTO" : "PRECIO BAJO"}
          </div>
        </div>
      </div>
 
      <div style={{ display:"flex", fontSize:".56rem", color:"#888", letterSpacing:".06em", textTransform:"uppercase", padding:"5px 14px 3px", borderBottom:`1px solid ${ticket.locked || isPre ? "#2a2d3a" : "#c8bfa8"}`, background: ticket.locked || isPre ? "#12141a" : C.paper }}>
        <span style={{ flex:1 }}>MATERIAL ({ticket.items.length}{missing > 0 && <span style={{ color:"#9ca3af" }}>/{activeMatCount}</span>})</span>
        <span style={{ width:56, textAlign:"right" }}>LBS</span>
        <span style={{ width:60, textAlign:"right" }}>$/LB</span>
        <span style={{ width:60, textAlign:"right" }}>SUBT.</span>
      </div>
 
      <div style={{ padding:"4px 14px 2px", background: ticket.locked || isPre ? "#12141a" : C.paper }}>
        {sortedItems.map(it => {
          const m = mat(it.matId);
          return (
            <div key={it.matId} style={{ display:"flex", alignItems:"center", padding:"3px 0", borderBottom:`1px dotted ${ticket.locked || isPre ? "#2a2d3a" : "#d8cfbb"}`, fontSize:".69rem", color: ticket.locked || isPre ? "#9ca3af" : "#222" }}>
              <span style={{ flex:1, fontWeight:"bold" }}>{m?.name ?? it.matId}</span>
              <span style={{ width:56, textAlign:"right", color: ticket.locked || isPre ? "#6b7280" : "#555", fontSize:".65rem" }}>
                {m?.isGlass ? Math.round(it.lbs) : it.lbs.toFixed(1)} lb
              </span>
              <span style={{ width:60, textAlign:"right", color: ticket.locked || isPre ? "#6b7280" : "#999", fontSize:".62rem" }}>
                ${it.price.toFixed(3)}
              </span>
              <span style={{ width:60, textAlign:"right", fontWeight:"bold", color: ticket.locked || isPre ? "#9ca3af" : "#2d6a2d" }}>
                ${it.sub.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
 
      <div style={{ margin:"8px 14px 10px", padding:"8px 12px", background:"#1a1a1a", borderRadius:3, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:".8rem", letterSpacing:".1em", color:"#6b7280", textTransform:"uppercase" }}>TOTAL A PAGAR</span>
        <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:"1.3rem", fontWeight:900, color: overMax ? C.red : "#fff" }}>
          ${ticket.total.toFixed(2)}
        </span>
      </div>
 
      <div style={{ padding:"0 14px 12px", background: ticket.locked || isPre ? "#12141a" : C.paper, textAlign:"right" }}>
        {isPre ? (
          <button onClick={() => onDeletePrefilled?.(ticket.id)} style={{ ...S.btnGhost, color:"#fca5a5", borderColor:"#7f1d1d", fontSize:".62rem" }}>
            🗑 Eliminar pre-ingresado
          </button>
        ) : (
          <button onClick={() => onToggleLock(ticket.id)}
            style={{ ...S.btnGhost, color: ticket.locked ? "#f59e0b" : "#6b7280", borderColor: ticket.locked ? "#78350f" : C.border, fontSize:".62rem" }}>
            {ticket.locked ? "🔓 DESBLOQUEAR" : "🔒 MARCAR INGRESADO"}
          </button>
        )}
      </div>
    </div>
  );
}
 
// ─── PREFILLED FORM ──────────────────────────────────────────────────────────
 
function PrefilledForm({ mats, existingNames, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("HIGH");
  const [items, setItems] = useState({});
 
  const getPrice = m => +(tier === "HIGH" ? m.pHigh : m.pLow);
  const total = mats.reduce((s, m) => s + (+(items[m.id] || 0)) * getPrice(m), 0);
  const count = mats.filter(m => +(items[m.id] || 0) > 0).length;
 
  const submit = () => {
    const ticketItems = mats
      .filter(m => +(items[m.id] || 0) > 0)
      .map(m => {
        const lbs = +items[m.id];
        const price = getPrice(m);
        const lbsRound = m.isGlass ? Math.round(lbs) : Math.round(lbs * 10) / 10;
        return { matId: m.id, lbs: lbsRound, price, sub: r2(lbsRound * price) };
      });
    if (!ticketItems.length) return;
    const finalName = name.trim() || pickRandomName(new Set(existingNames));
    onAdd({
      name: finalName, tier, items: orderItems(ticketItems, mats),
      total: r2(ticketItems.reduce((s, it) => s + it.sub, 0)),
      prefilled: true, locked: true, time: "manual",
    });
  };
 
  return (
    <div style={{ ...S.card, background:"#161822", padding:"14px 18px", borderColor: C.purpleDim }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ ...S.sectionTitle, marginBottom:0, color:"#c084fc" }}>⭐ Nuevo Ticket Pre-ingresado</div>
        <button onClick={onCancel} style={S.btnGhost}>Cancelar</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12 }}>
        <input type="text" placeholder="Nombre cliente (opcional)" value={name}
          onChange={e => setName(e.target.value)} style={S.input} />
        <div style={{ display:"flex" }}>
          {["HIGH","LOW"].map((t, idx) => (
            <button key={t} onClick={() => setTier(t)}
              style={{
                padding:"6px 16px", fontSize:".7rem", letterSpacing:".08em", fontWeight:"bold",
                background: tier === t ? (t === "HIGH" ? C.greenDim : C.amberDim) : "transparent",
                color: tier === t ? (t === "HIGH" ? "#4ade80" : "#fbbf24") : C.muted,
                border: `1px solid ${tier === t ? (t === "HIGH" ? "#22c55e" : "#f59e0b") : C.border}`,
                borderRadius: idx === 0 ? "4px 0 0 4px" : "0 4px 4px 0",
                marginLeft: idx === 1 ? -1 : 0,
                cursor:"pointer", fontFamily:"'Share Tech Mono', monospace",
              }}>{t === "HIGH" ? "▲ HIGH" : "▼ LOW"}</button>
          ))}
        </div>
      </div>
 
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(135px, 1fr))", gap:8, marginBottom:12 }}>
        {mats.map(m => (
          <div key={m.id} style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <label style={{ fontSize:".56rem", letterSpacing:".05em", color:C.muted }}>
              {m.name} <span style={{ color: tier === "HIGH" ? "#4ade80" : "#fbbf24" }}>${getPrice(m).toFixed(3)}</span>
            </label>
            <input type="number" min="0" step="0.1" placeholder="0"
              value={items[m.id] || ""}
              onChange={e => setItems(prev => ({ ...prev, [m.id]: e.target.value }))}
              style={{ ...S.input, fontSize:".75rem", padding:"5px 8px" }} />
          </div>
        ))}
      </div>
 
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        <div>
          <span style={{ fontSize:".62rem", color:C.muted, letterSpacing:".06em" }}>{count} mat. · TOTAL: </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color: tier === "HIGH" ? "#4ade80" : "#fbbf24" }}>${total.toFixed(2)}</span>
        </div>
        <button onClick={submit} style={S.btn(C.purple)} disabled={count === 0}>
          ⭐ Agregar Ticket
        </button>
      </div>
    </div>
  );
}
 
// ─── SETUP VIEW ──────────────────────────────────────────────────────────────
 
function SetupView(props) {
  const { mats, setMats, ticketCount, setTicketCount, minVal, setMinVal, maxVal, setMaxVal,
          onGenerate, onReset, tickets, onAddPrefilled, onDeletePrefilled } = props;
 
  const [showForm, setShowForm] = useState(false);
  const prefilled = tickets.filter(t => t.prefilled);
 
  const update = (id, field, val) =>
    setMats(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));
 
  // Compute prefilled lbs used
  const usedLbs = {};
  prefilled.forEach(t => t.items.forEach(it => {
    usedLbs[it.matId] = (usedLbs[it.matId] || 0) + it.lbs;
  }));
 
  // Available lbs after subtracting prefilled
  const totalVal = mats.reduce((s, m) => {
    const lbs = Math.max(0, (+m.lbs || 0) - (usedLbs[m.id] || 0));
    const avg = ((+m.pLow || 0) + (+m.pHigh || 0)) / 2;
    return s + lbs * avg;
  }, 0);
  const remainingTickets = Math.max(0, ticketCount - prefilled.length);
  const avgPerTicket = remainingTickets > 0 ? totalVal / remainingTickets : 0;
  const fits = avgPerTicket >= minVal * 0.9 && avgPerTicket <= maxVal * 1.05;
 
  const thStyle = { padding:"6px 8px", fontSize:".6rem", letterSpacing:".08em", textTransform:"uppercase", color:C.muted, fontWeight:"normal", textAlign:"right", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
  const tdStyle = { padding:"5px 6px", borderBottom:`1px solid ${C.border}88`, verticalAlign:"middle" };
 
  return (
    <div style={{ maxWidth:900, margin:"24px auto", padding:"0 16px" }}>
      {/* Materials */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ background:"#161822", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div style={S.sectionTitle}>📦 Materiales del Día (orden: cans→pet→pet-sp→glass…)</div>
          <button onClick={onReset} style={{ ...S.btnGhost, fontSize:".6rem" }}>↺ Resetear</button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".75rem" }}>
            <thead>
              <tr style={{ background:"#12141a" }}>
                <th style={{ ...thStyle, textAlign:"left", paddingLeft:16 }}>Material</th>
                <th style={thStyle}>Lbs Día</th>
                <th style={{ ...thStyle, color:C.purple }}>Usadas (pre)</th>
                <th style={thStyle}>Disp.</th>
                <th style={{ ...thStyle, color:C.amber }}>$ Bajo</th>
                <th style={{ ...thStyle, color:C.green }}>$ Alto</th>
              </tr>
            </thead>
            <tbody>
              {mats.map((m, idx) => {
                const used = usedLbs[m.id] || 0;
                const avail = Math.max(0, (+m.lbs || 0) - used);
                return (
                  <tr key={m.id} style={{ background: idx % 2 === 0 ? C.surface : "#16181f" }}>
                    <td style={{ ...tdStyle, paddingLeft:16, fontWeight:"bold", color:C.text, letterSpacing:".04em" }}>{m.name}</td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.1" value={m.lbs}
                        onChange={e => update(m.id, "lbs", e.target.value)}
                        style={{ ...S.input, width:74, textAlign:"right" }} placeholder="0" />
                    </td>
                    <td style={{ ...tdStyle, textAlign:"right", color: used > 0 ? "#c084fc" : C.muted, fontSize:".7rem", fontWeight: used > 0 ? "bold" : "normal" }}>
                      {used > 0 ? (m.isGlass ? Math.round(used) : used.toFixed(1)) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign:"right", color: avail > 0 ? "#4ade80" : C.muted, fontSize:".7rem", fontWeight:"bold" }}>
                      {avail > 0 ? (m.isGlass ? Math.round(avail) : avail.toFixed(1)) : "—"}
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.001" value={m.pLow}
                        onChange={e => update(m.id, "pLow", e.target.value)}
                        style={{ ...S.input, width:74, textAlign:"right", borderColor:"#78350f" }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="0.001" value={m.pHigh}
                        onChange={e => update(m.id, "pHigh", e.target.value)}
                        style={{ ...S.input, width:74, textAlign:"right", borderColor:"#14532d" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
 
      {/* Config */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        {[
          { label:"# Tickets Total",         val:ticketCount, set:setTicketCount },
          { label:"Mínimo por Ticket ($)",   val:minVal,      set:setMinVal },
          { label:"Máximo por Ticket ($)",   val:maxVal,      set:setMaxVal },
        ].map(({ label, val, set }) => (
          <div key={label} style={S.card}>
            <label style={S.label}>{label}</label>
            <input type="number" min={1} step={1} value={val}
              onChange={e => set(+e.target.value)}
              style={{ ...S.input, fontSize:"1.1rem", padding:"8px 12px" }} />
          </div>
        ))}
      </div>
 
      {/* Prefilled tickets section */}
      <div style={{ ...S.card, padding:0, overflow:"hidden", borderColor: prefilled.length > 0 ? C.purpleDim : C.border }}>
        <div style={{ background:"#1c1428", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ ...S.sectionTitle, color:"#c084fc", marginBottom:2 }}>⭐ Tickets Ya Ingresados ({prefilled.length})</div>
            <div style={{ fontSize:".6rem", color:C.muted, letterSpacing:".04em" }}>
              Para tickets que ya hiciste manualmente antes. Sus libras se restan de las disponibles.
            </div>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} style={S.btn(C.purple)}>+ Agregar</button>
          )}
        </div>
 
        {showForm && (
          <div style={{ padding:16 }}>
            <PrefilledForm mats={mats} existingNames={tickets.map(t => t.name)}
              onAdd={t => { onAddPrefilled(t); setShowForm(false); }}
              onCancel={() => setShowForm(false)} />
          </div>
        )}
 
        {prefilled.length > 0 && (
          <div style={{ padding:"10px 16px 14px" }}>
            {prefilled.map(t => (
              <div key={t.id} style={{ background:"#0f1117", border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.purple}`, borderRadius:4, padding:"8px 12px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:"bold", color:C.text, fontSize:".82rem" }}>{t.name}</span>
                    <TierBadge tier={t.tier} />
                    <span style={{ color:C.green, fontWeight:"bold", fontFamily:"'Barlow Condensed', sans-serif", fontSize:"1rem" }}>${t.total.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize:".6rem", color:C.muted, letterSpacing:".04em" }}>
                    {t.items.map(it => {
                      const m = mats.find(x => x.id === it.matId);
                      const lbsStr = m?.isGlass ? Math.round(it.lbs) : it.lbs.toFixed(1);
                      return `${m?.name || it.matId}: ${lbsStr}lb`;
                    }).join(" · ")}
                  </div>
                </div>
                <button onClick={() => onDeletePrefilled(t.id)}
                  style={{ ...S.btnGhost, color:"#fca5a5", borderColor:"#7f1d1d", padding:"4px 10px", fontSize:".6rem" }}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
 
      {/* Capacity */}
      <div style={{ ...S.card, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", marginBottom:14, borderColor: fits ? C.greenDim : "#7f1d1d", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:".62rem", color:C.muted, letterSpacing:".08em", marginBottom:4 }}>VALOR DISPONIBLE (sin prefilled)</div>
          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.5rem", color:C.text }}>${totalVal.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize:".62rem", color:C.muted, letterSpacing:".08em", marginBottom:4, textAlign:"right" }}>POR GENERAR ({remainingTickets} tkts)</div>
          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.5rem", color: fits ? C.green : C.red, textAlign:"right" }}>${avgPerTicket.toFixed(2)}</div>
        </div>
        <div style={{ fontSize:".68rem", color: fits ? C.green : C.red, maxWidth:200, textAlign:"right", lineHeight:1.4 }}>
          {fits ? "✓ Cabe en el rango" : (remainingTickets === 0 ? "⚠ Ya hay suficientes prefilled" : "⚠ Promedio fuera de rango")}
        </div>
      </div>
 
      <div style={{ ...S.card, padding:"12px 20px", marginBottom:20 }}>
        <div style={{ fontSize:".65rem", color:C.muted, letterSpacing:".06em", marginBottom:8 }}>VARIEDAD MÁXIMA:</div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:".62rem", color:C.muted }}>
          <span>~10% completos</span>
          <span>El resto: 3–4 hasta N-1 materiales</span>
          <span>Sesgo fuerte a tickets pequeños (3, 4, 5 mat.)</span>
          <span>Materiales baratos se omiten primero</span>
        </div>
      </div>
 
      <button onClick={onGenerate} style={{ ...S.btn(), width:"100%", padding:"12px", fontSize:".85rem", letterSpacing:".15em" }}>
        ⚡ GENERAR TICKETS ({remainingTickets} nuevos + {prefilled.length} pre-ingresados)
      </button>
    </div>
  );
}
 
// ─── TICKETS VIEW ────────────────────────────────────────────────────────────
 
function TicketsView({ tickets, mats, minVal, maxVal, onToggleLock, onDeletePrefilled, onRegenUnlocked, onGoSetup, onExport }) {
  const activeMatCount = mats.filter(m => +m.lbs > 0).length;
  const locked   = tickets.filter(t => t.locked && !t.prefilled).length;
  const prefilled = tickets.filter(t => t.prefilled).length;
  const unlocked = tickets.filter(t => !t.locked && !t.prefilled).length;
  const overMax  = tickets.filter(t => t.total > maxVal + 0.01).length;
  const complete = tickets.filter(t => t.items.length === activeMatCount).length;
  const avgMats  = tickets.length ? (tickets.reduce((s, t) => s + t.items.length, 0) / tickets.length) : 0;
 
  return (
    <div style={{ maxWidth:1280, margin:"24px auto", padding:"0 16px" }}>
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
          <span style={{ fontSize:".6rem", color:C.muted, letterSpacing:".08em" }}>TOTAL </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:C.text }}>{tickets.length}</span>
        </div>
        {prefilled > 0 && (
          <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
            <span style={{ fontSize:".6rem", color:"#c084fc", letterSpacing:".08em" }}>⭐ PRE </span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:"#c084fc" }}>{prefilled}</span>
          </div>
        )}
        <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
          <span style={{ fontSize:".6rem", color:"#93c5fd", letterSpacing:".08em" }}>✓ COMPLETOS </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:"#93c5fd" }}>{complete}</span>
        </div>
        <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
          <span style={{ fontSize:".6rem", color:C.muted, letterSpacing:".08em" }}>PROM MAT </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:C.text }}>{avgMats.toFixed(1)}</span>
        </div>
        <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
          <span style={{ fontSize:".6rem", color:C.muted, letterSpacing:".08em" }}>🔒 LOCKED </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:C.amber }}>{locked}</span>
        </div>
        {overMax > 0 && (
          <div style={{ ...S.card, padding:"10px 18px", margin:0, borderColor:"#7f1d1d" }}>
            <span style={{ fontSize:".6rem", color:C.red, letterSpacing:".08em" }}>⚠ FUERA </span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:C.red }}>{overMax}</span>
          </div>
        )}
        <div style={{ ...S.card, padding:"10px 18px", margin:0 }}>
          <span style={{ fontSize:".6rem", color:C.muted, letterSpacing:".08em" }}>GRAN TOTAL </span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color:C.green }}>
            ${tickets.reduce((s, t) => s + t.total, 0).toFixed(2)}
          </span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={onExport} style={{ ...S.btnGhost, color:"#22c55e", borderColor:C.greenDim }}>💾 Exportar .txt</button>
          {unlocked > 0 && (
            <button onClick={onRegenUnlocked} style={{ ...S.btnGhost, color:"#818cf8", borderColor:"#312e81" }}>
              🔄 Regenerar ({unlocked})
            </button>
          )}
          <button onClick={onGoSetup} style={S.btnGhost}>← Setup</button>
        </div>
      </div>
 
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:20 }}>
        {tickets.map(t => (
          <TicketCard key={t.id} ticket={t} mats={mats} activeMatCount={activeMatCount}
            minVal={minVal} maxVal={maxVal} onToggleLock={onToggleLock} onDeletePrefilled={onDeletePrefilled} />
        ))}
      </div>
    </div>
  );
}
 
// ─── DATA VIEW (export/import/reset) ─────────────────────────────────────────
 
function DataView({ onExportTxt, onExportJson, onImportJson, onResetAll, savedAt }) {
  const [importing, setImporting] = useState(false);
 
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.mats || !Array.isArray(data.mats)) throw new Error("formato inválido");
        onImportJson(data);
        alert("Datos restaurados correctamente.");
      } catch (err) {
        alert("Error al leer archivo: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
 
  return (
    <div style={{ maxWidth:700, margin:"24px auto", padding:"0 16px" }}>
      <div style={S.card}>
        <div style={{ ...S.sectionTitle, marginBottom:8 }}>💾 Respaldo y Persistencia</div>
        <div style={{ fontSize:".7rem", color:C.muted, lineHeight:1.6, marginBottom:14 }}>
          Los datos se guardan automáticamente en tu navegador. Para respaldo seguro, exporta a archivo.
          {savedAt && <div style={{ marginTop:6, color:C.green, fontSize:".62rem" }}>✓ Último guardado: {new Date(savedAt).toLocaleString()}</div>}
        </div>
 
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <button onClick={onExportTxt} style={{ ...S.btn(), padding:"14px" }}>
            📄 Exportar .txt<br/><span style={{ fontSize:".55rem", fontWeight:"normal" }}>reporte legible</span>
          </button>
          <button onClick={onExportJson} style={{ ...S.btn("#818cf8"), padding:"14px" }}>
            📦 Exportar .json<br/><span style={{ fontSize:".55rem", fontWeight:"normal" }}>backup completo</span>
          </button>
        </div>
 
        <div style={{ marginBottom:14 }}>
          <label style={{ ...S.btnGhost, display:"block", textAlign:"center", padding:"10px", cursor:"pointer", color:"#c084fc", borderColor:C.purpleDim }}>
            📂 Importar Backup (.json)
            <input type="file" accept=".json,application/json" onChange={handleImport} style={{ display:"none" }} />
          </label>
        </div>
 
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          <button onClick={() => {
            if (confirm("¿Borrar TODO? Esto elimina materiales, tickets, prefilled y configuración.")) {
              onResetAll();
            }
          }} style={{ ...S.btnGhost, width:"100%", color:"#fca5a5", borderColor:"#7f1d1d" }}>
            🗑 Borrar Todo
          </button>
        </div>
      </div>
    </div>
  );
}
 
// ─── ADD LBS VIEW ────────────────────────────────────────────────────────────
 
function AddLbsView({ mats, tickets, delta, setDelta, onApply, onCancel }) {
  const locked   = tickets.filter(t => t.locked || t.prefilled).length;
  const unlocked = tickets.length - locked;
 
  return (
    <div style={{ maxWidth:700, margin:"24px auto", padding:"0 16px" }}>
      <div style={S.card}>
        <div style={{ ...S.sectionTitle, marginBottom:8 }}>➕ Agregar Libras</div>
        <div style={{ fontSize:".7rem", color:C.muted, marginBottom:20, lineHeight:1.6 }}>
          Las libras se redistribuirán solo entre los <span style={{ color:C.green }}>{unlocked} desbloqueados</span>.
          Los <span style={{ color:"#fbbf24" }}>🔒 {locked} bloqueados/pre-ingresados</span> no cambian.
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".75rem", marginBottom:20 }}>
          <thead>
            <tr style={{ background:"#12141a" }}>
              <th style={{ padding:"8px 10px", textAlign:"left", fontSize:".6rem", color:C.muted, borderBottom:`1px solid ${C.border}` }}>MATERIAL</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontSize:".6rem", color:C.muted, borderBottom:`1px solid ${C.border}` }}>LBS ACT.</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontSize:".6rem", color:C.green, borderBottom:`1px solid ${C.border}` }}>+ AGREGAR</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontSize:".6rem", color:C.muted, borderBottom:`1px solid ${C.border}` }}>NUEVO</th>
            </tr>
          </thead>
          <tbody>
            {mats.map((m, i) => (
              <tr key={m.id} style={{ background: i % 2 === 0 ? C.surface : "#16181f" }}>
                <td style={{ padding:"6px 10px", fontWeight:"bold", color:C.text }}>{m.name}</td>
                <td style={{ padding:"6px 10px", textAlign:"right", color:C.muted }}>{+m.lbs > 0 ? (+m.lbs).toFixed(1) : "—"}</td>
                <td style={{ padding:"6px 10px", textAlign:"right" }}>
                  <input type="number" min="0" step="0.1" value={delta[m.id] || ""}
                    onChange={e => setDelta(prev => ({ ...prev, [m.id]: e.target.value }))}
                    style={{ ...S.input, width:80, textAlign:"right", borderColor:"#14532d" }} placeholder="0" />
                </td>
                <td style={{ padding:"6px 10px", textAlign:"right", color:C.green, fontWeight:"bold" }}>
                  {(+m.lbs + (+(delta[m.id] || 0))).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={S.btnGhost}>Cancelar</button>
          <button onClick={onApply} style={S.btn()}>✓ Aplicar a {unlocked} desbloqueados</button>
        </div>
      </div>
    </div>
  );
}
 
// ─── SUMMARY VIEW ────────────────────────────────────────────────────────────
 
function SummaryView({ tickets, mats, minVal, maxVal, onExport }) {
  const activeMats = mats.filter(m => +m.lbs > 0 || tickets.some(t => t.items.some(it => it.matId === m.id)));
  const activeMatCount = activeMats.length;
 
  const [excluded, setExcluded] = useState(new Set());
  const isIncluded = id => !excluded.has(id);
  const toggleMat = id => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
 
  const filteredTickets = tickets.map(t => {
    const items = t.items.filter(it => isIncluded(it.matId));
    const total = r2(items.reduce((s, it) => s + it.sub, 0));
    return { ...t, fItems: items, fTotal: total };
  });
 
  const byMat = {}, byMatH = {}, byMatL = {};
  filteredTickets.forEach(t => t.fItems.forEach(it => {
    byMat[it.matId]  = (byMat[it.matId]  || 0) + it.lbs;
    if (t.tier === "HIGH") byMatH[it.matId] = (byMatH[it.matId] || 0) + it.lbs;
    else                   byMatL[it.matId] = (byMatL[it.matId] || 0) + it.lbs;
  }));
 
  const highT = filteredTickets.filter(t => t.tier === "HIGH");
  const lowT  = filteredTickets.filter(t => t.tier === "LOW");
  const grandTotal = filteredTickets.reduce((s, t) => s + t.fTotal, 0);
  const highTotal  = highT.reduce((s, t) => s + t.fTotal, 0);
  const lowTotal   = lowT.reduce((s, t) => s + t.fTotal, 0);
  const realGrand  = tickets.reduce((s, t) => s + t.total, 0);
  const isFiltered = excluded.size > 0;
  const preCount   = tickets.filter(t => t.prefilled).length;
  const preTotal   = filteredTickets.filter(t => t.prefilled).reduce((s, t) => s + t.fTotal, 0);
 
  const thS = { padding:"8px 12px", fontSize:".6rem", letterSpacing:".08em", textTransform:"uppercase", color:C.muted, textAlign:"right", borderBottom:`1px solid ${C.border}`, fontWeight:"normal" };
  const tdS = { padding:"6px 12px", borderBottom:`1px solid ${C.border}44`, textAlign:"right", fontSize:".75rem" };
 
  return (
    <div style={{ maxWidth:900, margin:"24px auto", padding:"0 16px" }}>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button onClick={onExport} style={S.btn()}>💾 Exportar Reporte .txt</button>
      </div>
 
      {/* Filter */}
      <div style={{ ...S.card, padding:"14px 20px", borderColor: isFiltered ? "#78350f" : C.border, background: isFiltered ? "#1a1308" : C.surface }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:".95rem", letterSpacing:".12em", textTransform:"uppercase", color: isFiltered ? C.amber : C.text }}>
              🔍 Materiales en el Reporte
            </span>
            {isFiltered && (
              <span style={{ background:"#78350f", color:"#fbbf24", fontSize:".55rem", padding:"3px 8px", borderRadius:3, fontWeight:"bold" }}>
                FILTRO ({excluded.size})
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setExcluded(new Set())} style={{ ...S.btnGhost, fontSize:".6rem", color: !isFiltered ? C.green : C.muted }}>✓ Todos</button>
            <button onClick={() => setExcluded(new Set(activeMats.map(m => m.id)))} style={{ ...S.btnGhost, fontSize:".6rem" }}>✗ Ninguno</button>
          </div>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {activeMats.map(m => {
            const incl = isIncluded(m.id);
            return (
              <button key={m.id} onClick={() => toggleMat(m.id)}
                style={{
                  padding:"7px 14px", borderRadius:20, fontSize:".7rem", fontWeight:"bold",
                  fontFamily:"'Share Tech Mono', monospace", cursor:"pointer",
                  border: incl ? `1px solid ${C.green}` : `1px solid ${C.border}`,
                  background: incl ? C.greenDim : "transparent",
                  color: incl ? "#4ade80" : C.muted,
                }}>{incl ? "✓" : "✗"} {m.name}</button>
            );
          })}
        </div>
      </div>
 
      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        {[
          { label: isFiltered ? "Total Filtrado" : "Gran Total", val:grandTotal, color:C.text, count:tickets.length, sub: isFiltered ? `de $${realGrand.toFixed(2)}` : null },
          { label:"Precio ALTO", val:highTotal, color:"#4ade80", count:highT.length },
          { label:"Precio BAJO", val:lowTotal,  color:"#fbbf24", count:lowT.length },
        ].map(({ label, val, color, count, sub }) => (
          <div key={label} style={{ ...S.card, textAlign:"center" }}>
            <div style={{ ...S.label, textAlign:"center" }}>{label}</div>
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"2rem", color }}>${val.toFixed(2)}</div>
            <div style={{ fontSize:".65rem", color:C.muted }}>{count} tickets</div>
            {sub && <div style={{ fontSize:".58rem", color:C.amber, marginTop:2 }}>{sub}</div>}
          </div>
        ))}
      </div>
 
      {preCount > 0 && (
        <div style={{ ...S.card, borderColor:C.purpleDim, background:"#1c1428", padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <span style={{ fontSize:".62rem", color:"#c084fc", letterSpacing:".08em" }}>⭐ INCLUYE {preCount} TICKETS PRE-INGRESADOS </span>
            <span style={{ fontSize:".58rem", color:C.muted, marginLeft:6 }}>(ya entrados antes manualmente)</span>
          </div>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, color:"#c084fc", fontSize:"1.1rem" }}>${preTotal.toFixed(2)}</span>
        </div>
      )}
 
      {/* Variety distro */}
      <div style={{ ...S.card, padding:0, overflow:"hidden", marginBottom:20 }}>
        <div style={{ background:"#161822", padding:"12px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={S.sectionTitle}>📦 Distribución de Variedad <span style={{ fontSize:".55rem", color:C.muted, marginLeft:8 }}>(materiales por ticket)</span></div>
        </div>
        <div style={{ padding:"14px 20px", display:"flex", gap:24, flexWrap:"wrap" }}>
          {(() => {
            const buckets = {};
            tickets.forEach(t => {
              const k = t.items.length;
              buckets[k] = (buckets[k] || 0) + 1;
            });
            return Object.entries(buckets).sort(([a], [b]) => +a - +b).map(([cnt, n]) => (
              <div key={cnt} style={{ display:"flex", flexDirection:"column" }}>
                <span style={{ fontSize:".62rem", color:C.muted, letterSpacing:".06em" }}>
                  {+cnt === activeMatCount ? "✓ Completos" : `${cnt} mat.`}
                </span>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.4rem", color: +cnt === activeMatCount ? "#93c5fd" : C.text }}>
                  {n} <span style={{ fontSize:".7rem", color:C.muted }}>tkts</span>
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
 
      {/* Per material */}
      <div style={{ ...S.card, padding:0, overflow:"hidden", marginBottom:20 }}>
        <div style={{ background:"#161822", padding:"12px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={S.sectionTitle}>📊 Resumen por Material</div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#12141a" }}>
              <th style={{ ...thS, textAlign:"left", paddingLeft:20 }}>Material</th>
              <th style={thS}>Total LBS</th>
              <th style={{ ...thS, color:"#4ade80" }}>LBS HIGH</th>
              <th style={{ ...thS, color:"#fbbf24" }}>LBS LOW</th>
              <th style={thS}>$ Total</th>
            </tr>
          </thead>
          <tbody>
            {activeMats.filter(m => isIncluded(m.id)).map((m, i) => {
              const lbs = byMat[m.id] || 0;
              const inT = filteredTickets.filter(t => t.fItems.some(it => it.matId === m.id)).length;
              const matTot = filteredTickets.reduce((s, t) => {
                const it = t.fItems.find(x => x.matId === m.id);
                return s + (it ? it.sub : 0);
              }, 0);
              return (
                <tr key={m.id} style={{ background: i % 2 === 0 ? C.surface : "#16181f" }}>
                  <td style={{ ...tdS, textAlign:"left", paddingLeft:20, fontWeight:"bold", color:C.text }}>
                    {m.name} <span style={{ fontSize:".58rem", color:C.muted, marginLeft:6 }}>({inT}/{tickets.length})</span>
                  </td>
                  <td style={{ ...tdS, color:C.text }}>{m.isGlass ? Math.round(lbs) : lbs.toFixed(1)} lb</td>
                  <td style={{ ...tdS, color:"#4ade80" }}>{(byMatH[m.id] || 0).toFixed(1)} lb</td>
                  <td style={{ ...tdS, color:"#fbbf24" }}>{(byMatL[m.id] || 0).toFixed(1)} lb</td>
                  <td style={{ ...tdS, color:C.green, fontWeight:"bold" }}>${matTot.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr style={{ background:"#0f1117" }}>
              <td style={{ ...tdS, textAlign:"left", paddingLeft:20, fontWeight:"bold" }}>TOTAL</td>
              <td colSpan={3}></td>
              <td style={{ ...tdS, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1rem", color:C.green }}>${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
 
      {/* Per ticket */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ background:"#161822", padding:"12px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={S.sectionTitle}>🎫 Detalle de Tickets</div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#12141a" }}>
              <th style={{ ...thS, textAlign:"left", paddingLeft:20 }}>TKT</th>
              <th style={{ ...thS, textAlign:"left" }}>Cliente</th>
              <th style={thS}>Tier</th>
              <th style={thS}>Items</th>
              <th style={thS}>Total</th>
              <th style={thS}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((t, i) => {
              const over = t.fTotal > maxVal + 0.01;
              return (
                <tr key={t.id} style={{ background: i % 2 === 0 ? C.surface : "#16181f" }}>
                  <td style={{ ...tdS, textAlign:"left", paddingLeft:20, color:C.muted }}>{t.id}</td>
                  <td style={{ ...tdS, textAlign:"left", fontWeight:"bold", color:C.text }}>{t.name}</td>
                  <td style={tdS}><TierBadge tier={t.tier} /></td>
                  <td style={{ ...tdS, color:C.muted }}>{t.fItems.length}</td>
                  <td style={{ ...tdS, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, color: over ? C.red : C.text }}>
                    ${t.fTotal.toFixed(2)}
                    {isFiltered && t.fTotal !== t.total && (
                      <div style={{ fontSize:".55rem", color:C.muted }}>de ${t.total.toFixed(2)}</div>
                    )}
                  </td>
                  <td style={{ ...tdS, fontSize:".62rem" }}>
                    {t.prefilled ? <span style={{ color:"#c084fc" }}>⭐ PRE</span> :
                     t.locked ? <span style={{ color:"#fbbf24" }}>🔒</span> :
                     over ? <span style={{ color:C.red }}>⚠</span> :
                     <span style={{ color:"#22c55e" }}>⬜</span>}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background:"#0f1117" }}>
              <td colSpan={4} style={{ ...tdS, textAlign:"left", paddingLeft:20, fontWeight:"bold", fontFamily:"'Barlow Condensed', sans-serif" }}>GRAN TOTAL</td>
              <td style={{ ...tdS, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"1.1rem", color:C.green }}>${grandTotal.toFixed(2)}</td>
              <td style={tdS}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
 
// ─── ROOT APP ────────────────────────────────────────────────────────────────
 
const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};
 
export default function App() {
  const saved = (typeof window !== "undefined") ? loadFromStorage() : null;
 
  const [tab,         setTab]         = useState(saved?.tab ?? "setup");
  const [mats,        setMats]        = useState(saved?.mats ?? DEFAULT_MATS.map(m => ({ ...m })));
  const [ticketCount, setTicketCount] = useState(saved?.ticketCount ?? 10);
  const [minVal,      setMinVal]      = useState(saved?.minVal ?? 15);
  const [maxVal,      setMaxVal]      = useState(saved?.maxVal ?? 95);
  const [tickets,     setTickets]     = useState(saved?.tickets ?? []);
  const [delta,       setDelta]       = useState({});
  const [error,       setError]       = useState("");
  const [savedAt,     setSavedAt]     = useState(saved?.savedAt ?? null);
 
  // Auto-save to localStorage
  useEffect(() => {
    try {
      const at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tab, mats, ticketCount, minVal, maxVal, tickets, savedAt: at,
      }));
      setSavedAt(at);
    } catch (e) {}
  }, [tab, mats, ticketCount, minVal, maxVal, tickets]);
 
  const handleAddPrefilled = (ticket) => {
    setTickets(prev => renumber([...prev, ticket]));
  };
 
  const handleDeletePrefilled = (id) => {
    setTickets(prev => renumber(prev.filter(t => t.id !== id)));
  };
 
  const handleGenerate = () => {
    const prefilled = tickets.filter(t => t.prefilled);
    const usedLbs = {};
    prefilled.forEach(t => t.items.forEach(it => {
      usedLbs[it.matId] = (usedLbs[it.matId] || 0) + it.lbs;
    }));
    const availMats = mats.map(m => ({
      ...m, lbs: String(Math.max(0, (+m.lbs || 0) - (usedLbs[m.id] || 0))),
    }));
    const remaining = ticketCount - prefilled.length;
    if (remaining <= 0) {
      setError("Ya hay suficientes tickets pre-ingresados. Aumenta # tickets o elimina alguno.");
      return;
    }
    const usedNames = new Set(prefilled.map(t => t.name));
    const generated = generateTickets(availMats, remaining, minVal, maxVal,
      { excludeNames: Array.from(usedNames) });
    if (!generated.length) {
      setError("No se pudieron generar tickets. Agrega libras a los materiales.");
      return;
    }
    setTickets(renumber([...prefilled, ...generated]));
    setDelta({});
    setError("");
    setTab("tickets");
  };
 
  const handleRegenUnlocked = () => {
    const fixed = tickets.filter(t => t.locked || t.prefilled);
    const unlocked = tickets.filter(t => !t.locked && !t.prefilled);
    if (!unlocked.length) return;
    const usedLbs = {};
    fixed.forEach(t => t.items.forEach(it => {
      usedLbs[it.matId] = (usedLbs[it.matId] || 0) + it.lbs;
    }));
    const availMats = mats.map(m => ({
      ...m, lbs: String(Math.max(0, (+m.lbs || 0) - (usedLbs[m.id] || 0))),
    }));
    const usedNames = new Set(fixed.map(t => t.name));
    const regen = generateTickets(availMats, unlocked.length, minVal, maxVal,
      { names: unlocked.map(t => t.name), excludeNames: Array.from(usedNames) });
    setTickets(renumber([...fixed, ...regen]));
  };
 
  const handleApplyDelta = () => {
    const fixed = tickets.filter(t => t.locked || t.prefilled);
    const unlocked = tickets.filter(t => !t.locked && !t.prefilled);
    if (!unlocked.length) {
      setMats(mats.map(m => ({ ...m, lbs: String((+m.lbs || 0) + (+(delta[m.id] || 0))) })));
      setDelta({});
      setTab("tickets");
      return;
    }
    const usedLbs = {};
    fixed.forEach(t => t.items.forEach(it => {
      usedLbs[it.matId] = (usedLbs[it.matId] || 0) + it.lbs;
    }));
    const newMatLbs = mats.map(m => ({
      ...m, lbs: String((+m.lbs || 0) + (+(delta[m.id] || 0))),
    }));
    const availMats = newMatLbs.map(m => ({
      ...m, lbs: String(Math.max(0, (+m.lbs || 0) - (usedLbs[m.id] || 0))),
    }));
    const regen = generateTickets(availMats, unlocked.length, minVal, maxVal,
      { tiers: unlocked.map(t => t.tier), names: unlocked.map(t => t.name) });
    setMats(newMatLbs);
    setTickets(renumber([...fixed, ...regen]));
    setDelta({});
    setTab("tickets");
  };
 
  const handleReset = () => setMats(DEFAULT_MATS.map(m => ({ ...m })));
 
  const handleExportTxt = () => {
    const content = generateTxtReport({ mats, tickets, minVal, maxVal, ticketCount });
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`ecorecycle-${date}.txt`, content);
  };
 
  const handleExportJson = () => {
    const data = { mats, ticketCount, minVal, maxVal, tickets, savedAt: new Date().toISOString() };
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`ecorecycle-backup-${date}.json`, JSON.stringify(data, null, 2), "application/json");
  };
 
  const handleImportJson = (data) => {
    if (data.mats) setMats(data.mats);
    if (data.ticketCount) setTicketCount(data.ticketCount);
    if (data.minVal != null) setMinVal(data.minVal);
    if (data.maxVal != null) setMaxVal(data.maxVal);
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    setTab(data.tickets?.length ? "tickets" : "setup");
  };
 
  const handleResetAll = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setMats(DEFAULT_MATS.map(m => ({ ...m })));
    setTicketCount(10);
    setMinVal(15);
    setMaxVal(95);
    setTickets([]);
    setDelta({});
    setError("");
    setTab("setup");
  };
 
  const tabs = [
    { id:"setup",   label:"⚙ Setup" },
    { id:"tickets", label:"🎫 Tickets", disabled: !tickets.length },
    { id:"addlbs",  label:"➕ Lbs", disabled: !tickets.length },
    { id:"summary", label:"📊 Resumen", disabled: !tickets.length },
    { id:"data",    label:"💾 Datos" },
  ];
 
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        input:focus { outline: 1px solid #22c55e88 !important; }
        button:hover { filter: brightness(1.1); }
        button:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
      <div style={S.page}>
        <div style={S.topbar}>
          <div style={S.logo}>♻ EcoRecycle</div>
          {tabs.map(t => (
            <button key={t.id} style={S.tab(tab === t.id)}
              onClick={() => !t.disabled && setTab(t.id)} disabled={t.disabled}>
              {t.label}
            </button>
          ))}
          {savedAt && (
            <div style={{ marginLeft:"auto", fontSize:".55rem", color:C.muted, padding:"14px 0" }}>
              💾 {new Date(savedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
 
        {error && (
          <div style={{ background:"#3b0d0d", border:`1px solid ${C.red}`, color:"#fca5a5", padding:"10px 24px", fontSize:".72rem", letterSpacing:".06em" }}>⚠ {error}</div>
        )}
 
        {tab === "setup" && (
          <SetupView mats={mats} setMats={setMats}
            ticketCount={ticketCount} setTicketCount={setTicketCount}
            minVal={minVal} setMinVal={setMinVal}
            maxVal={maxVal} setMaxVal={setMaxVal}
            tickets={tickets}
            onAddPrefilled={handleAddPrefilled}
            onDeletePrefilled={handleDeletePrefilled}
            onGenerate={handleGenerate} onReset={handleReset} />
        )}
        {tab === "tickets" && (
          <TicketsView tickets={tickets} mats={mats} minVal={minVal} maxVal={maxVal}
            onToggleLock={id => setTickets(prev => prev.map(t => t.id === id ? { ...t, locked: !t.locked } : t))}
            onDeletePrefilled={handleDeletePrefilled}
            onRegenUnlocked={handleRegenUnlocked}
            onGoSetup={() => setTab("setup")}
            onExport={handleExportTxt} />
        )}
        {tab === "addlbs" && (
          <AddLbsView mats={mats} tickets={tickets} delta={delta} setDelta={setDelta}
            onApply={handleApplyDelta} onCancel={() => setTab("tickets")} />
        )}
        {tab === "summary" && (
          <SummaryView tickets={tickets} mats={mats} minVal={minVal} maxVal={maxVal} onExport={handleExportTxt} />
        )}
        {tab === "data" && (
          <DataView onExportTxt={handleExportTxt} onExportJson={handleExportJson}
            onImportJson={handleImportJson} onResetAll={handleResetAll}
            savedAt={savedAt} />
        )}
      </div>
    </>
  );
}
