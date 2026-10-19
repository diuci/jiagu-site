// tools/check-draw.mjs —— 画字玩法的判定闸门（PLAN-画甲骨文 §5.4 / §7.2）。
//
// 阈值可以调，但两条硬底线不许破：
//   1. 标准答案必须得满分——孩子照着标准字形描，判不过 = 算法是坏的
//   2. 乱画必须判低分——胡涂乱抹也能过 = 玩法失效
// 另查数据完备：快照里每字都有 strokes。
//
// 用法：node tools/check-draw.mjs [--selftest]

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreDraw, judge, strokeToPrim, scrambleStrokes, strokesToPointStrokes as strokesAsPoints } from '../app/src/logic/draw.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '../app/src/data/corpus.json')

function run() {
  let corpus
  try { corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) }
  catch { console.error('[!!] 读不到快照：' + CORPUS); return 1 }
  const chars = corpus.chars || []
  const noData = chars.filter((c) => !c.strokes || !c.strokes.length)
  if (noData.length) {
    console.error('[!!] ' + noData.length + ' 字缺笔画数据（先重跑内容仓 build + sync）：' + noData.slice(0, 5).map((c) => c.id).join(','))
    return 1
  }
  const problems = []
  const levels = ['trace', 'copy', 'free']
  for (const c of chars) {
    const pts = strokesAsPoints(c.strokes)
    const prims = pts.map(strokeToPrim)
    for (const lv of levels) {
      const sim = scoreDraw(prims, c.strokes, lv)
      if (sim < 0.999) problems.push(c.id + ' 标准答案在 ' + lv + ' 档只得 ' + sim.toFixed(2) + '（必须≈1）')
      const j = judge(sim, lv)
      if (!j.pass) problems.push(c.id + ' 标准答案在 ' + lv + ' 档判不过')
    }
    // 乱画必须低分：拿另一字的笔画当乱画（至少 90% 的字要被正确判低）
  }
  let lowOk = 0
  for (const c of chars) {
    const other = chars[(c.id.length + c.char.charCodeAt(0)) % chars.length]
    if (other.id === c.id) continue
    const scrambled = scrambleStrokes(other.strokes, c.id)
    const prims = strokesAsPoints(scrambled).map(strokeToPrim)
    const sim = scoreDraw(prims, c.strokes, 'free')
    if (sim < 0.6) lowOk++
  }
  const total = chars.length
  if (lowOk < total * 0.9) {
    problems.push('乱画判低分的字只有 ' + lowOk + '/' + total + '（≥90% 才算玩法有效）')
  }
  if (problems.length) {
    for (const p of problems.slice(0, 20)) console.error('[!!] ' + p)
    console.error('    共 ' + problems.length + ' 个问题')
    return 1
  }
  console.log('[ok] 画字判定：' + chars.length + ' 字 × 3 档标准答案满分；乱画判低 ' + lowOk + '/' + total)
  return 0
}

function selftest() {
  const cases = []
  const add = (name, fn) => {
    const r = fn()
    if (r !== true) { console.error('[!!] ' + r); process.exitCode = 1; return }
    cases.push(name)
  }
  const target = [['line', 256, 140, 256, 330], ['line', 170, 210, 170, 330], ['line', 120, 330, 392, 330]] // 山
  add('好样本：标准答案的笔画点列判满分', () => {
    const prims = strokesAsPoints(target).map(strokeToPrim)
    return scoreDraw(prims, target, 'copy') >= 0.999 ? true : '标准答案没得满分'
  })
  add('坏样本：整体平移出中心的乱画判低分', () => {
    const scrambled = scrambleStrokes(target, 'test')
    const prims = strokesAsPoints(scrambled).map(strokeToPrim)
    return scoreDraw(prims, target, 'free') < 0.6 ? true : '乱画没被判低'
  })
  add('坏样本：空笔画判 0', () => scoreDraw([], target, 'copy') === 0 ? true : '空笔画不是 0 分')
  add('宽判：图元数 ≤2 的目标容差放大（日：circle+dot）', () => {
    const ri = [['circle', 256, 256, 110], ['dot', 256, 256, 12]]
    const prims = strokesAsPoints(ri).map(strokeToPrim)
    return scoreDraw(prims, ri, 'free') >= 0.999 ? true : '少图元目标判失败'
  })
  add('角度容差：±22.5° 内的近似共线命中', () => {
    const t = [['line', 256, 140, 256, 330]]
    const prims = [strokeToPrim([{ x: 258, y: 142 }, { x: 254, y: 328 }])]
    return scoreDraw(prims, t, 'copy') >= 0.999 ? true : '近似竖线没命中'
  })
  add('dot 识别：短笔画归为点', () => {
    const p = strokeToPrim([{ x: 256, y: 256 }, { x: 258, y: 257 }])
    return p.type === 'dot' ? true : '短笔画没归成 dot'
  })
  console.log('[ok] check-draw --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return process.exitCode || 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/check-draw.mjs')
if (isEntry) {
  process.exitCode = process.argv.includes('--selftest') ? selftest() : run()
}
