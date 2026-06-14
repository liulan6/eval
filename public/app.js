const recordBtn = document.getElementById('recordBtn');
const evalBtn = document.getElementById('evalBtn');
const statusEl = document.getElementById('status');
const studentTextEl = document.getElementById('studentText');

let recorder = null;
let isRecording = false;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      recorder = new WavRecorder(16000);
      await recorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹ 停止并转写';
      recordBtn.classList.add('recording');
      statusEl.textContent = '录音中...';
    } catch (err) {
      statusEl.textContent = '无法访问麦克风: ' + err.message;
    }
  } else {
    isRecording = false;
    recordBtn.disabled = true;
    statusEl.textContent = '转写中...';
    const wavBlob = recorder.stop();
    recordBtn.textContent = '🎤 开始录音';
    recordBtn.classList.remove('recording');

    try {
      const audioBase64 = await blobToBase64(wavBlob);
      const resp = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, format: 'wav' }),
      });
      const data = await resp.json();
      if (data.ok) {
        studentTextEl.value = (studentTextEl.value ? studentTextEl.value + ' ' : '') + data.text;
        statusEl.textContent = '转写完成';
      } else {
        statusEl.textContent = '转写失败: ' + data.error;
      }
    } catch (err) {
      statusEl.textContent = '请求失败: ' + err.message;
    } finally {
      recordBtn.disabled = false;
    }
  }
});

evalBtn.addEventListener('click', async () => {
  const studentText = studentTextEl.value.trim();
  if (!studentText) {
    alert('请先录音或填写讲述内容');
    return;
  }
  evalBtn.disabled = true;
  evalBtn.textContent = 'AI 评分中...';
  try {
    const resp = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentText }),
    });
    const data = await resp.json();
    if (data.ok) {
      renderResult(data.result);
    } else {
      alert('评分失败: ' + data.error);
    }
  } catch (err) {
    alert('请求失败: ' + err.message);
  } finally {
    evalBtn.disabled = false;
    evalBtn.textContent = '③ 提交 AI 评分';
  }
});

function renderResult(result) {
  document.getElementById('resultCard').classList.remove('hidden');
  document.getElementById('score').textContent = result.score ?? '--';
  document.getElementById('totalFull').textContent = result.totalFull ?? 10;

  const body = document.getElementById('rubricBody');
  body.innerHTML = '';
  (result.items || []).forEach((it) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="dim-tag">${it.dimension}</span>${it.desc}<div class="reason">${it.reason || ''}</div></td><td class="score-cell">${it.score}/${it.full}</td>`;
    body.appendChild(tr);
  });

  document.getElementById('comment').textContent = result.comment || '';

  const errorsEl = document.getElementById('errors');
  errorsEl.innerHTML = '';
  (result.errors || []).forEach((e) => {
    const li = document.createElement('li');
    li.textContent = e;
    errorsEl.appendChild(li);
  });
  if (!(result.errors || []).length) errorsEl.innerHTML = '<li>无</li>';

  const sugEl = document.getElementById('suggestions');
  sugEl.innerHTML = '';
  (result.suggestions || []).forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    sugEl.appendChild(li);
  });

  document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
}
