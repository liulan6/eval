const axios = require('axios');

// ===== 固化：本视频原文 + 评分标准（5 分制）=====
const VIDEO_TEXT = `内分泌腺没有导管，它们分泌的激素进入腺体内的毛细血管，随着循环系统传送到身体各处，直到碰到特定的组织细胞，我们把这些细胞叫做激素的靶细胞，就像一把钥匙只能开一把锁那样，不是该激素的靶细胞不会受到这种激素的影响。`;

const RUBRIC = [
  { key: 'secretion', dimension: '激素的分泌', desc: '能准确说出内分泌腺没有导管，或内分泌腺分泌的激素直接进入血管', full: 1 },
  { key: 'transport', dimension: '激素的传送', desc: '能准确说出激素通过血液循环运输到全身各处', full: 1 },
  { key: 'target_cell', dimension: '激素的作用', desc: '能准确说出激素只作用于相应的靶细胞', full: 2 },
  { key: 'fluency', dimension: '配音效果', desc: '语言表达清晰、通顺，配音与视频画面基本一致', full: 1 },
];

const TOTAL_FULL = RUBRIC.reduce((s, r) => s + r.full, 0); // 5

/**
 * 调用 DeepSeek 按固化 rubric 对学生讲述进行评分
 * @param {string} studentText 学生中文讲述（已转文字）
 * @returns {Promise<object>}
 */
async function evaluate(studentText, provider = 'glm') {
  // 默认走 GLM；provider==='deepseek' 时走 DeepSeek 官网
  let apiKey, baseUrl, model;
  if (provider === 'deepseek') {
    apiKey = process.env.DS_API_KEY || process.env.DEEPSEEK_API_KEY;
    baseUrl = process.env.DS_BASE_URL || 'https://api.deepseek.com';
    model = process.env.DS_MODEL || 'deepseek-chat';
  } else {
    apiKey = process.env.DEEPSEEK_API_KEY;
    baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }
  if (!apiKey) {
    throw new Error('未配置评分模型 API Key');
  }
  const DEEPSEEK_API_KEY = apiKey;

  const rubricLines = RUBRIC.map(
    (r, i) => `${i + 1}. [key=${r.key}] ${r.dimension} | ${r.desc} | 满分 ${r.full}`
  ).join('\n');

  const systemPrompt = `你是一位严谨的初中生物老师，负责按固定评分标准评判学生用中文复述一段生物教学视频的表现。

【视频原文（标准答案依据）】
${VIDEO_TEXT}

【评分标准（总分 ${TOTAL_FULL} 分）】
${rubricLines}

评分要求：
- 逐项打分，每项得分必须是 0 到该项满分之间的整数。
- 严格依据视频原文判断科学内容是否准确，宁严勿松，错误概念不给分。
- 学生讲述是语音转写文字，可能有少量错别字，不因转写噪声扣分。
- 激素的分泌（key=secretion）：学生说出"内分泌腺没有导管"或"激素直接进入血管/血液"任一即给1分，完全没提到给0分。
- 激素的传送（key=transport）：学生说出"激素通过血液循环运输到全身各处"给1分，完全没提到给0分。
- 激素的作用（key=target_cell）：学生准确说出"激素只作用于相应的靶细胞"给2分；只说了"激素作用于靶细胞"但没有强调只作用于特定靶细胞给1分；完全没提到给0分。
- 配音效果（key=fluency）：只判断句子是否通顺，通顺就给1分，不通顺给0分。不需要考虑专业术语是否使用正确。
- score 为各项得分之和。
- 总分 1-5 分分别对应 1-5 星科普配音员。

严格只输出 JSON，不要 markdown 代码块标记，格式：
{
  "score": 数字（总分，0-${TOTAL_FULL}）,
  "stars": 数字（等于 score，1-5 星科普配音员等级）,
  "items": [
    { "key": "对应上面的 key", "score": 该项得分, "full": 该项满分, "reason": "给分/扣分理由" }
  ],
  "comment": "整体点评（中文，用科普配音员等级的口吻，生动有趣）",
  "errors": ["指出科学性错误，没有则空数组"],
  "suggestions": ["改进建议（中文）"]
}`;

  const userPrompt = `【学生中文讲述】\n${studentText}\n\n请按上述评分标准逐项打分。`;

  console.log('[评分] provider=%s, baseUrl=%s, model=%s', provider, baseUrl, model);

  const resp = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const content = resp.data.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const cleaned = content.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  // 补全每项的 dimension/desc，方便前端展示
  const rubricMap = Object.fromEntries(RUBRIC.map((r) => [r.key, r]));
  parsed.items = (parsed.items || []).map((it) => {
    const r = rubricMap[it.key];
    return {
      ...it,
      dimension: r?.dimension || '',
      desc: r?.desc || it.key,
      full: r?.full ?? it.full,
    };
  });
  // 重算总分和星级
  parsed.score = parsed.items.reduce((s, it) => s + (it.score || 0), 0);
  parsed.totalFull = TOTAL_FULL;
  parsed.stars = Math.min(5, parsed.score);
  return parsed;
}

module.exports = { evaluate, VIDEO_TEXT, RUBRIC, TOTAL_FULL };
