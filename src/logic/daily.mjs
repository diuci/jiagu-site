// 每日题的选字与种子。客户端与 tools/ 共用这一份。
//
// 规则：同一天永远同一个字；日期可回放（?d=YYYY-MM-DD）。
// 选字不排难度、不排重：种子由日期决定，人不能挑，挑了就不是「今天这一字」。
//
// 选字策略（拍板 2026-10-19，PLAN-画甲骨文 §3.4 方案 B）：按**字类轮转**——
// 六字类按天序号轮转，类内再用日期种子取字，约 44 天覆盖全库；
// 纯随机会让某几类（如抽象 151 字）长期霸榜、动植物长期缺席。
// 字类顺序 = 内容仓的合法集顺序，跨端一致。
//
// 已经发出去的日子记在 corpus.json 的 history 里，回放一律按那份记录走。
// 为什么必须记下来：选字是「日期 → 词库里的第几个字」，词库一变（内容仓补了字、
// 改了顺序），同一天的题就跟着变。玩家上周猜过的那一字，这周回放变成另一字，
// 那不叫回放，那叫换题。所以过去的日子钉死在记录里，只有还没玩过的日子跟着词库走。
//
// 种子用自包含的确定性哈希（djb2 → mulberry32），不引 seedrandom 依赖。

import { makeChoices, verify } from './puzzle.mjs'

export const DAY_MS = 86400000

// 与内容仓 validate.py 的字类合法集同源同序（改那边必须同步这边）
export const CANON_TYPES = ['自然现象', '动植物', '人体动作', '器物', '数目', '抽象']

/** 本地日期 → YYYY-MM-DD。用本地时区：「今天这一字」按玩家所在的日子算。 */
export function dayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

export function parseDayKey(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null
  const dt = new Date(y, mo - 1, day)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return null
  return dt
}

/** djb2 字符串哈希 → 32 位无符号整数。确定性、跨语言可复现。 */
export function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  }
  return h
}

/** mulberry32：由 32 位种子生成确定性伪随机序列。 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 当天玩哪个字：字类轮转 + 类内日期种子。chars 顺序必须稳定（按 type/difficulty/id 排序）。 */
export function pickDaily(chars, day) {
  if (!chars.length) throw new Error('字库快照是空的')
  const have = [...new Set(chars.map((c) => c.type))]
  const types = CANON_TYPES.filter((t) => have.includes(t))
  const dayIdx = Math.floor(Date.parse(day + 'T00:00:00') / DAY_MS)
  const type = types[dayIdx % types.length]
  const pool = chars.filter((c) => c.type === type)
  const rng = mulberry32(djb2('jiagu-daily:' + day))
  const idx = Math.floor(rng() * pool.length)
  return { char: pool[idx], type, day }
}

/** 这一天冻在记录里吗？冻着就必须按记录的那一字出，不许重新摇。 */
export function frozenFor(corpus, day) {
  const h = corpus && !Array.isArray(corpus) ? corpus.history : null
  if (!h || !Array.isArray(h.days)) return null
  const hit = h.days.find((x) => x.day === day)
  if (!hit) return null
  const ch = (h.chars || {})[hit.id]
  if (!ch) throw new Error(day + ' 冻在记录里，指向「' + hit.id + '」，可记录里没有这个字')
  return { char: ch, frozen: true }
}

/** 一个可玩的题面：选字 + 生成四选一 + 自检。CI 与客户端走同一条路。 */
export function puzzleFor(corpus, day) {
  const chars = Array.isArray(corpus) ? corpus : corpus.chars
  if (!chars.length) throw new Error('字库快照是空的')
  const frozen = frozenFor(corpus, day)
  const picked = frozen || pickDaily(chars, day)
  const choices = makeChoices(picked.char, chars)
  const problems = verify(choices, picked.char)
  if (problems.length) throw new Error('盘面不自洽：' + picked.char.char + ' —— ' + problems[0])
  return { char: picked.char, choices, frozen: !!frozen }
}
