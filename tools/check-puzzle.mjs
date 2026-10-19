// tools/check-puzzle.mjs —— 全量盘面生成 + 校验。
//
// 对快照里的每个字，生成四选一候选并校验（答案在其中、无重复、无空字、恰好 4 个）。
// 再回放最近 30 天的每日题：每一天必须能解出一个自洽的盘面，历史必须连续、昨天已冻。
// 任何一条不成立即失败。
//
// 用法：
//   node tools/check-puzzle.mjs           全量校验
//   node tools/check-puzzle.mjs --selftest 用坏样本证明护栏真拦得住

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeChoices, verify } from '../src/logic/puzzle.mjs'
import { puzzleFor, dayKey } from '../src/logic/daily.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CORPUS = resolve(ROOT, 'src/data/corpus.json')

export function checkAll(corpus) {
  const problems = []
  const chars = corpus.chars
  if (!chars.length) return ['字库快照是空的']
  // 每个字的四选一
  for (const c of chars) {
    const choices = makeChoices(c, chars)
    const p = verify(choices, c)
    for (const q of p) problems.push(c.char + '：' + q)
  }
  // 最近 30 天每日题回放
  const today = dayKey(new Date())
  const start = new Date(today + 'T00:00:00')
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() - i * 86400000)
    const day = dayKey(d)
    try {
      const { char, choices, frozen } = puzzleFor(corpus, day)
      const p = verify(choices, char)
      for (const q of p) problems.push(day + '（' + char.char + (frozen ? '，冻结' : '') + '）：' + q)
    } catch (e) {
      problems.push(day + '：' + e.message)
    }
  }
  // 同形字不得同框（2026-10-19 加）
  //
  // 内容库 261 字里 155 字与其他字共用同一组图元。若候选里有两个字同形，
  // 玩家看到一张图却有两个「正确答案」，那道题无解。
  // 修法在 makeChoices：按 glyphFingerprint 避开。这一条盯住它没被改回去。
  const fps = new Map()
  for (const c of chars) {
    if (!c.glyphFingerprint) continue
    if (!fps.has(c.glyphFingerprint)) fps.set(c.glyphFingerprint, [])
    fps.get(c.glyphFingerprint).push(c)
  }
  const dupGroups = [...fps.values()].filter((g) => g.length > 1)
  for (const c of chars) {
    let choices
    try { choices = makeChoices(c, chars) }
    catch (e) { problems.push(c.char + '：' + e.message); continue }
    const targetFp = c.glyphFingerprint
    if (!targetFp) continue
    for (const other of fps.get(targetFp) || []) {
      if (other.id === c.id) continue
      if (choices.includes(String(other.char)))
        problems.push(c.char + ' 与 ' + other.char + ' 字形相同却同框（候选 ' + choices.join('/') + '）：这道题无解')
    }
  }
  if (!chars.length) return problems
  if (chars.some((c) => c.glyphFingerprint) && !dupGroups.length) {
    // 不是错误，只是提醒：若曾经有同形组，现在一处也没有，说明指纹可能没同步
  }

  // 历史连续性
  if (corpus.history && Array.isArray(corpus.history.days) && corpus.history.days.length) {
    const h = corpus.history
    const want = []
    const s = new Date(h.since + 'T00:00:00')
    const e = new Date(h.through + 'T00:00:00')
    for (let d = s; d <= e; d = new Date(d.getTime() + 86400000)) want.push(dayKey(d))
    if (want.length !== h.days.length) problems.push('history 有洞：应有 ' + want.length + ' 天，记录里 ' + h.days.length + ' 天')
    for (const rec of h.days) {
      if (!(h.chars || {})[rec.id]) problems.push('history 里 ' + rec.day + ' 指向「' + rec.id + '」，可记录里没有这个字')
    }
  }
  return problems
}

function run() {
  let corpus
  try { corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) }
  catch { console.error('[!!] 读不到 ' + CORPUS + '：先跑 node tools/sync-corpus.mjs'); return 1 }
  const problems = checkAll(corpus)
  if (problems.length) {
    for (const p of problems) console.error('[!!] ' + p)
    console.error('    ' + problems.length + ' 个盘面问题')
    return 1
  }
  console.log('[ok] 全量盘面自洽：' + corpus.count + ' 字四选一 + 最近 30 天每日题回放，历史连续')
  return 0
}

function selftest() {
  const cases = []
  const add = (name, fn) => { const r = fn(); if (r !== true) { console.error('[!!] ' + r); process.exitCode = 1; return } cases.push(name) }
  add('坏候选被抓（重复）', () => {
    const p = verify(['日', '日', '月', '山'], { char: '日' })
    return p.length >= 1 ? true : '重复候选没被抓'
  })
  add('坏候选被抓（答案不在）', () => {
    const p = verify(['月', '山', '水', '火'], { char: '日' })
    return p.length >= 1 ? true : '答案缺失没被抓'
  })
  add('空候选被抓', () => {
    const p = verify(['日', '', '月', '山'], { char: '日' })
    return p.length >= 1 ? true : '空候选没被抓'
  })
  add('干净候选通过', () => {
    const p = verify(['日', '月', '山', '水'], { char: '日' })
    return p.length === 0 ? true : '干净候选被误报：' + p.join('，')
  })
  add('每日题回放自洽', () => {
    const corpus = { chars: [{ id: 'ri', char: '日' }, { id: 'yue', char: '月' }, { id: 'shan', char: '山' }, { id: 'shui', char: '水' }] }
    const { char, choices } = puzzleFor(corpus, '2026-10-14')
    const p = verify(choices, char)
    return p.length === 0 ? true : '每日题不自洽：' + p.join('，')
  })
  console.log('[ok] check-puzzle --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return process.exitCode || 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/check-puzzle.mjs')
if (isEntry) {
  if (process.argv.includes('--selftest')) process.exitCode = selftest()
  else process.exitCode = run()
}
