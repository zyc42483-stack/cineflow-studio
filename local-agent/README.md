# CineFlow 本地创作智能体

一条命令，从创意主题到成片 MP4：分镜脚本（LLM）→ 分镜画面 → 视频片段（可借鉴参考视频）→ 旁白配音 + 配乐 → 转场拼接合成。

## 环境要求

- Node.js >= 18

## 安装

```bash
cd local-agent
pnpm install   # 或 npm install
```

## 配置密钥（二选一）

方式一：环境变量

```bash
export COZE_WORKLOAD_IDENTITY_API_KEY="你的 API Key"
export COZE_INTEGRATION_MODEL_BASE_URL="https://your-model-base-url"
export COZE_INTEGRATION_AUTHENTICATION_TOKENIZATION_ENDPOINT="https://your-auth-endpoint"  # 如平台要求
```

方式二：在 `~/.coze/ccdk/coze-coding.json` 保存配置后运行 `coze-coding-dev-sdk auth` 生成缓存。

## 使用

```bash
# 最简：一个主题直接出片
node agent.mjs "一只猫在深夜的城市天台找回家的路"

# 完整参数
node agent.mjs "敦煌飞天的千年一梦" \
  --scenes 4 \
  --style 国风水墨 \
  --ratio 16:9 \
  --voice zh_female_mizai_saturn_bigtts \
  --ref https://example.com/参考视频.mp4 \
  --out ./output
```

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `--scenes` | 分镜数量 | 4 |
| `--style` | 画面风格（电影感写实/国风水墨/赛博朋克…） | 电影感写实 |
| `--ratio` | 画幅 `16:9` 或 `9:16` | 16:9 |
| `--voice` | TTS 音色 ID | zh_male_dayi_saturn_bigtts（大叔解说） |
| `--ref` | 参考视频 URL，学习其运镜/节奏/风格 | 无 |
| `--out` | 输出目录 | ./output |

常用音色：`zh_male_dayi_saturn_bigtts` 大叔解说、`zh_female_mizai_saturn_bigtts` 米仔、
`zh_female_jitangnv_saturn_bigtts` 励志女声、`zh_male_ruyayichen_saturn_bigtts` 儒雅男声、
`zh_female_xiaohe_uranus_bigtts` 小何、`zh_male_m191_uranus_bigtts` 云舟。

## 产物

- `output/final.mp4` — 成片（含转场、旁白、配乐）
- `output/script.json` — 分镜脚本，可留档复用

## 注意

- 视频生成单段约 5-10 分钟，4 镜成片总耗时约 20-40 分钟，请耐心等待；终端会实时打印每个步骤进度。
- 脚本流式打印的 JSON 会自动解析，若 LLM 偶发输出非 JSON 会报错退出，重跑一次即可。
