const axios = require('axios');

/**
 * 语音转文字（阿里云 DashScope Qwen3-ASR-Flash）
 * 走 multimodal-generation 端点，直接吃 base64 data URI，无需 OSS 上传。
 * @param {Buffer} audioBuffer 音频二进制
 * @param {string} format 音频格式，默认 wav
 * @returns {Promise<string>} 识别文本
 */
async function speechToText(audioBuffer, format = 'wav') {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY');
  }

  const mime = format === 'wav' ? 'audio/wav' : `audio/${format}`;
  const dataUri = `data:${mime};base64,${audioBuffer.toString('base64')}`;

  const resp = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      model: 'qwen3-asr-flash',
      input: {
        messages: [
          {
            role: 'user',
            content: [{ audio: dataUri }],
          },
        ],
      },
      parameters: {
        asr_options: {
          language: 'zh',
          enable_lid: false,
          enable_itn: true,
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  console.log('DashScope ASR response:', JSON.stringify(resp.data));

  // 兼容多种返回结构：output.text / output.choices[0].message.content(数组或字符串)
  const output = resp.data?.output;
  if (!output) return '';
  if (typeof output.text === 'string') return output.text.trim();

  const choice = output.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((c) => (typeof c === 'string' ? c : c?.text || ''))
      .filter(Boolean);
    return parts.join('').trim();
  }
  return '';
}

module.exports = { speechToText };
