# 画甲骨（jiagu-site）

「丢词夺理」生态的**甲骨文分站**（`jiagu.diuci.com`）。内容即游戏——《画甲骨》：看今字，画它的甲骨形（临摹 / 描红 / 自由画三档）
自由练习里保留看甲骨形猜字（四选一）。同一天所有人同一字（每日题），也可按字类自由练习。

## 玩的是什么

- **每日题**：看一张甲骨形图，猜它是哪个现代汉字（四选一）。同一天所有人同一字，
  答完给字源解析。历史冻结：已发出去的日子逐日记下是哪一字，词库勘误后回放改用改过的。
- **自由练习**：按字类筛选，不限次数，连击计分。

## 数据从哪来

内容来自 `chinese-oracle-bone-script`（唯一真源）。本站构建期快照一份：

```bash
node tools/sync-corpus.mjs      # 生成 src/data/corpus.json + src/data/glyphs/
node tools/sync-corpus.mjs --check  # 漂移就失败
```

快照里带 `contentVersion`、来源 `characters.json` 的 sha256、每字的 `era` / `license`——
猜哪一个字，就同时公开凭什么说它可以猜（商代公版 / 当代 CC BY 4.0）。

## 检查

| 命令 | 查什么 |
|---|---|
| `npm run selftest` | 每个工具的坏样本（sync-corpus / check-puzzle / check-legal 各带 --selftest） |
| `npm run check:puzzle` | 全量四选一生成 + 校验 + 最近 30 天每日题回放 + 历史连续性 |
| `npm run check:corpus` | 快照与内容仓是否一致（sha256 漂移、字目漂移） |
| `npm run check:legal` | LICENSE、绝对化表述、联系入口 |
| `npm run build` | Vite 构建 dist |

每个检查都带 `--selftest`：先证明它抓得住坏样本，再看它说「通过」值不值得信。

## 技术栈

- Vue 3 + Vite + TypeScript
- 视觉与主站 / K12 共用一套（宣纸色 `--paper #f4ede0`、朱砂 `--cinnabar #c8442e`）
- 部署：branch 模式（`git push` 即发布，K12 除外），自定义域 `jiagu.diuci.com`

## 许可

- 上游骨架：MIT © Anthony Fu（Vitesse Lite）。
- 本站改动与站点内容：MIT。
- 字库内容：chinese-oracle-bone-script，甲骨卜辞原文公有领域，字源解说 CC BY 4.0。
- 侵权联系：hi@diuci.com。
