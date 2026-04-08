(async function(){
  // Proctor injection for Code Studio: preview + auto-submit on server 'auto_submit' event
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || localStorage.getItem('token');
  let sessionId = params.get('sessionId') || params.get('session') || params.get('sessionid');
  let assignmentId = params.get('assignmentId') || params.get('assignment');
  const backend = `${location.protocol}//${location.hostname}:9696`;

  // require token; if sessionId missing attempt to create a server session using assignmentId
  if (!token) {
    console.info('proctor-inject: token not found in URL/localStorage, proctor inactive');
    return;
  }

  if (!sessionId && assignmentId) {
    try {
      const res = await fetch(backend + '/api/proctor/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authentication': `Bearer ${token}` },
        body: JSON.stringify({ assignmentId })
      });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        const sess = j?.data || j;
        sessionId = sess?.sessionId || sess?.sessionId || sessionId;
        console.info('proctor-inject: created session', sessionId);
      } else {
        console.warn('proctor-inject: failed to create session', res.status);
      }
    } catch (err) {
      console.error('proctor-inject: error creating session', err);
    }
  }

  if (!sessionId) {
    console.info('proctor-inject: sessionId not found and could not be created, proctor inactive');
    return;
  }

  // create preview element
  const video = document.createElement('video');
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.style.position = 'fixed';
  video.style.top = '8px';
  video.style.right = '8px';
  video.style.width = '220px';
  video.style.height = '160px';
  video.style.zIndex = 99999;
  video.style.border = '2px solid rgba(255,255,255,0.9)';
  video.style.borderRadius = '6px';
  video.id = 'proctor-preview';
  document.body.appendChild(video);

  // tiny status badge
  const badge = document.createElement('div');
  badge.style.position = 'fixed';
  badge.style.top = '8px';
  badge.style.right = '240px';
  badge.style.zIndex = 99999;
  badge.style.padding = '6px 8px';
  badge.style.background = 'rgba(0,0,0,0.6)';
  badge.style.color = '#fff';
  badge.style.borderRadius = '6px';
  badge.style.fontSize = '12px';
  badge.id = 'proctor-badge';
  badge.textContent = 'Proctor: connecting...';
  document.body.appendChild(badge);

  // detectors status (face/audio)
  const detectorStatus = document.createElement('div');
  detectorStatus.style.position = 'fixed';
  detectorStatus.style.top = '36px';
  detectorStatus.style.right = '240px';
  detectorStatus.style.zIndex = 99999;
  detectorStatus.style.padding = '4px 8px';
  detectorStatus.style.background = 'rgba(0,0,0,0.45)';
  detectorStatus.style.color = '#fff';
  detectorStatus.style.borderRadius = '6px';
  detectorStatus.style.fontSize = '11px';
  detectorStatus.id = 'proctor-detectors';
  detectorStatus.textContent = 'Face: init • Audio: init';
  document.body.appendChild(detectorStatus);

  // overlay for violations / hints
  const overlay = document.createElement('div');
  overlay.id = 'proctor-overlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '8px';
  overlay.style.bottom = '8px';
  overlay.style.zIndex = 100000;
  overlay.style.minWidth = '220px';
  overlay.style.maxWidth = '420px';
  overlay.style.background = 'rgba(0,0,0,0.65)';
  overlay.style.color = '#fff';
  overlay.style.borderRadius = '8px';
  overlay.style.padding = '10px';
  overlay.style.fontSize = '13px';
  overlay.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'auto';
  document.body.appendChild(overlay);

  function updateViolationOverlay(p){
    if(!p) return;
    const count = p.violationCount || 0;
    const last = p.lastViolation || {};
    let html = `<div style="font-weight:700;margin-bottom:6px">Violations: ${count}</div>`;
    html += `<div style="font-size:12px;opacity:0.95;margin-bottom:6px">Last: ${last.type || '-'}${last.timestamp ? ' • ' + new Date(last.timestamp).toLocaleTimeString() : ''}</div>`;
    if(p.violationCounts){
      html += '<div style="font-size:12px;opacity:0.85;margin-top:6px">Breakdown:';
      try{ for(const k of Object.keys(p.violationCounts)){ html += `<div style="display:flex;justify-content:space-between;margin-top:4px"><span>${k}</span><strong>${p.violationCounts[k]}</strong></div>`; } }catch(e){}
      html += '</div>';
    }
    overlay.innerHTML = html;
    overlay.style.display = 'block';
    overlay.style.border = count >= 3 ? '2px solid rgba(255,80,80,0.95)' : '1px solid rgba(255,255,255,0.06)';
    try{ overlay.animate([{ transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 200 }); }catch(e){}
  }

  function showTerminationModal(p){
    const reason = (p && (p.reason || p.message)) || 'No reason provided';
    badge.textContent = 'Exam terminated';
    badge.style.background = 'tomato';

    // disable editor if possible
    try{
      if(window.editor && typeof window.editor.setReadOnly === 'function'){
        window.editor.setReadOnly(true);
      }
      // disable common submit button
      const sb = document.getElementById('submitBtn'); if(sb) sb.disabled = true;
      // disable textareas
      document.querySelectorAll('textarea,input[type=text]').forEach(el=>el.disabled = true);
      // disable contenteditable
      document.querySelectorAll('[contenteditable="true"]').forEach(el=>el.setAttribute('contenteditable','false'));
    }catch(e){ console.warn('proctor-inject: disable editor failed', e); }

    // create modal
    let modal = document.getElementById('proctor-termination-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'proctor-termination-modal';
      modal.style.position = 'fixed';
      modal.style.left = '0'; modal.style.top = '0'; modal.style.right = '0'; modal.style.bottom = '0';
      modal.style.zIndex = 200000; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
      modal.style.background = 'rgba(0,0,0,0.7)';
      const box = document.createElement('div');
      box.style.background = '#fff'; box.style.color = '#111'; box.style.padding = '24px'; box.style.borderRadius = '10px'; box.style.maxWidth = '720px'; box.style.width='90%';
      box.innerHTML = `<h2 style="margin:0 0 8px 0">Exam Terminated</h2><p id="proctor-term-reason" style="margin:0 0 12px 0">${reason}</p>`;
      const ok = document.createElement('button'); ok.textContent = 'Acknowledge'; ok.style.padding='8px 12px'; ok.style.border='none'; ok.style.background='#0078d4'; ok.style.color='#fff'; ok.style.borderRadius='6px';
      ok.onclick = ()=>{ try{ modal.remove(); }catch(e){} };
      box.appendChild(ok);
      modal.appendChild(box);
      document.body.appendChild(modal);
    } else {
      const reasonEl = document.getElementById('proctor-term-reason'); if(reasonEl) reasonEl.textContent = reason; modal.style.display = 'flex';
    }
  }

  // show a short toast with violation type/message
  function showViolationToast(type, message){
    try{
      let toast = document.getElementById('proctor-violation-toast');
      if(!toast){
        toast = document.createElement('div');
        toast.id = 'proctor-violation-toast';
        toast.style.position = 'fixed';
        toast.style.top = '8px';
        toast.style.left = '8px';
        toast.style.zIndex = 200001;
        toast.style.background = 'rgba(220,30,30,0.95)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 12px';
        toast.style.borderRadius = '6px';
        toast.style.fontWeight = '700';
        document.body.appendChild(toast);
      }
      toast.textContent = type + (message ? ': ' + message : '');
      toast.style.display = 'block';
      clearTimeout(toast._hideTimeout);
      toast._hideTimeout = setTimeout(()=>{ try{ toast.style.display = 'none'; }catch(e){} }, 5000);
    }catch(e){ console.warn('proctor-inject: showViolationToast failed', e); }
  }

  // try multiple backends (fallbacks) for socket + fetch
  const backends = [backend, location.origin, `${location.protocol}//${location.hostname}:3000`].filter(Boolean);

  // helper to try connecting sockets sequentially
  async function connectWithFallback(urls){
    for(const u of urls){
      console.debug('proctor-inject: attempting socket connect to', u.replace(/:\d+$/, ':(port)'));
      try{
        const s = await attemptSocket(u);
        console.info('proctor-inject: socket connected to', u);
        return s;
      }catch(err){
        console.warn('proctor-inject: socket connect failed for', u, err && err.message ? err.message : err);
      }
    }
    throw new Error('All socket connection attempts failed');
  }

  function attemptSocket(url){
    return new Promise((resolve, reject)=>{
      const s = io(url, { auth: { token: `Bearer ${token}` }, transports: ['websocket'], reconnection: false, reconnectionAttempts: 0 });
      let settled = false;
      const to = setTimeout(()=>{
        if(!settled){
          settled = true;
          try{ s.disconnect(); }catch(e){}
          reject(new Error('connect timeout'));
        }
      }, 4000);

      s.on('connect', ()=>{ if(settled) return; settled = true; clearTimeout(to); resolve(s); });
      s.on('connect_error', (err)=>{ if(settled) return; settled = true; clearTimeout(to); try{ s.disconnect(); }catch(e){}; reject(err||new Error('connect_error')) });
      s.on('error', (err)=>{ if(settled) return; settled = true; clearTimeout(to); try{ s.disconnect(); }catch(e){}; reject(err||new Error('socket_error')) });
    });
  }

  let socket;
  try{
    socket = await connectWithFallback(backends);
  }catch(err){
    console.error('proctor-inject: all socket backends failed', err);
    badge.textContent = 'Proctor: connection failed';
    return;
  }

  socket.on('connect', () => { badge.textContent = 'Proctor: connected'; socket.emit('join_exam', { sessionId }); });
  socket.on('joined_exam', (d) => { console.debug('proctor-inject joined', d); });
  socket.on('violation_update', (p) => {
    const last = p.lastViolation || {};
    badge.textContent = `Violations: ${p.violationCount || 0} • last: ${last.type||'-'}`;
    try{ updateViolationOverlay(p); }catch(e){}
    try{ badge.animate([{ transform: 'translateY(-2px)' },{ transform: 'translateY(0)' }], { duration: 180 }); }catch(e){}
    try{ if(last && last.type) showViolationToast(last.type, last.confidence ? `confidence ${last.confidence}` : undefined); }catch(e){}
  });
  socket.on('proctor_warning', (p) => { console.warn('Proctor warning', p); badge.style.background = 'orange'; try{ updateViolationOverlay(p); }catch(e){} setTimeout(()=> badge.style.background = 'rgba(0,0,0,0.6)', 4000); });
  socket.on('terminate_exam', (p) => { console.warn('Proctor terminated exam', p); try{ showTerminationModal(p); }catch(e){} });
  socket.on('auto_submit', async (p) => { console.warn('Proctor auto_submit', p); badge.textContent = 'Auto-submitting...'; badge.style.background = 'tomato'; try{ overlay.innerHTML = '<div style="font-weight:700">Auto-submit requested</div>'; overlay.style.display = 'block'; }catch(e){} await doAutoSubmit(); });

  // attach camera
  navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(s => {
    console.debug('proctor-inject: camera stream obtained', s && s.getTracks ? s.getTracks().map(t=>t.kind) : s);
    video.srcObject = s;
    video.play().then(()=> console.debug('proctor-inject: video.play() success')).catch(e=>console.warn('proctor-inject: video.play() failed', e));
  }).catch(err => {
    console.warn('Proctor preview: camera access denied', err);
    badge.textContent = 'Camera denied';
  });

  // face count small badge
  const faceCountBadge = document.createElement('div');
  faceCountBadge.style.position = 'fixed';
  faceCountBadge.style.top = '40px';
  faceCountBadge.style.right = '240px';
  faceCountBadge.style.zIndex = 99999;
  faceCountBadge.style.padding = '6px 8px';
  faceCountBadge.style.background = 'rgba(0,0,0,0.6)';
  faceCountBadge.style.color = '#fff';
  faceCountBadge.style.borderRadius = '6px';
  faceCountBadge.style.fontSize = '12px';
  faceCountBadge.id = 'proctor-facecount';
  faceCountBadge.textContent = 'Faces: -';
  document.body.appendChild(faceCountBadge);

  // face overlay canvas (draw bounding boxes)
  const faceOverlayCanvas = document.createElement('canvas');
  faceOverlayCanvas.id = 'proctor-face-canvas';
  faceOverlayCanvas.style.position = 'fixed';
  faceOverlayCanvas.style.top = video.style.top;
  faceOverlayCanvas.style.right = video.style.right;
  faceOverlayCanvas.style.width = video.style.width;
  faceOverlayCanvas.style.height = video.style.height;
  faceOverlayCanvas.style.zIndex = 100001;
  faceOverlayCanvas.style.pointerEvents = 'none';
  faceOverlayCanvas.width = parseInt((video.style.width||'220').replace('px','')) || 220;
  faceOverlayCanvas.height = parseInt((video.style.height||'160').replace('px','')) || 160;
  document.body.appendChild(faceOverlayCanvas);

  // face detection model and loop
  let faceModel = null;
  let faceDetectInterval = null;
  let faceCaptureCanvas = null;
  let faceStatus = 'init';
  let audioStatus = 'init';

  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const s = document.createElement('script'); s.src = url; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  async function initFaceModel(){
    try{
      // Prefer the native FaceDetector API when available (faster, no remote scripts)
      if(window.FaceDetector){
        try{
          const det = new window.FaceDetector();
          faceModel = { type: 'native', detector: det };
          faceStatus = 'native';
          detectorStatus.textContent = `Face: native • Audio: ${audioStatus}`;
          console.info('proctor-inject: using native FaceDetector');
          return;
        }catch(e){
          console.debug('proctor-inject: native FaceDetector init failed', e);
        }
      }

      // helper: try multiple URLs sequentially
      async function tryLoadScripts(urls){
        for(const u of urls){
          try{ await loadScript(u); console.debug('proctor-inject: loaded script', u); return true; }catch(e){ console.warn('proctor-inject: failed loading', u, e && e.message ? e.message : e); }
        }
        return false;
      }

      // attempt TFJS (CDN then unpkg then local paths)
      if(!window.tf){
        const tfUrls = ['https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js','https://unpkg.com/@tensorflow/tfjs@3.21.0/dist/tf.min.js'];
        let ok = await tryLoadScripts(tfUrls);
        if(!ok){
          const localTf = ['/vendor/tf.min.js','/js/vendor/tf.min.js','./vendor/tf.min.js'];
          ok = await tryLoadScripts(localTf);
        }
        if(!window.tf) throw new Error('TensorFlow (tf) not loaded');
      }

      // attempt BlazeFace (CDN then unpkg then local)
      if(!window.blazeface){
        const bfUrls = ['https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.8/dist/blazeface.min.js','https://unpkg.com/@tensorflow-models/blazeface@0.0.8/dist/blazeface.min.js'];
        let ok2 = await tryLoadScripts(bfUrls);
        if(!ok2){
          const localBf = ['/vendor/blazeface.min.js','/js/vendor/blazeface.min.js','./vendor/blazeface.min.js'];
          ok2 = await tryLoadScripts(localBf);
        }
        if(!window.blazeface) throw new Error('BlazeFace not loaded');
      }

      console.debug('proctor-inject: scripts loaded, creating model');
      faceModel = await blazeface.load();
      faceStatus = 'blazeface';
      detectorStatus.textContent = `Face: blazeface • Audio: ${audioStatus}`;
      console.info('proctor-inject: blazeface loaded, backend:', (window.tf && tf.getBackend ? tf.getBackend() : 'unknown'));
    }catch(e){
      console.error('proctor-inject: failed to load face model', e);
      faceStatus = 'unavailable';
      detectorStatus.textContent = `Face: unavailable • Audio: ${audioStatus}`;
      try{ overlay.innerHTML = '<div style="color:#f88">Face detection unavailable — check network/CSP or place tf/blazeface in /vendor/</div>'; overlay.style.display = 'block'; }catch(_e){}

      // add a temporary dump frame button to help debugging
      if(!document.getElementById('proctor-dump-frame-btn')){
        const dumpBtn = document.createElement('button');
        dumpBtn.id = 'proctor-dump-frame-btn';
        dumpBtn.textContent = 'Dump frame';
        dumpBtn.style.position = 'fixed';
        dumpBtn.style.top = '72px';
        dumpBtn.style.right = '340px';
        dumpBtn.style.zIndex = 99999;
        dumpBtn.style.padding = '6px';
        dumpBtn.onclick = ()=>{
          try{
            const cw = 640, ch = 480;
            const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
            const tctx = tmp.getContext('2d'); tctx.drawImage(video, 0, 0, cw, ch);
            const data = tmp.toDataURL('image/png');
            window.open(data);
            console.debug('proctor-inject: dumped current frame to new tab');
          }catch(err){ console.warn('proctor-inject: dump frame failed', err); }
        };
        document.body.appendChild(dumpBtn);
      }

      // do not throw; allow other detectors (audio/visibility) to still function
    }
  }

  function stopFaceDetection(){
    try{ if(faceDetectInterval){ clearInterval(faceDetectInterval); faceDetectInterval = null; } }catch(e){}
    try{ const ctx = faceOverlayCanvas.getContext('2d'); if(ctx) ctx.clearRect(0,0,faceOverlayCanvas.width, faceOverlayCanvas.height); }catch(e){}
  }

  function startFaceDetection(){
    if(faceDetectInterval) return;
    // reuse a small capture canvas to downscale
    const capW = 320;
    const capH = 240;
    faceCaptureCanvas = document.createElement('canvas'); faceCaptureCanvas.width = capW; faceCaptureCanvas.height = capH;
    const capCtx = faceCaptureCanvas.getContext('2d');
    const drawCtx = faceOverlayCanvas.getContext('2d');

    faceCountBadge.textContent = 'Faces: 0';
    faceDetectInterval = setInterval(async ()=>{
      try{
        if(!faceModel) return;
        if(video.readyState < 2) return;
        // draw current video frame into small canvas
        capCtx.drawImage(video, 0, 0, capW, capH);
        let preds = [];
        if(faceModel.type === 'native' && faceModel.detector && typeof faceModel.detector.detect === 'function'){
          // use native FaceDetector on the small capture canvas
          try{
            const dets = await faceModel.detector.detect(faceCaptureCanvas);
            preds = (dets || []).map(d => ({ topLeft: [d.boundingBox.x, d.boundingBox.y], bottomRight: [d.boundingBox.x + d.boundingBox.width, d.boundingBox.y + d.boundingBox.height] }));
            console.debug('proctor-inject: native FaceDetector ->', preds.length);
          }catch(e){ console.debug('proctor-inject: native detect failed', e); preds = []; }
        } else {
          try{
            preds = await faceModel.estimateFaces(faceCaptureCanvas, false) || [];
            console.debug('proctor-inject: face estimate on canvas ->', preds.length);
          }catch(e){
            console.debug('proctor-inject: canvas estimate failed, trying video element', e && e.message);
            try{ preds = await faceModel.estimateFaces(video, false) || []; console.debug('proctor-inject: face estimate on video ->', preds.length); }catch(e2){ console.warn('proctor-inject: video estimate also failed', e2); }
          }
        }

        const faceCount = Array.isArray(preds) ? preds.length : 0;
        // draw boxes
        drawCtx.clearRect(0,0, faceOverlayCanvas.width, faceOverlayCanvas.height);
        drawCtx.lineWidth = 2; drawCtx.strokeStyle = 'lime'; drawCtx.fillStyle = 'rgba(0,255,0,0.12)';
        const scaleX = faceOverlayCanvas.width / capW; const scaleY = faceOverlayCanvas.height / capH;
        for(const p of preds){
          const tl = p.topLeft; const br = p.bottomRight;
          if(!tl || !br) continue;
          const x = tl[0]*scaleX, y = tl[1]*scaleY, w = (br[0]-tl[0])*scaleX, h = (br[1]-tl[1])*scaleY;
          drawCtx.fillRect(x,y,w,h);
          drawCtx.strokeRect(x,y,w,h);
        }
        // update small face badge
        faceCountBadge.textContent = `Faces: ${faceCount}`;
        detectorStatus.textContent = `Face: ${faceStatus} • Audio: ${audioStatus}`;
        if(faceCount > 1 && canReport('multiple_faces')){
          console.info('proctor-inject: multiple faces detected ->', faceCount);
          reportViolation({ type: 'multiple_faces', severity: 'high', confidence: Math.min(1, faceCount/2), metadata: { faceCount } });
        }
      }catch(e){ console.warn('proctor-inject: face detect error', e); }
    }, 700);
  }

  // start model when video is playing; also size overlay canvas to video CSS size
  video.addEventListener('playing', async ()=>{
    try{
      // ensure overlay canvas matches video CSS size
      try{
        const vw = parseInt(video.style.width||'220');
        const vh = parseInt(video.style.height||'160');
        faceOverlayCanvas.width = vw; faceOverlayCanvas.height = vh;
        faceOverlayCanvas.style.width = (vw)+'px'; faceOverlayCanvas.style.height = (vh)+'px';
      }catch(e){ console.debug('proctor-inject: overlay sizing failed', e); }

      await initFaceModel();
      startFaceDetection();
    }catch(e){ try{ overlay.innerHTML = '<div style="color:#f88">Face detection unavailable</div>'; }catch(_){} }
  });

  // --- Simple client-side detectors and reporting ---
  const lastReported = {};
  function canReport(type, cooldownMs=8000){
    const now = Date.now();
    if(!lastReported[type] || now - lastReported[type] > cooldownMs){ lastReported[type] = now; return true; }
    return false;
  }

  async function reportViolation(payload){
    payload = Object.assign({ sessionId, timestamp: new Date().toISOString() }, payload);
    console.debug('proctor-inject: reporting violation', payload);
    // try{ overlay.innerHTML = `<div style="font-weight:700">Reported: ${payload.type}</div><div style="font-size:12px;opacity:0.9">Sending to server...</div>`; overlay.style.display = 'block'; }catch(e){}
    try{
      if(socket && socket.connected){
        socket.emit('report_violation', payload);
        console.debug('proctor-inject: emitted report_violation via socket');
        try{ showViolationToast(payload.type, payload.metadata && payload.metadata.faceCount ? `faces ${payload.metadata.faceCount}` : payload.message); }catch(e){}
        return;
      }
    }catch(e){ console.warn('socket emit failed', e); }

    // fallback HTTP
    for(const b of backends){
      try{
        const r = await fetch(b + '/api/proctor/report-violation', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'authentication': `Bearer ${token}` }, body: JSON.stringify(payload)
        });
        console.debug('proctor-inject: HTTP report to', b, r.status);
        if(r.ok){ try{ showViolationToast(payload.type, payload.metadata && payload.metadata.faceCount ? `faces ${payload.metadata.faceCount}` : payload.message); }catch(e){}; return; }
      }catch(e){ console.warn('proctor-inject: HTTP report failed to', b, e); }
    }
  }

  // visibility/tab switch
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && canReport('tab_switch')){
      badge.textContent = 'Tab switched';
      reportViolation({ type: 'tab_switch', severity: 'medium', message: 'User switched tab or minimized' });
    }
  });

  // window blur
  window.addEventListener('blur', ()=>{ if(canReport('window_blur')){ badge.textContent = 'Window blurred'; reportViolation({ type: 'window_blur', severity: 'medium', message: 'Window lost focus' }); } });

  // add manual test button
  // const testBtn = document.createElement('button');
  // //testBtn.textContent = 'Trigger violation';
  // testBtn.style.position = 'fixed'; testBtn.style.top='8px'; testBtn.style.right='340px'; testBtn.style.zIndex=99999; testBtn.style.padding='6px';
  // testBtn.onclick = ()=>{ reportViolation({ type: 'manual_test', severity: 'low', message: 'Manual test triggered' }); };
  // document.body.appendChild(testBtn);

  // simple audio level detector
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    try{
      audioStatus = 'active';
      detectorStatus.textContent = `Face: ${faceStatus} • Audio: ${audioStatus}`;
      console.debug('proctor-inject: audio stream obtained', stream && stream.getTracks ? stream.getTracks().map(t=>t.kind) : stream);
      const ac = new (window.AudioContext||window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser(); analyser.fftSize = 2048; src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let loudSince = 0;
      setInterval(()=>{
        analyser.getByteTimeDomainData(data);
        let sum=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum += v*v; }
        const rms = Math.sqrt(sum/data.length);
        // show rms more frequently for debugging
        if(Math.random() < 0.15) detectorStatus.textContent = `Face: ${faceStatus} • Audio: ${audioStatus} • RMS:${rms.toFixed(3)}`;
        // Lower threshold (0.08 instead of 0.12) and shorter duration (800ms instead of 1500ms)
        if(rms > 0.08){ 
          if(!loudSince) {
            loudSince = Date.now(); 
            console.debug('proctor-inject: audio above threshold, RMS:', rms.toFixed(3));
          } else if(Date.now()-loudSince > 800 && canReport('voice')){ 
            console.info('proctor-inject: loud audio detected, RMS:', rms.toFixed(3), 'duration:', Date.now()-loudSince, 'ms');
            badge.textContent='Loud audio'; 
            reportViolation({ type: 'voice', severity: 'high', message: 'Loud audio detected', metadata: { rms: rms.toFixed(3) } }); 
            loudSince = 0; 
          } 
        }
        else loudSince = 0;
      }, 400);
    }catch(e){ audioStatus = 'error'; detectorStatus.textContent = `Face: ${faceStatus} • Audio: ${audioStatus}`; console.warn('audio analysis failed', e); }
  }).catch((err)=>{ audioStatus = 'denied'; detectorStatus.textContent = `Face: ${faceStatus} • Audio: ${audioStatus}`; console.warn('proctor-inject: audio getUserMedia failed', err); });

  async function doAutoSubmit(){
    try{
      // get code from global editor if present
      const code = (window.editor && typeof window.editor.getValue === 'function') ? window.editor.getValue() : '';
      // determine language
      let language = 'java';
      const languageElement = document.getElementById('language') || document.getElementById('language-mobile');
      if(languageElement && languageElement.textContent && languageElement.textContent.trim()!=='Select language'){
        const txt = languageElement.textContent.trim().toLowerCase();
        if(txt.includes('python')) language = 'python';
        else if(txt.includes('node') || txt.includes('javascript')) language = 'javascript';
        else language = 'java';
      }

      if(!assignmentId){
        // try to read from URL param 'id'
        const params = new URLSearchParams(window.location.search);
        assignmentId = params.get('id') || params.get('assignmentId') || params.get('assignment');
      }

      if(!assignmentId){
        console.error('Auto-submit failed: assignmentId missing');
        badge.textContent = 'Auto-submit failed: missing assignmentId';
        return;
      }

      const submitResp = await fetch(backend + '/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authentication': `Bearer ${token}` },
        body: JSON.stringify({ assignmentId, code, language })
      });
      const json = await submitResp.json().catch(()=>null);
      console.log('auto-submit response', submitResp.status, json);
      if(!submitResp.ok){
        badge.textContent = 'Auto-submit failed';
        return;
      }

      // once submitted, inform proctor backend to finish session
      await fetch(backend + '/api/proctor/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authentication': `Bearer ${token}` },
        body: JSON.stringify({ sessionId })
      }).catch(()=>{});

      badge.textContent = 'Auto-submitted';
      // optionally disable submit button
      const sb = document.getElementById('submitBtn'); if(sb) sb.disabled = true;

    }catch(err){
      console.error('auto-submit error', err);
      badge.textContent = 'Auto-submit error';
    }
  }

})();
