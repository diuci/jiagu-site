// 每日题的选字与种子。客户端与 tools/ 共用这一份。
//
// 机械件（dayKey/parseDayKey/djb2/mulberry32/冻结回放）已收进统一核心
// core/daily.mjs（PLAN-全站统一-v2）——这里只留**本站的选题策略**：
// 按字类轮转（拍板 2026-10-19，PLAN-画甲骨文 §3.4 方案 B）：六字类按天序号
// 轮转，类内再用日期种子取字，约 44 天覆盖全库；纯随机会让某几类（如抽象
// 151 字）长期霸榜、动植物长期缺席。
//
// 已经发出去的日子记在 corpus.json 的 history 里，回放一律按那份记录走
// （core 的 frozenFor 铁律：记录钉了 id 就按记录走，词库怎么变都不换题）。

import {
  dayKey,
  parseDayKey,
  djb2,
  mulberry32,
  DAY_MS,
  pickFromPool,
  frozenFor as coreFrozenFor,
} from '../../../core/daily.mjs'
import { makeChoices, verify } from './puzzle.mjs'

// 机械件原样再导出：tools/（check-draw/check-puzzle/smoke/sync-corpus）与
// draw.mjs 都从这里拿——站内导入路径不变，core 是唯一实现。
export { dayKey, parseDayKey, djb2, mulberry32, DAY_MS }

// 与内容仓 validate.py 的字类合法集同源同序（改那边必须同步这边）
export const CANON_TYPES = ['自然现象', '动植物', '人体动作', '器物', '数目', '抽象']

/** 当天玩哪个字：字类轮转 + 类内日期种子（salt 用本站名——不与别站同题）。 */
export function pickDaily(chars, day) {
  if (!chars.length) throw new Error('字库快照是空的')
  const have = [...new Set(chars.map((c) => c.type))]
  const types = CANON_TYPES.filter((t) => have.includes(t))
  const dayIdx = Math.floor(Date.parse(day + 'T00:00:00') / DAY_MS)
  const type = types[dayIdx % types.length]
  const pool = chars.filter((c) => c.type === type)
  const char = pickFromPool(pool, day, 'jiagu-daily')
  return { char, type, day }
}

/** 这一天冻在记录里吗？（core 机械件 + 本站词库查找） */
export function frozenFor(corpus, day) {
  return coreFrozenFor(
    Array.isArray(corpus) ? null : corpus.history,
    day,
    (id) => {
      const chars = Array.isArray(corpus) ? corpus : corpus.chars
      return chars.find((c) => c.id === id)
    },
  )
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
