// 浏览器端录音 → 输出 16000Hz / 单声道 / 16bit WAV（百度 ASR 要求）
class WavRecorder {
  constructor(targetSampleRate = 16000, dropMs = 0) {
    this.targetSampleRate = targetSampleRate;
    this.dropMs = dropMs; // 丢弃开头毫秒数（规避 AGC 未收敛的坏数据）
    this.buffers = [];
    this.recording = false;
  }

  async start(existingStream = null) {
    if (existingStream) {
      this.stream = existingStream;
      this.ownStream = false;
    } else {
      // 移动端：关闭 AEC/降噪/AGC，避免视频音频（即使 muted）与 mic 交互导致输入被压掉
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.ownStream = true;
    }
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // 手百/iOS 首次 AudioContext 会是 suspended，必须 resume 否则 onaudioprocess 不跑、录出全静音
    if (this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume(); } catch (e) { console.warn('AudioContext resume 失败:', e); }
    }
    this.inputSampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    // 静音 gain：让 processor 有下游触发 onaudioprocess，但不把 mic 声音真的送回扬声器
    // 若直接 connect(destination)，mic → speaker 回路会触发浏览器 AEC，把 mic 输入整个抑制掉（手机浏览器尤其明显）
    this.mute = this.audioContext.createGain();
    this.mute.gain.value = 0;

    this.buffers = [];
    this.skipLeftMs = this.dropMs;
    this.recording = true;

    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const channel = e.inputBuffer.getChannelData(0);
      // 开头 dropMs 内的数据直接丢弃（AGC/降噪未收敛，会识别成"嗯"）
      if (this.skipLeftMs > 0) {
        this.skipLeftMs -= (channel.length / this.inputSampleRate) * 1000;
        return;
      }
      this.buffers.push(new Float32Array(channel));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.audioContext.destination);
  }

  stop() {
    this.recording = false;
    if (this.processor) this.processor.disconnect();
    if (this.mute) this.mute.disconnect();
    if (this.source) this.source.disconnect();
    if (this.stream && this.ownStream) this.stream.getTracks().forEach((t) => t.stop());

    const merged = this._mergeBuffers(this.buffers);
    const downsampled = this._downsample(merged, this.inputSampleRate, this.targetSampleRate);
    const wavBuffer = this._encodeWav(downsampled, this.targetSampleRate);
    if (this.audioContext) this.audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  _mergeBuffers(buffers) {
    let length = 0;
    buffers.forEach((b) => (length += b.length));
    const result = new Float32Array(length);
    let offset = 0;
    buffers.forEach((b) => {
      result.set(b, offset);
      offset += b.length;
    });
    return result;
  }

  _downsample(buffer, inRate, outRate) {
    if (outRate === inRate) return buffer;
    const ratio = inRate / outRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < newLength) {
      const nextOffset = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffset && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffset;
    }
    return result;
  }

  _encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }
}
