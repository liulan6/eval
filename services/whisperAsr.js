const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WHISPER_SCRIPT = path.join(__dirname, 'whisper_asr.py');

/**
 * 语音转文字（基于本地 faster-whisper，无需 API Key）
 * @param {Buffer} audioBuffer 音频二进制（wav, 16000Hz, 单声道, 16bit）
 * @param {string} format 音频格式，默认 wav
 * @returns {Promise<string>} 识别文本
 */
async function speechToText(audioBuffer, format = 'wav') {
  // 写临时文件供 Python 读取
  const tmpFile = path.join(os.tmpdir(), `whisper_${Date.now()}.${format}`);
  fs.writeFileSync(tmpFile, audioBuffer);

  try {
    const result = await new Promise((resolve, reject) => {
      execFile('python3', [WHISPER_SCRIPT, tmpFile], {
        timeout: 60000, // 60s 超时
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Whisper 执行失败: ${stderr || error.message}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.error) {
            reject(new Error(parsed.error));
          } else {
            resolve(parsed.text || '');
          }
        } catch (e) {
          reject(new Error(`Whisper 输出解析失败: ${stdout}`));
        }
      });
    });
    return result;
  } finally {
    // 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

module.exports = { speechToText };
