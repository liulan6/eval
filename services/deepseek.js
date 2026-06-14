const axios = require('axios');

/**
 * 调用 DeepSeek 对学生讲述进行评分
 * @param {string} videoText 视频英文原文描述
 * @param {string} studentText 学生中文讲述（已转文字）
 * @returns {Promise<object>} { score, dimensions, comment, suggestions }
 */
async function evaluate(videoText, studentText) {
  const { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } = process.env;
  if (!DEEPSEEK_API_KEY) {
    throw new Error('未配置 DEEPSEEK_API_KEY');
  }

  const systemPrompt = `你是一位严谨的生物学科老师，负责评判学生用中文复述/理解一段英文生物教学视频的表现。
请从以下维度评分（每项 0-100），并给出总分（0-100，为各维度加权）：
1. 理解准确度（accuracy）：学生对视频内容的理解是否正确，有无科学性错误
2. 关键概念覆盖（coverage）：是否覆盖视频中的核心生物学概念与术语
3. 完整度（completeness）：复述是否完整，逻辑是否连贯
4. 表达清晰度（clarity）：语言组织是否清晰

严格只输出 JSON，不要包含 markdown 代码块标记，格式如下：
{
  "score": 数字,
  "dimensions": {
    "accuracy": 数字,
    "coverage": 数字,
    "completeness": 数字,
    "clarity": 数字
  },
  "comment": "整体点评（中文）",
  "errors": ["指出学生理解中的科学性错误，没有则为空数组"],
  "suggestions": ["改进建议（中文）"]
}`;

  const userPrompt = `【视频英文原文描述】
${videoText}

【学生中文讲述】
${studentText}

请根据上述内容评分。`;

  const resp = await axios.post(
    `${DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`,
    {
      model: DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
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
  try {
    return JSON.parse(content);
  } catch (e) {
    // 兜底：去掉可能的代码块标记再解析
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

module.exports = { evaluate };
