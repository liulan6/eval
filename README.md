# 生物视频理解 · 语音讲述评分平台

学生用中文语音讲述对一段英文生物教学视频的理解，系统：
1. 浏览器录音 → 百度语音识别转成文字
2. 转写文字 + 视频英文原文 → DeepSeek 大模型评分点评

## 技术栈
- 后端：Node.js + Express（转发百度 / DeepSeek 请求，隐藏密钥）
- 前端：原生 HTML/JS，浏览器端生成 16k WAV（无需 ffmpeg）

## 运行

```bash
cd biology-speaking-eval
cp .env.example .env   # 填入百度 + DeepSeek 密钥
npm install
npm start
```

打开 http://localhost:3000

> 注意：浏览器麦克风权限需 https 或 localhost 环境。

## 密钥获取
- 百度语音识别：https://console.bce.baidu.com/ → 语音技术 → 创建应用 → API Key / Secret Key
- DeepSeek：https://platform.deepseek.com/ → API Keys

## 接口
| 接口 | 说明 | 入参 |
|------|------|------|
| POST /api/asr | 语音转文字 | `{ audioBase64, format }` |
| POST /api/evaluate | AI 评分 | `{ videoText, studentText }` |
