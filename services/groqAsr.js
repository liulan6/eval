const axios = require('axios');
const FormData = require('form-data');

/**
 * 语音转文字（Groq 免费 Whisper API）
 * @param {Buffer} audioBuffer 音频二进制
 * @param {string} format 音频格式，默认 wav
 * @returns {Promise<string>} 识别文本
 */
async function speechToText(audioBuffer, format = 'wav') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 GROQ_API_KEY');
  }

  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: `audio.${format}`,
    contentType: `audio/${format}`,
  });
  form.append('model', 'whisper-large-v3');
  form.append('language', 'zh');

  const resp = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  return resp.data.text || '';
}

module.exports = { speechToText };
