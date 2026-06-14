#!/usr/bin/env python3
"""
Whisper 语音识别服务脚本
接收音频文件路径作为参数，输出识别文本到 stdout
"""
import sys
import json
from faster_whisper import WhisperModel

# 首次加载会下载模型（~150MB），后续从缓存读取
model = None

def get_model():
    global model
    if model is None:
        model = WhisperModel("base", device="cpu", compute_type="int8")
    return model

def transcribe(audio_path):
    m = get_model()
    segments, info = m.transcribe(audio_path, language="zh", beam_size=5)
    text = "".join([segment.text for segment in segments])
    return text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: whisper_asr.py <audio_file_path>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    try:
        text = transcribe(audio_path)
        print(json.dumps({"text": text}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
