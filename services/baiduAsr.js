const axios = require('axios');

let cachedToken = null;
let tokenExpireAt = 0;

// 获取 access_token（百度 OAuth，约 30 天有效，这里缓存到内存）
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireAt) {
    return cachedToken;
  }
  const { BAIDU_API_KEY, BAIDU_SECRET_KEY } = process.env;
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    throw new Error('未配置 BAIDU_API_KEY / BAIDU_SECRET_KEY');
  }
  const resp = await axios.get('https://aip.baidubce.com/oauth/2.0/token', {
    params: {
      grant_type: 'client_credentials',
      client_id: BAIDU_API_KEY,
      client_secret: BAIDU_SECRET_KEY,
    },
  });
  if (!resp.data || !resp.data.access_token) {
    throw new Error('获取百度 access_token 失败: ' + JSON.stringify(resp.data));
  }
  cachedToken = resp.data.access_token;
  // expires_in 单位秒，提前 60s 过期
  tokenExpireAt = now + (resp.data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * 语音转文字
 * @param {Buffer} audioBuffer 音频二进制（wav, 16000Hz, 单声道, 16bit）
 * @param {string} format 音频格式，默认 wav
 * @returns {Promise<string>} 识别文本
 */
async function speechToText(audioBuffer, format = 'wav') {
  const token = await getAccessToken();
  const resp = await axios.post(
    'https://vop.baidu.com/server_api',
    {
      format,
      rate: 16000,
      channel: 1,
      cuid: 'biology-eval-web',
      token,
      dev_pid: 1537, // 普通话（支持简单的英文识别）
      speech: audioBuffer.toString('base64'),
      len: audioBuffer.length,
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const data = resp.data;
  if (data.err_no !== 0) {
    throw new Error(`百度识别失败 err_no=${data.err_no} ${data.err_msg}`);
  }
  return (data.result && data.result[0]) || '';
}

module.exports = { speechToText };
