// tools/check-ui.mjs —— 本站 UI 闸门（轻量版）。
//
// 连句站那套 8 条规则绑死了「六乐园 + 繁简钮 + 明暗钮」的生态导航，本站是纯游戏站，
// 没有那套。这里只守两条最硬的：
//   R1 设计令牌必须与主站逐值一致（改令牌该改主站，不该在分站悄悄改）。
//   R2 本站 CSS 不得把令牌色值抄成字面量——该用 var() 指过来。
// 每条在 --selftest 里都有坏例子。
//
// 用法：node tools/check-ui.mjs / --selftest

import fs from 'node:fs'
import path from 'node:path'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const STYLES = resolve(ROOT, 'src/styles/main.css')

// 与主站逐值一致
const TOKENS = {
  '--paper': '#f4ede0',
  '--ink': '#241f1a',
  '--cinnabar': '#c8442e',
  '--line': '#d8cbb4',
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function parseRoot(css) {
  const lines = css.split('\n')
  let hit = ''
  for (const line of lines) if (line.trimStart().startsWith(':root')) { hit = line; break }
  if (!hit) return null
  const openAt = css.indexOf('{', css.indexOf(hit))
  const closeAt = css.indexOf('}', openAt)
  if (openAt < 0 || closeAt < 0) return null
  const body = css.slice(openAt + 1, closeAt)
  const out = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** R1：本站 :root 里的令牌必须与主站逐值一致。 */
export function tokenProblems(css) {
  const problems = []
  const light = parseRoot(css)
  if (!light) return ['找不到 :root 块']
  for (const [k, v] of Object.entries(TOKENS)) {
    if (light[k] !== v) problems.push('令牌 ' + k + ' 是 ' + light[k] + '，应为 ' + v)
  }
  return problems
}

/** R2：CSS 里（:root 之外）不得出现令牌色值的字面量（该用 var()）。 */
export function literalProblems(css) {
  // 先剥掉 :root 块——那是令牌的定义处，字面量在那里是合法的；只查其它规则里的硬编码
  const lines = css.split('\n')
  let inRoot = false, depth = 0
  const keep = []
  for (const line of lines) {
    if (!inRoot && line.trimStart().startsWith(':root')) { inRoot = true; depth = (line.match(/{/g) || []).length; continue }
    if (inRoot) { depth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length; if (depth <= 0) inRoot = false; continue }
    keep.push(line)
  }
  const flat = stripComments(keep.join('\n')).replace(/\s+/g, '').toLowerCase()
  const problems = []
  for (const v of Object.values(TOKENS)) {
    const hex = v.match(/#[0-9a-f]{6}/)
    if (hex && flat.includes(hex[0])) problems.push('CSS 里写死了色值 ' + hex[0] + '：该用 var() 指过来')
  }
  return problems
}

function check() {
  const problems = []
  let css
  try { css = fs.readFileSync(STYLES, 'utf8') }
  catch { return ['读不到 src/styles/main.css'] }
  for (const p of tokenProblems(css)) problems.push('R1 ' + p)
  for (const p of literalProblems(css)) problems.push('R2 ' + p)
  return problems
}

function selftest() {
  const cases = []
  // R1 坏例子：改了一个令牌
  if (!tokenProblems(':root{--paper:#fff;--ink:#241f1a;--cinnabar:#c8442e;--line:#d8cbb4}').length) {
    console.error('[!!] R1 坏样本没被抓'); return 1
  }
  cases.push('R1 改令牌被抓')
  // R1 干净样本不误报
  const good = ':root{' + Object.entries(TOKENS).map(([k, v]) => k + ':' + v + ';').join('') + '}'
  if (tokenProblems(good).length) { console.error('[!!] R1 干净样本被误报'); return 1 }
  cases.push('R1 干净不误报')
  // R2 坏例子：把 --cinnabar 抄成字面量
  if (!literalProblems('.x{color:#c8442e}').length) { console.error('[!!] R2 坏样本没被抓'); return 1 }
  cases.push('R2 字面量被抓')
  // R2 干净样本（用 var()）不误报
  if (literalProblems('.x{color:var(--cinnabar)}').length) { console.error('[!!] R2 干净样本被误报'); return 1 }
  cases.push('R2 干净不误报')
  console.log('[ok] check-ui --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/check-ui.mjs')
if (isEntry) {
  if (process.argv.includes('--selftest')) process.exitCode = selftest()
  else {
    const problems = check()
    if (problems.length) { for (const p of problems) console.error('[!!] ' + p); process.exitCode = 1 }
    else console.log('[ok] check-ui 通（令牌与主站一致，无字面量色值）')
  }
}
