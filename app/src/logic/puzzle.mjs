// 《甲骨猜字》玩法规则：四选一生成与校验。客户端与 tools/check-puzzle.mjs 共用这一份。
//
// 规则：给一个字（今字），生成四个候选（含正确今字 + 三个干扰字）。
// 干扰字从词库里取，不与答案重复、不为空、互不相同。
//
// **干扰字怎么挑**（2026-10-19 重写，原来只有一个「按 id 排序取前三个」）：
//
// 原实现的毛病不是「顺序不对」，是**选字标准错了**。id 字典序取前三个，恒定是
// 「㐭 㛸 㜽」—— 三个扩展区生僻字，孩子根本认不出，无法用排除法缩小范围。
// 内容库里 58 个扩展A 区字（a1~a58）id 全排在最前，所以这个毛病是系统性的。
//
// 现在按三条排：
//   1. **不同形** —— 指纹相同的一律排除。两个字长得一样却同框，那道题无解。
//   2. **形近优先** —— 笔画数相同、字类相同的最有迷惑性，孩子只能靠字形判断。
//   3. **常见优先** —— 同等条件下取基本区字；扩展区字（生僻）排到最后兜底。
//
// 数据来自内容仓：glyph_fingerprint（tools/build-fingerprints.py，从图元算）
// 与 stroke_count（tools/build-strokes.py，从 Unihan kTotalStrokes 取）。
// 两者都是数据驱动 —— 将来给那些共用字形的字补上真实字形，指纹自动分开。
// 没有这些字段的老快照退回「按 id 排序」，行为与从前一致，不假装更聪明。
import { rankDistractors } from './distractor.mjs'

/**
 * 为目标字生成四个候选。
 * @param target 目标字 {id, char, glyphFingerprint?, strokeCount?, type?, ...}
 * @param chars 全词库（顺序稳定）
 * @returns 四个字的数组（含 target），顺序固定（target 在前，便于确定性回放）
 */
export function makeChoices(target, chars) {
  if (!target || !target.char) throw new Error('目标字缺失')
  const targetChar = String(target.char)

  const pool = chars.filter((c) => c && c.char && String(c.char) !== targetChar)
  const ranked = rankDistractors(target, pool)
  const distractors = ranked.slice(0, 3)
  if (distractors.length < 3) {
    throw new Error('排除同形之后候选不够三个：词库里与「' + targetChar + '」不同形的字不足 3 个')
  }
  const choices = [targetChar]
  for (const d of distractors) choices.push(String(d.char))
  return choices
}

/** 校验一个候选组：恰好 4 个、答案在其中、无重复、无空字。 */
export function verify(choices, target) {
  const problems = []
  if (!Array.isArray(choices) || choices.length !== 4) {
    problems.push('候选必须恰好 4 个，实 ' + (Array.isArray(choices) ? choices.length : 0))
    return problems
  }
  const targetChar = String(target.char)
  if (!choices.includes(targetChar)) problems.push('正确答案「' + targetChar + '」不在候选里')
  const seen = new Set()
  for (const c of choices) {
    const s = String(c).trim()
    if (!s) { problems.push('候选有空字'); break }
    if (s.length !== 1) problems.push('候选非单字：' + s)
    if (seen.has(s)) problems.push('候选重复：' + s)
    seen.add(s)
  }
  return problems
}

/** 判断玩家答案是否正确。 */
export function isCorrect(choice, target) {
  return String(choice).trim() === String(target.char)
}
