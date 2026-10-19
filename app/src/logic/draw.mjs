// 画字玩法的评分纯逻辑。客户端与 tools/ 共用这一份。
//
// 设计原则（PLAN-画甲骨文 §5.1）：不做像素级比对。孩子手抖、线条弯曲、笔顺
// 不同都是常态，判定要宽容到「意思对就算对」——宁可放过，不可挫败。
//
// 三条算法约束（§5.3.1 实测，改算法前先读）：
//   1. 图元数 ≤2 的字（43 个，日/一/口）用独立宽松判定——统一阈值会让
//      最基础的字最不宽容，是设计事故
//   2. 玩家笔画归一成 line/dot 两类（重采样后取端点）；目标图元的
//      circle/ellipse/arc 按「中心距」判，rect 按外框线判
//   3. 193 字全由 line 构成——靠「角度 + 中心距 + 长度比」三条件判命中，
//      深度拓扑（上横短下横长）在实测调参阶段再收紧（§5.4：阈值不许拍脑袋定稿）
//
// 阈值现状：起始值。验收前必须用真实笔画轨迹回放调参（§5.4）。

import { djb2, mulberry32 } from './daily.mjs'

export const CANVAS = 512

// 三档阈值（起始值，待真实样本回放调参）
export const LEVELS = {
  trace: { name: '临摹', pass: 0.5, stars: [0.5, 0.7, 0.9], tol: 96 },
  copy: { name: '描红', pass: 0.7, stars: [0.9, 0.8, 0.7], tol: 72 },
  free: { name: '自由画', pass: 0.6, stars: [0.85, 0.75, 0.6], tol: 72 },
}

/** 点列按弧长重采样（消除笔速差异）。 */
export function resample(points, step = 16) {
  if (points.length < 2) return points.slice()
  const out = [points[0]]
  let prev = points[0]
  let acc = 0
  for (let i = 1; i < points.length; i++) {
    const cur = points[i]
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    const d = Math.hypot(dx, dy)
    acc += d
    while (acc >= step) {
      const t = 1 - (acc - step) / d
      out.push({ x: prev.x + dx * t, y: prev.y + dy * t })
      acc -= step
    }
    prev = cur
  }
  out.push(points[points.length - 1])
  return out
}

/** 一笔玩家轨迹 → 归一化图元：短笔画是 dot，其余是带角度/长度/中心的 line。 */
export function strokeToPrim(points) {
  const pts = resample(points)
  if (pts.length < 2) {
    return { type: 'dot', cx: pts[0].x, cy: pts[0].y }
  }
  const a = pts[0]
  const b = pts[pts.length - 1]
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len < 24) {
    return { type: 'dot', cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
  }
  return {
    type: 'line',
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    len,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
  }
}

/** 目标图元（来自快照 strokes）→ 判定用的中心/几何量。 */
export function targetPrim(prim) {
  const [type, ...p] = prim
  if (type === 'line') return { type, x1: p[0], y1: p[1], x2: p[2], y2: p[3], len: Math.hypot(p[2] - p[0], p[3] - p[1]), angle: Math.atan2(p[3] - p[1], p[2] - p[0]), cx: (p[0] + p[2]) / 2, cy: (p[1] + p[3]) / 2 }
  if (type === 'dot') return { type, cx: p[0], cy: p[1] }
  if (type === 'circle') return { type, cx: p[0], cy: p[1] }
  if (type === 'ellipse') return { type, cx: p[0], cy: p[1] }
  if (type === 'arc') return { type, cx: p[0], cy: p[1] }
  if (type === 'rect') return { type, cx: (p[0] + p[2]) / 2, cy: (p[1] + p[3]) / 2, w: Math.abs(p[2] - p[0]), h: Math.abs(p[3] - p[1]) }
  return { type, cx: p[0] || 0, cy: p[1] || 0 }
}

function angleDiff(a, b) {
  let d = Math.abs(a - b) % Math.PI
  return Math.min(d, Math.PI - d)
}

/** 一条线段目标与玩家线段的命中（角度 + 中心距 + 长度比）。 */
function lineHit(t, s, tol) {
  if (s.type !== 'line') return false
  if (angleDiff(t.angle, s.angle) > Math.PI / 8) return false // ±22.5°
  if (Math.hypot(t.cx - s.cx, t.cy - s.cy) > tol) return false
  const ratio = s.len / Math.max(1, t.len)
  return ratio >= 0.5 && ratio <= 2.0
}

function centerHit(t, s, tol) {
  if (s.type === 'dot') return Math.hypot(t.cx - s.cx, t.cy - s.cy) <= tol
  if (s.type === 'line') {
    // 长线扫过圆/点也算命中：中心距按线段最近点算的近似——用中点距的宽容版
    return Math.hypot(t.cx - s.cx, t.cy - s.cy) <= tol * 1.2
  }
  return false
}

/** 相似度：目标图元被玩家笔画命中的比例（玩家图元可复用——一笔可同时喂多个近邻目标）。
 *  图元数 ≤2 的目标走独立宽松判定：tol×1.6（§5.3.1 约束 1）。 */
export function scoreDraw(playerPrims, targetStrokes, level = 'copy') {
  const cfg = LEVELS[level] || LEVELS.copy
  const targets = targetStrokes.map(targetPrim)
  const tol = cfg.tol * (targets.length <= 2 ? 1.6 : 1)
  if (!targets.length) return 0
  if (!playerPrims.length) return 0
  let hits = 0
  const used = new Set()
  for (const t of targets) {
    let best = -1
    let bestD = Infinity
    playerPrims.forEach((s, i) => {
      if (used.has(i)) return
      const d = Math.hypot(t.cx - s.cx, t.cy - s.cy)
      const ok = t.type === 'line' ? lineHit(t, s, tol) : centerHit(t, s, tol)
      if (ok && d < bestD) { bestD = d; best = i }
    })
    if (best >= 0) { used.add(best); hits++ }
  }
  return hits / targets.length
}

/** 判定：相似度 → 过/不过 + 星级（§5.4 起始阈值）。 */
export function judge(sim, level) {
  const cfg = LEVELS[level] || LEVELS.copy
  const pass = sim >= cfg.pass
  let stars = 0
  if (pass) {
    stars = sim >= cfg.stars[0] ? 3 : sim >= cfg.stars[1] ? 2 : 1
  }
  return { pass, stars }
}

/** 乱画样本（坏样本生成器）：把目标图元整体平移出画布中心区，角度翻转。 */
export function scrambleStrokes(strokes, seedStr) {
  const rng = mulberry32(djb2('scramble:' + seedStr))
  return strokes.map((prim) => {
    const [type, ...p] = prim
    const off = () => (rng() - 0.5) * 300
    if (type === 'line') return ['line', p[0] + 200 + off(), p[1] + 200 + off(), p[2] + 200 + off(), p[3] + 200 + off()]
    return [type, Math.min(CANVAS - 1, Math.max(0, p[0] + 200 + off())), Math.min(CANVAS - 1, Math.max(0, p[1] + 200 + off())), ...p.slice(2)]
  })
}
