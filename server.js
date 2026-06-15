require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { speechToText } = require('./services/siliconflowAsr');
const { evaluate } = require('./services/deepseek');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // 音频 base64 体积较大
app.use(express.static(path.join(__dirname, 'public')));

// 1. 语音转文字：前端传 wav(16k/mono/16bit) 的 base64
app.post('/api/asr', async (req, res) => {
  try {
    const { audioBase64, format } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ ok: false, error: '缺少 audioBase64' });
    }
    const buffer = Buffer.from(audioBase64, 'base64');
    const text = await speechToText(buffer, format || 'wav');
    res.json({ ok: true, text });
  } catch (err) {
    console.error('ASR error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. AI 评分：视频原文与评分标准已固化在后端，只需传学生讲述文字
app.post('/api/evaluate', async (req, res) => {
  try {
    const { studentText, provider } = req.body;
    if (!studentText) {
      return res.status(400).json({ ok: false, error: '缺少 studentText' });
    }
    const result = await evaluate(studentText, provider === 'deepseek' ? 'deepseek' : 'glm');
    res.json({ ok: true, result });
  } catch (err) {
    console.error('Evaluate error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
});
