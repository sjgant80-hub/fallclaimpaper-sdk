// fallclaimpaper SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallclaimpaper/index.html · 185276 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallclaimpaper" }); }
    else go();
  })();
'use strict';
// ════════════════════════════════════════════════════════════════
// FallClaimPaper v1.0.0 · sovereign UK claims document generator
// prime 823 · MIT · claims bundle compliant · fall-claim mesh
// Client data never leaves the device.
// ════════════════════════════════════════════════════════════════
const TOOLNAME='fallclaimpaper';
const VERSION='1.0.0';
const PRIME=823;
const STORE='fallclaimpaper-v1';
const SCHEMA_VERSION='1.0';
const TABS=[
 {id:'dashboard', name:'Dashboard', ico:'◐'},
 {id:'cases', name:'Cases', ico:'§'},
 {id:'generate', name:'Generate', ico:'△'},
 {id:'library', name:'Library', ico:'▦'},
 {id:'templates', name:'Templates', ico:'✆'},
 {id:'firm', name:'Firm', ico:'⌂'},
 {id:'audit', name:'Audit', ico:'◯'},
 {id:'help', name:'Q & A', ico:'?'},
];
let state={
 active:'dashboard',
 brandName:'FallClaimPaper',
 firm:null,
 advisers:[],
 clients:[],
 cases:[],
 documents:[],
 templates:[],
 audit:[],
 ui:{
 selectedClientId:null,
 selectedCaseId:null,
 selectedTemplateId:'client-agreement-cfa',
 selectedDocumentId:null,
 activeAdviserId:null,
 libFilterClient:'',
 libFilterCase:'',
 libFilterTpl:'',
 libFilterStatus:'',
 valuationFromFallClaim:null,
 sectionOverrides:{},
 extraContext:{},
 chat:[],
 },
 settings:{
 anthropicKey:'',
 auditChain:true,
 autoBroadcast:true,
 },
};
// ── util ──
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,11);
const now=()=>Date.now();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>(+n||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0});
const money=n=>'£'+fmt(n);
const moneyP=n=>'£'+(+n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateStr=ts=>{if(!ts)return '—';const d=new Date(ts);if(isNaN(d))return String(ts);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
const dateTime=ts=>{if(!ts)return '—';const d=new Date(ts);if(isNaN(d))return String(ts);return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})};
const isoDate=ts=>{if(!ts)return '';const d=new Date(ts);if(isNaN(d))return '';return d.toISOString().slice(0,10)};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1900)}
async function sha256(s){
 const buf=new TextEncoder().encode(s);
 const h=await crypto.subtle.digest('SHA-256',buf);
 return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
// ════════════════════════════════════════════════════════════════
// IDB · stores: firms, advisers, clients, cases, documents, templates, audit, state
// ════════════════════════════════════════════════════════════════
let db;
function openDB(){
 return new Promise((res,rej)=>{
 const r=indexedDB.open(STORE,1);
 r.onupgradeneeded=e=>{
 const d=e.target.result;
 ['firms','advisers','clients','cases','documents','templates','audit','state'].forEach(s=>{
 if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:s==='state'?undefined:'id'});
 });
 };
 r.onsuccess=e=>{db=e.target.result;res(db)};
 r.onerror=rej;
 });
}
function idbGetAll(store){return new Promise(res=>{const tx=db.transaction(store,'readonly');const q=tx.objectStore(store).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
function idbGet(store,key){return new Promise(res=>{const tx=db.transaction(store,'readonly');const q=tx.objectStore(store).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}
function idbPut(store,val,key){return new Promise(res=>{const tx=db.transaction(store,'readwrite');const o=tx.objectStore(store);const q=key!=null?o.put(val,key):o.put(val);q.onsuccess=()=>res(true);q.onerror=()=>res(false)})}
function idbDel(store,key){return new Promise(res=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res(true)})}
async function loadAll(){
 if(!db)await openDB();
 const [firms,advisers,clients,cases,documents,templates,audit,uiState]=await Promise.all([
 idbGetAll('firms'),idbGetAll('advisers'),idbGetAll('clients'),idbGetAll('cases'),
 idbGetAll('documents'),idbGetAll('templates'),idbGetAll('audit'),
 idbGet('state','ui'),
 ]);
 state.firm=firms[0]||null;
 state.advisers=advisers;
 state.clients=clients;
 state.cases=cases;
 state.documents=documents;
 state.audit=audit.sort((a,b)=>a.i-b.i);
 state.templates=mergeTemplates(templates);
 if(uiState){
 state.ui=Object.assign({},state.ui,uiState.value||{});
 state.brandName=uiState.brand||'FallClaimPaper';
 state.settings=Object.assign({},state.settings,uiState.settings||{});
 }
}
async function persistUI(){if(!db)await openDB();await idbPut('state',{value:state.ui,brand:state.brandName,settings:state.settings},'ui')}
// ════════════════════════════════════════════════════════════════
// AUDIT chain (P3 extended · 6yr CMR retention)
// ════════════════════════════════════════════════════════════════
async function audit(action,opts={}){
 if(!state.settings.auditChain)return;
 if(!db)await openDB();
 const prev=state.audit.length?state.audit[state.audit.length-1]:null;
 const prevHash=prev?prev.docHash:'';
 const i=(prev?prev.i:0)+1;
 const payload=opts.payload||{};
 const entry={id:uid('au'),i,ts:now(),tool:TOOLNAME,adviserId:opts.adviserId||state.ui.activeAdviserId||'',clientId:opts.clientId||'',caseId:opts.caseId||'',action,reasoning:opts.reasoning||'',configVersion:TOOLNAME+'@'+VERSION,prevHash,docHash:'',payload};
 entry.docHash=await sha256(JSON.stringify({i,ts:entry.ts,action,clientId:entry.clientId,caseId:entry.caseId,prevHash,payload}));
 state.audit.push(entry);
 await idbPut('audit',entry);
}
// ════════════════════════════════════════════════════════════════
// BUNDLE MESH · fall-claim + fall-signal
// ════════════════════════════════════════════════════════════════
let bcClaim,bcSignal;
let bcDebounce={};
function broadcast(channel,type,payload){
 if(!state.settings.autoBroadcast)return;
 if(!channel)return;
 try{channel.postMessage({v:1,type,ts:now(),source:TOOLNAME,payload})}catch(e){}
}
function debouncedBroadcast(key,channel,type,payload){clearTimeout(bcDebounce[key]);bcDebounce[key]=setTimeout(()=>broadcast(channel,type,payload),300)}
async function initMesh(){
 try{
 bcSignal=new BroadcastChannel('fall-signal');
 bcSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()});
 bcSignal.addEventListener('message',e=>{const m=e.data;if(!m)return;if(m.type==='ping')bcSignal.postMessage({source:TOOLNAME,type:'pong',prime:PRIME})});
 }catch(e){}
 try{
 bcClaim=new BroadcastChannel('fall-claim');
 bcClaim.addEventListener('message',handleClaimMessage);
 bcClaim.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{wants:['clients','advisers','firm','cases']}});
 }catch(e){}
}
async function handleClaimMessage(e){
 const m=e.data;if(!m||m.source===TOOLNAME)return;
 let dirty=false;
 if(m.type==='client.created'||m.type==='client.updated'){
 const c=m.payload;if(c&&c.id){
 const idx=state.clients.findIndex(x=>x.id===c.id);
 const existing=idx>=0?state.clients[idx]:null;
 if(!existing||(c.updatedAt||0)>=(existing.updatedAt||0)){
 if(idx>=0)state.clients[idx]=c;else state.clients.push(c);
 await idbPut('clients',c);dirty=true;
 }
 }
 }else if(m.type==='client.archived'){
 const c=m.payload;if(c&&c.id){const idx=state.clients.findIndex(x=>x.id===c.id);if(idx>=0){state.clients[idx]=c;await idbPut('clients',c);dirty=true}}
 }else if(m.type==='adviser.created'||m.type==='adviser.updated'){
 const a=m.payload;if(a&&a.id){const idx=state.advisers.findIndex(x=>x.id===a.id);if(idx>=0)state.advisers[idx]=a;else state.advisers.push(a);await idbPut('advisers',a);dirty=true}
 }else if(m.type==='firm.updated'){
 const f=m.payload;if(f){state.firm=f;await idbPut('firms',f);dirty=true}
 }else if(m.type==='case.created'||m.type==='case.updated'||m.type==='case.settled'||m.type==='case.discontinued'){
 const k=m.payload;if(k&&k.id){
 const idx=state.cases.findIndex(x=>x.id===k.id);
 const existing=idx>=0?state.cases[idx]:null;
 if(!existing||(k.updatedAt||0)>=(existing.updatedAt||0)){
 if(idx>=0)state.cases[idx]=k;else state.cases.push(k);
 await idbPut('cases',k);dirty=true;
 }
 }
 }else if(m.type==='fallclaim.valuation.response'){
 const p=m.payload||{};
 if(p.caseId){
 state.ui.valuationFromFallClaim=p;
 toast('valuation received · fallclaim');
 dirty=true;
 }
 }else if(m.type==='sync.request'){
 if(bcClaim)bcClaim.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{clients:state.clients,advisers:state.advisers,firm:state.firm,cases:state.cases}});
 }else if(m.type==='sync.snapshot'){
 const p=m.payload||{};
 if(Array.isArray(p.clients))for(const c of p.clients){
 const idx=state.clients.findIndex(x=>x.id===c.id);
 const ex=idx>=0?state.clients[idx]:null;
 if(!ex||(c.updatedAt||0)>=(ex.updatedAt||0)){if(idx>=0)state.clients[idx]=c;else state.clients.push(c);await idbPut('clients',c);dirty=true}
 }
 if(Array.isArray(p.advisers))for(const a of p.advisers){
 const idx=state.advisers.findIndex(x=>x.id===a.id);
 const ex=idx>=0?state.advisers[idx]:null;
 if(!ex||(a.updatedAt||0)>=(ex.updatedAt||0)){if(idx>=0)state.advisers[idx]=a;else state.advisers.push(a);await idbPut('advisers',a);dirty=true}
 }
 if(Array.isArray(p.cases))for(const k of p.cases){
 const idx=state.cases.findIndex(x=>x.id===k.id);
 const ex=idx>=0?state.cases[idx]:null;
 if(!ex||(k.updatedAt||0)>=(ex.updatedAt||0)){if(idx>=0)state.cases[idx]=k;else state.cases.push(k);await idbPut('cases',k);dirty=true}
 }
 if(p.firm&&(!state.firm||(p.firm.updatedAt||0)>(state.firm.updatedAt||0))){state.firm=p.firm;await idbPut('firms',p.firm);dirty=true}
 }
 if(dirty)render();
}
function handleWindowMessage(e){
 const m=e.data;if(!m||typeof m!=='object')return;
 if(m.type==='fallclaim.valuation.response'&&m.payload){state.ui.valuationFromFallClaim=m.payload;toast('valuation pulled · fallclaim');render()}
}
function requestValuation(caseId){
 if(bcClaim)broadcast(bcClaim,'fallclaim.valuation.request',{caseId,from:TOOLNAME});
 toast('valuation request sent → fallclaim');
}
async function emitClientUpdate(c){if(bcClaim)debouncedBroadcast('client-'+c.id,bcClaim,'client.updated',c)}
async function emitFirmUpdate(){if(bcClaim&&state.firm)debouncedBroadcast('firm',bcClaim,'firm.updated',state.firm)}
async function emitAdviserUpdate(a){if(bcClaim)debouncedBroadcast('adv-'+a.id,bcClaim,'adviser.updated',a)}
async function emitCaseUpdate(k){if(bcClaim)debouncedBroadcast('case-'+k.id,bcClaim,'case.updated',k)}
async function emitDocCreated(d){if(bcClaim)broadcast(bcClaim,'document.created',d)}
// ════════════════════════════════════════════════════════════════
// TEMPLATE CATALOGUE · 15 claims templates
// ════════════════════════════════════════════════════════════════
const TEMPLATES_BUILTIN=[];
TEMPLATES_BUILTIN.push({
 id:'client-agreement-cfa', name:'Client Agreement · CFA (LASPO)', version:'1.0',
 cobs:'LASPO 2012 · CFA Order 2013', kind:'agreement',
 description:'Conditional Fee Agreement — "no win, no fee". Success fee capped 25% of PI damages post-LASPO.',
 sections:[
{id:'header', heading:'Conditional Fee Agreement',
 body:'**This agreement is between:**\n\n**{{firm.name}}** (the Solicitor / Claims Firm)\nFCA / SRA Reference: {{firm.fcaRefNo}}\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\n\nand\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** (the Client)\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\n**Case reference:** {{case.ref}}\n**Date of agreement:** {{today}}',
 requiredFields:['firm.name','client.firstName','client.lastName','case.ref']},
{id:'scope', heading:'1. What this agreement covers',
 body:'This Conditional Fee Agreement ("CFA") covers your claim arising out of the **{{case.type}}** incident on **{{case.incidentDate}}** at **{{case.incidentLocation}}** in which you allege you suffered injury, loss and damage. It covers all work reasonably required to investigate, formulate, present and (if necessary) pursue your claim to judgment, including any reasonable appeal, settlement negotiations and enforcement of any judgment or order for costs.\n\nIt does **not** cover any counterclaim against you, any related criminal proceedings, or any claim of a different nature against a different defendant.'},
{id:'paying-us', heading:'2. Paying us — "no win, no fee"',
 body:'**If you win:** you pay our basic charges, our disbursements and a success fee. The amount of these is set out below. You can usually claim our basic charges and disbursements from your opponent. Since 1 April 2013 the success fee is **not** recoverable from your opponent and must be paid by you from your damages.\n\n**If you lose:** you do not pay our basic charges. You may still have to pay disbursements (court fees, expert reports, medical records) unless these are covered by After-the-Event ("ATE") insurance or by your opponent if you have qualified one-way costs shifting ("QOCS") protection in a personal injury claim.\n\n**"Win" means:** your claim is decided in your favour, whether by a court order, an out-of-court settlement, or acceptance by you of a Part 36 offer made by your opponent.'},
{id:'basic-charges', heading:'3. Our basic charges',
 body:'Our basic charges are calculated according to the time spent by fee-earners on your case, charged at the following rates (these may be reviewed annually):\n\n- Partner / Grade A: £{{ctx.cfaRatePartner}} per hour\n- Senior solicitor / Grade B: £{{ctx.cfaRateSenior}} per hour\n- Other solicitors and legal executives / Grade C: £{{ctx.cfaRateSolicitor}} per hour\n- Trainees, paralegals and other fee earners / Grade D: £{{ctx.cfaRateParalegal}} per hour\n\nLetters and routine telephone calls are charged at 1/10th of the relevant hourly rate (6 minutes); other items in 6-minute units. VAT is charged in addition where applicable.'},
{id:'success-fee', heading:'4. Success fee', locked:true,
 body:'If you win, you will pay us a success fee in addition to our basic charges.\n\n**Success fee percentage:** **{{case.cfaSuccessFeePct}}%** of our basic charges.\n\n**CAP (PERSONAL INJURY CLAIMS):** by virtue of section 44 of LASPO 2012 and the Conditional Fee Agreements Order 2013, the total of the success fee in any personal injury claim is **capped at 25% of (a) general damages for pain, suffering and loss of amenity, plus (b) past pecuniary loss net of any sums recoverable by the Compensation Recovery Unit**. Future pecuniary loss is excluded from the cap.\n\nThe success fee reflects the following risk factors: (i) the prospects of success on liability; (ii) the prospects of success on causation; (iii) the prospects of success on quantum; (iv) the cost of disbursements that we have to fund; (v) the delay in our being paid.'},
{id:'disbursements', heading:'5. Disbursements',
 body:'You are responsible for all disbursements incurred on your behalf. These include (but are not limited to): court fees, counsel\'s fees, medical records fees, expert reports, MIB / DVLA enquiries, Land Registry searches, travel expenses and copying. We will, wherever reasonable, fund these as the case progresses and reclaim them at the conclusion. If you lose, you may have to pay disbursements yourself unless they are covered by ATE insurance or QOCS.'},
{id:'ate-insurance', heading:'6. After-the-event ("ATE") insurance',
 body:'We {{ctx.cfaAteRecommendation}} recommend that you take out After-the-Event insurance to cover your opponent\'s costs and your own disbursements if you lose. The ATE premium is **{{ctx.cfaAtePremium}}** and is **not** recoverable from your opponent (LASPO).\n\nQualified one-way costs shifting (QOCS) under CPR 44.13–17 means that in most personal injury claims the unsuccessful claimant will not have to pay the defendant\'s costs, subject to exceptions (fundamental dishonesty, claim struck out for no reasonable grounds, claim made for the financial benefit of another).'},
{id:'client-duties', heading:'7. What you must do',
 body:'You must:\n- give us instructions that allow us to do our work properly;\n- not ask us to work in an improper or unreasonable way;\n- not deliberately mislead us;\n- co-operate with us;\n- attend any medical or expert examinations or court hearings as required;\n- not change solicitors without our written consent except in accordance with the cancellation rights below.\n\nIf you breach these obligations we may end this agreement and require you to pay our basic charges and disbursements.'},
{id:'opt-out', heading:'8. Right to end this agreement (you)',
 body:'You can end this agreement at any time. If you end the agreement before your claim ends, we have the right to **decide** whether to require you to pay our basic charges and disbursements when you receive damages, or to pay them immediately. If you end the agreement because we have broken it, you will not be required to pay our charges.'},
{id:'our-end', heading:'9. Right to end this agreement (us)',
 body:'We can end this agreement if you reject our opinion about making a settlement with your opponent. In that case you must pay our basic charges and disbursements (including counsel\'s fees) when they are assessed, unless you ask us to get a second opinion from a senior fee earner outside our firm and that opinion supports your position.\n\nWe can also end this agreement if you do not keep to your obligations under section 7.'},
{id:'cooling-off', heading:'10. Cooling-off · 14 days', locked:true,
 body:'Under the **Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013**, where this agreement is made off-premises or at a distance, you have the right to cancel within **14 days** of signing, without giving any reason and without penalty.\n\nTo cancel, you must inform us by a clear statement (letter, email, or completed cancellation form) sent to our address above before the 14-day period expires.\n\nIf you have asked us to begin work during the cancellation period, you may be charged for work actually done.'},
{id:'complaints', heading:'11. Complaints', locked:true,
 body:'If you are unhappy with any aspect of our service, please contact our Complaints Officer in writing at the address above. We will acknowledge your complaint within 3 working days and provide a final response within 8 weeks.\n\nIf you remain dissatisfied, you may refer the matter to the **Financial Ombudsman Service** (CMR firms) or the **Legal Ombudsman** (solicitors).\n\n- Financial Ombudsman Service: Exchange Tower, London E14 9SR · 0800 023 4567 · www.financial-ombudsman.org.uk\n- Legal Ombudsman: PO Box 6167, Slough SL1 0EH · 0300 555 0333 · www.legalombudsman.org.uk\n\nYou normally have **6 months** from our final response within which to refer the matter to the Ombudsman.'},
{id:'data', heading:'12. Data protection',
 body:'We process your personal data as a Data Controller under the UK GDPR and the Data Protection Act 2018, for the purposes of providing the services described in this agreement and complying with our regulatory obligations. We retain your file for **at least 6 years** following the end of our retainer, as required by FCA / SRA / CMR record-retention rules.'},
{id:'governing', heading:'13. Governing law',
 body:'This agreement is governed by the laws of England and Wales. Any dispute shall be subject to the exclusive jurisdiction of the courts of England and Wales.'},
{id:'signatures', heading:'14. Signatures',
 body:'I have read and understood this Conditional Fee Agreement. I confirm that I have been given a clear explanation of how I will be charged, of the success fee, of the 25% cap on personal injury success fees, of cancellation rights, and of the alternatives to a CFA (including legal expenses insurance and trade union funding) which were considered.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'client-agreement-dba', name:'Client Agreement · DBA (Damages Based)', version:'1.0',
 cobs:'Damages-Based Agreements Regulations 2013', kind:'agreement',
 description:'Damages-Based Agreement — fee is % of damages recovered. Capped 50% non-PI / 25% PI in court.',
 sections:[
{id:'header', heading:'Damages-Based Agreement (DBA)',
 body:'**This agreement is between:**\n\n**{{firm.name}}** (the Representative)\nFCA / SRA Reference: {{firm.fcaRefNo}}\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\n\nand\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** (the Client)\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\n**Case reference:** {{case.ref}}\n**Claim type:** {{case.type}}\n**Date of agreement:** {{today}}',
 requiredFields:['firm.name','client.firstName','client.lastName','case.ref']},
{id:'scope', heading:'1. What this agreement covers',
 body:'This Damages-Based Agreement ("DBA") covers your claim arising from the **{{case.type}}** incident on **{{case.incidentDate}}** at **{{case.incidentLocation}}**, against {{ctx.defendantsList}}. It covers all work reasonably required to investigate, formulate and pursue your claim, including reasonable appeals, settlement negotiations and enforcement.'},
{id:'fee', heading:'2. Our fee — percentage of damages', locked:true,
 body:'**Payment to us if you win:** we will receive a payment ("the Payment") calculated as a percentage of the financial benefit you recover from this claim.\n\n**Agreed percentage:** **{{case.dbaPct}}%** of the sums you recover (inclusive of VAT and counsel\'s fees, exclusive of any third-party expert disbursements).\n\n**STATUTORY CAPS (Damages-Based Agreements Regulations 2013):**\n- Personal injury claims **in court proceedings**: the Payment must not exceed **25%** of the combined sums recovered for (a) general damages for pain, suffering and loss of amenity, and (b) past pecuniary loss net of CRU benefits. Future pecuniary loss is excluded from the cap base.\n- Personal injury claims **not in court proceedings**: the Payment must not exceed **25%** of the sums recovered (same calculation base).\n- Employment tribunal claims: the Payment must not exceed **35%** of the sums recovered.\n- All other claims: the Payment must not exceed **50%** of the sums recovered.\n\nWhere the agreed percentage above would, on the figures actually recovered, exceed the applicable cap, the Payment will be reduced to the cap.'},
{id:'expenses', heading:'3. Expenses',
 body:'Disbursements (court fees, expert reports, counsel\'s fees, medical records, travel, etc.) will be incurred on your behalf as the case progresses. Counsel\'s fees are included in the Payment. All other disbursements will be recovered from your opponent if you win; if you lose, you will be liable for disbursements unless they are covered by After-the-Event insurance or by QOCS protection in a PI claim.'},
{id:'win-lose', heading:'4. What happens if you win or lose',
 body:'**If you win** (judgment in your favour or settlement accepted): we will deduct the Payment from the sums recovered and account to you for the balance. We will also recover from your opponent such of our costs as the court allows on standard or indemnity assessment; those recovered costs reduce the Payment payable from your damages (the "Ontario model": opponent pays first, you top up).\n\n**If you lose:** we receive no Payment. You may still owe disbursements (see section 3).'},
{id:'termination', heading:'5. Termination',
 body:'You may end this agreement at any time. If you do so before a successful conclusion, we may charge you our basic costs at our standard hourly rates for the work done up to termination, subject to the assessment process.\n\nWe may end this agreement if you breach a material obligation (failure to attend examinations, deliberate dishonesty, refusal of a reasonable settlement against our written advice).'},
{id:'cooling-off', heading:'6. Cooling-off · 14 days', locked:true,
 body:'Under the **Consumer Contracts Regulations 2013**, where this agreement is made off-premises or at a distance, you have the right to cancel within **14 days** without giving a reason. To cancel, send a clear statement to the address above. If you ask us to begin work during the cooling-off period, you may be charged for work actually done.'},
{id:'complaints', heading:'7. Complaints', locked:true,
 body:'Complaints in writing to our Complaints Officer at the address above. Acknowledgment within 3 working days; final response within 8 weeks. Escalation to the **Financial Ombudsman Service** (0800 023 4567 · www.financial-ombudsman.org.uk) or the **Legal Ombudsman** (0300 555 0333 · www.legalombudsman.org.uk) within 6 months of our final response.'},
{id:'signatures', heading:'8. Signatures',
 body:'I confirm that the operation of this Damages-Based Agreement (including the statutory caps) has been explained to me. I have been told about, and considered, the alternatives — paying privately, a Conditional Fee Agreement, legal expenses insurance, trade union funding and (if applicable) legal aid.\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'letter-of-claim', name:'Letter of Claim (Pre-Action Protocol)', version:'1.0',
 cobs:'Pre-Action Protocol for PI / Clinical Neg / Portal', kind:'pre-action',
 description:'Pre-action protocol Letter of Claim. PI 21d / portal 30 working days / clin neg 4 months response.',
 sections:[
{id:'header', heading:'Letter of Claim',
 body:'**{{firm.name}}**\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\nTel: {{adviser.phone}} · Email: {{adviser.email}}\nOur Ref: {{case.ref}}\n\n{{ctx.defendantName}}\n{{ctx.defendantAddress}}\n\nDate: {{today}}\n\n**WITHOUT PREJUDICE SAVE AS TO COSTS**',
 requiredFields:['firm.name','case.ref','ctx.defendantName']},
{id:'subject', heading:'',
 body:'Dear Sirs\n\n**Re: Our client: {{client.title}} {{client.firstName}} {{client.lastName}}**\n**Date of birth: {{client.dob}}**\n**National Insurance number: {{client.nino}}**\n**Date of incident: {{case.incidentDate}}**\n**Location: {{case.incidentLocation}}**\n\nWe are instructed by the above-named client in connection with personal injury, loss and damage sustained as a result of the incident described below. This letter is sent in compliance with the relevant pre-action protocol and is your formal notification of a claim against you.'},
{id:'parties', heading:'1. The parties',
 body:'**The Claimant:** {{client.title}} {{client.firstName}} {{client.lastName}} of {{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}.\n\n**The Defendant(s):** {{ctx.defendantName}} of {{ctx.defendantAddress}}{{ctx.defendantInsurerLine}}.\n\nIf you are not the correct defendant, or there are others who should be joined, please advise within 7 days.'},
{id:'circumstances', heading:'2. Circumstances of the incident',
 body:'On {{case.incidentDate}}, at {{case.incidentLocation}}, the following occurred:\n\n{{case.description}}\n\n{{ctx.locFactualNarrative}}'},
{id:'breach', heading:'3. Allegations of breach of duty',
 body:'We allege that the incident and the injuries sustained were caused by your negligence and / or breach of statutory duty. In particular, you:\n\n{{ctx.locAllegationsList}}\n\nFurther particulars of negligence may be added on receipt of disclosure.'},
{id:'causation', heading:'4. Causation',
 body:'But for the breaches alleged above, our client would not have sustained the injuries and consequential losses set out below. The injuries are a foreseeable consequence of the breaches alleged.'},
{id:'injury', heading:'5. Injuries sustained',
 body:'As a result of the incident our client sustained the following injuries:\n\n{{ctx.injurySummary}}\n\nOur client {{ctx.medicalEvidenceStatus}}. A medical report will be served in due course.'},
{id:'special-damages', heading:'6. Summary of special damages',
 body:'Special damages claimed (as currently quantified — full Schedule of Loss to follow) include:\n\n{{ctx.specialDamagesSummary}}\n\nAn updated Schedule of Loss will be served with the Particulars of Claim or earlier, as appropriate.'},
{id:'documents-requested', heading:'7. Documents requested',
 body:'Pursuant to the relevant pre-action protocol, please disclose the following documents within the response period:\n\n{{ctx.documentsRequestedList}}\n\nThis list is not exhaustive and is without prejudice to any application that may subsequently be made under CPR 31.16 for pre-action disclosure.'},
{id:'response-period', heading:'8. Response',
 body:'Please acknowledge receipt of this letter within **21 days** and provide a substantive response within the response period applicable to your case:\n\n- **Personal injury (general):** 3 months from acknowledgment in which to investigate, after which you must state whether liability is admitted or denied.\n- **MOJ portal (RTA / EL / PL):** electronic acknowledgment within **1 business day**, decision on liability within **15 / 30 business days** (RTA / EL or PL respectively).\n- **Clinical negligence:** 4 months from acknowledgment in which to investigate and respond.\n\nIf liability is denied, full reasons and disclosure of all relevant documents must be provided in accordance with the protocol.\n\n**Response deadline: {{ctx.responseDeadline}}**'},
{id:'wp-offer', heading:'9. Without-prejudice offer',
 body:'Our client is prepared, at this stage and on a without-prejudice-save-as-to-costs basis, to settle this claim in the sum of **£{{ctx.locOfferAmount}}** inclusive of interest. This offer is open for acceptance for 21 days from the date of this letter; thereafter it shall lapse unless renewed in writing.\n\nThis offer is made in an attempt to dispose of the matter without the cost and delay of further proceedings and reflects our client\'s view of the likely settlement value taking into account the strength of liability, the medical evidence presently available, and the special damages summary above.'},
{id:'failure-to-respond', heading:'10. Failure to respond',
 body:'In the event that you fail to respond within the required period, or you deny liability without adequate reasoning or disclosure, our client reserves the right to issue proceedings in the appropriate court without further notice and to seek costs sanctions for unreasonable conduct.'},
{id:'sign-off', heading:'',
 body:'Yours faithfully,\n\n**{{adviser.name}}**\nfor {{firm.name}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'pre-action-disclosure', name:'Pre-Action Disclosure Request (CPR 31.16)', version:'1.0',
 cobs:'CPR 31.16', kind:'pre-action',
 description:'Formal application for pre-action disclosure under CPR 31.16.',
 sections:[
{id:'header', heading:'Application for Pre-Action Disclosure',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate: {{today}}\n\n{{ctx.defendantName}}\n{{ctx.defendantAddress}}\n\nDear Sirs\n\n**Re: {{client.firstName}} {{client.lastName}} v {{ctx.defendantName}}**\n**Incident: {{case.incidentDate}} at {{case.incidentLocation}}**',
 requiredFields:['firm.name','case.ref','ctx.defendantName']},
{id:'preamble', heading:'',
 body:'This letter constitutes a formal request for **pre-action disclosure** pursuant to **section 33 of the Senior Courts Act 1981** and **CPR Part 31.16**. In the event of your failure or refusal to provide the documents listed within 14 days of receipt of this letter, our client will apply to the court for an order for disclosure with associated costs.'},
{id:'jurisdiction', heading:'1. Jurisdiction (CPR 31.16(3))', locked:true,
 body:'The court may order pre-action disclosure where:\n\n(a) the respondent is likely to be a party to subsequent proceedings;\n(b) the applicant is also likely to be a party;\n(c) if proceedings had started, the respondent\'s duty by way of standard disclosure under CPR 31.6 would extend to the documents sought; **and**\n(d) disclosure before proceedings have started is desirable in order to (i) dispose fairly of the anticipated proceedings, (ii) assist resolution without proceedings, or (iii) save costs.\n\nOur client contends that all four limbs are satisfied in this case.'},
{id:'parties-likely', heading:'2. Parties likely',
 body:'Both our client and {{ctx.defendantName}} are likely to be parties to subsequent proceedings concerning the incident on {{case.incidentDate}}, in respect of which {{ctx.locLikelyClaim}}.'},
{id:'documents-sought', heading:'3. Documents sought',
 body:'The following documents are sought:\n\n{{ctx.padDocumentsList}}\n\nWe contend that each falls within the scope of standard disclosure that would be ordered under CPR 31.6 in any subsequent proceedings.'},
{id:'desirability', heading:'4. Why disclosure is desirable',
 body:'Disclosure of the documents listed above before proceedings are issued is desirable because:\n\n- it will enable our client to assess the strength of the claim on liability and (if appropriate) to formulate further particulars of negligence;\n- it will allow our client and your client to engage in meaningful pre-action negotiation including ADR, and may dispose of the dispute without the costs of issue;\n- it will narrow the issues and reduce the costs of any subsequent proceedings.'},
{id:'costs', heading:'5. Costs',
 body:'In accordance with CPR 46.1(2) the general rule is that the court will award the respondent the costs of the application and of complying with any order made. Our client is content to pay the reasonable costs of complying with this request, on the assumption that you accede to it within 14 days. Should an application to the court be necessary, our client will invite the court to depart from the general rule, on the ground that voluntary disclosure has been unreasonably refused.'},
{id:'sign-off', heading:'',
 body:'Yours faithfully,\n\n**{{adviser.name}}**\nfor {{firm.name}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'part36-claimant', name:'Part 36 Offer · Claimant', version:'1.0',
 cobs:'CPR Part 36', kind:'offer',
 description:'Claimant Part 36 offer with 21-day relevant period and cost consequences.',
 sections:[
{id:'header', heading:'Part 36 Offer to Settle',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate: {{today}}\n\nTo: {{ctx.defendantSolicitorsName}}\n{{ctx.defendantSolicitorsAddress}}\n\nDear Sirs\n\n**Re: {{client.firstName}} {{client.lastName}} v {{ctx.defendantName}}**\n**Claim No: {{ctx.claimNumber}} (if issued)**\n\n**WITHOUT PREJUDICE SAVE AS TO COSTS**\n**OFFER MADE UNDER PART 36 OF THE CIVIL PROCEDURE RULES**',
 requiredFields:['firm.name','case.ref','client.firstName','client.lastName']},
{id:'preamble', heading:'',
 body:'This is a formal offer to settle made by the Claimant under **CPR Part 36**. It complies with the requirements of CPR 36.5(1):\n\n(a) it is in writing;\n(b) it makes clear it is made pursuant to Part 36;\n(c) it specifies the "relevant period" of not less than 21 days within which the Defendant will be liable for the Claimant\'s costs if the offer is accepted;\n(d) it states whether it relates to the whole of the claim or to part of it (or to an issue arising in it) and if so, to which part or issue; and\n(e) it states whether it takes into account any counterclaim.'},
{id:'offer', heading:'1. The Offer',
 body:'The Claimant offers to settle the whole of this claim, including interest, for the sum of **£{{ctx.p36ClaimantAmount}}** (the "Settlement Sum") inclusive of interest pursuant to section 35A of the Senior Courts Act 1981 or section 69 of the County Courts Act 1984.\n\nThe Settlement Sum is offered net of any sums recoverable by the Compensation Recovery Unit, which will remain the responsibility of the Defendant.'},
{id:'scope', heading:'2. Scope',
 body:'This offer relates to the **whole of the claim**. It takes into account, and is inclusive of, the entirety of the Claimant\'s pleaded damages (general and special) and interest. There is no counterclaim.'},
{id:'relevant-period', heading:'3. Relevant period',
 body:'The "relevant period" for the purposes of this offer is **21 days** beginning with the date this offer is received. If the offer is accepted within the relevant period, the Defendant will be liable for the Claimant\'s costs in accordance with CPR 36.13(1), to be assessed on the standard basis if not agreed.'},
{id:'cost-consequences', heading:'4. Cost consequences', locked:true,
 body:'**If the Defendant accepts within the relevant period (CPR 36.13(1)):** the Defendant pays the Claimant\'s costs up to the date of acceptance, assessed on the standard basis if not agreed.\n\n**If the Defendant does not accept and the Claimant equals or beats this offer at trial (CPR 36.17(4)):** unless unjust, the court will order:\n(a) interest on the whole or part of any sum of money (excluding interest) awarded, at a rate not exceeding 10% above base rate for some or all of the period starting with the date on which the relevant period expired;\n(b) costs (including any recoverable pre-action costs) on the indemnity basis from the date on which the relevant period expired;\n(c) interest on those costs at a rate not exceeding 10% above base rate; and\n(d) an additional amount, not exceeding £75,000, calculated as 10% of the first £500,000 of damages and 5% of the next £500,000.'},
{id:'cru', heading:'5. Compensation Recovery Unit',
 body:'The Settlement Sum is inclusive of all sums for past loss of earnings, past care, past treatment costs and past travel. Recoverable benefits under the Social Security (Recovery of Benefits) Act 1997 shall be deducted from the relevant heads of past loss before payment, in accordance with section 8 of that Act, and a CRU certificate will be obtained before settlement.'},
{id:'acceptance', heading:'6. Acceptance',
 body:'This offer may be accepted at any time (whether or not the Defendant has subsequently made a different offer), unless it has already been withdrawn or its terms have been changed, by serving written notice of acceptance on the Claimant\'s solicitors at the address above (CPR 36.11).'},
{id:'sign-off', heading:'',
 body:'Yours faithfully,\n\n**{{adviser.name}}**\nfor {{firm.name}}\nSolicitors / Authorised Representatives for the Claimant'}
]});
TEMPLATES_BUILTIN.push({
 id:'part36-defendant', name:'Part 36 Offer · Defendant', version:'1.0',
 cobs:'CPR Part 36', kind:'offer',
 description:'Defendant Part 36 offer (mirror) — 21-day relevant period, CPR 36.17(3) cost consequences.',
 sections:[
{id:'header', heading:'Part 36 Offer to Settle (Defendant)',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate: {{today}}\n\nTo: Claimant\'s Solicitors\n\n**Re: {{client.firstName}} {{client.lastName}} v {{ctx.defendantName}}**\n**Claim No: {{ctx.claimNumber}}**\n\n**WITHOUT PREJUDICE SAVE AS TO COSTS**\n**OFFER MADE UNDER PART 36 OF THE CIVIL PROCEDURE RULES**',
 requiredFields:['firm.name','case.ref']},
{id:'preamble', heading:'',
 body:'This is a formal offer to settle made by the Defendant under **CPR Part 36**, complying with CPR 36.5(1).'},
{id:'offer', heading:'1. The Offer',
 body:'The Defendant offers to settle the whole of this claim, inclusive of interest and net of CRU recoverable benefits, for the sum of **£{{ctx.p36DefendantAmount}}**, payable within 14 days of acceptance pursuant to CPR 36.14(6).'},
{id:'scope-rp', heading:'2. Scope and relevant period',
 body:'This offer relates to the **whole of the claim** and takes into account, and is inclusive of, the entirety of the Claimant\'s pleaded damages, interest and recoverable benefits.\n\nThe "relevant period" is **21 days** from the date of receipt. If accepted within that period, the Claimant\'s reasonable costs to the date of acceptance will be paid on the standard basis (CPR 36.13(1)).'},
{id:'cost-consequences', heading:'3. Cost consequences', locked:true,
 body:'**If the Claimant accepts within the relevant period (CPR 36.13(1)):** Defendant pays the Claimant\'s costs to date of acceptance, standard basis.\n\n**If the Claimant fails to accept and fails to obtain a judgment more advantageous than this offer (CPR 36.17(3)):** unless unjust, the court will order:\n(a) the Claimant to pay the Defendant\'s costs from the date on which the relevant period expired, with interest on those costs; and\n(b) the Claimant to pay interest on the costs at such rate as the court considers appropriate.\n\nNote that QOCS (CPR 44.13–17) may modify enforcement against a personal-injury claimant but does not prevent the cost order being made and enforced against any damages recovered.'},
{id:'acceptance', heading:'4. Acceptance',
 body:'This offer may be accepted by serving written notice on the Defendant\'s solicitors at the address above. The offer remains open until withdrawn in accordance with CPR 36.9 and may be withdrawn (after expiry of the relevant period) by service of written notice on the Claimant.'},
{id:'sign-off', heading:'',
 body:'Yours faithfully,\n\n**{{adviser.name}}**\nfor {{firm.name}}\nSolicitors / Authorised Representatives for the Defendant'}
]});
TEMPLATES_BUILTIN.push({
 id:'schedule-of-loss', name:'Schedule of Loss', version:'1.0',
 cobs:'CPR PD 16 para 4', kind:'quantum',
 description:'Itemised schedule of past + future losses with Ogden multipliers and interest.',
 sections:[
{id:'header', heading:'Schedule of Loss',
 body:'**In the County Court at {{ctx.courtName}}**\n**Claim No: {{ctx.claimNumber}}**\n\nBETWEEN:\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** — Claimant\n\nand\n\n**{{ctx.defendantName}}** — Defendant\n\n────────────────────────────────────\n**SCHEDULE OF LOSS**\n────────────────────────────────────\n\nDated: {{today}}',
 requiredFields:['client.firstName','client.lastName','case.ref']},
{id:'general-info', heading:'1. General information',
 body:'**Claimant\'s name:** {{client.firstName}} {{client.lastName}}\n**Date of birth:** {{client.dob}} (age at incident: {{ctx.ageAtIncident}}; age at trial: {{ctx.ageAtTrial}})\n**Date of incident:** {{case.incidentDate}}\n**Occupation at date of incident:** {{ctx.preIncidentOccupation}}\n**Net annual pre-incident earnings:** £{{ctx.preIncidentEarnings}}\n**Current occupation / status:** {{ctx.currentOccupation}}'},
{id:'general-damages', heading:'2. General damages (pain, suffering and loss of amenity)',
 body:'Based on the medical evidence and by reference to the **Judicial College Guidelines for the Assessment of General Damages in Personal Injury Cases** (current edition) the injury falls within:\n\n**Bracket:** {{ctx.jcBand}}\n**Range:** £{{ctx.jcLower}} — £{{ctx.jcUpper}}\n**Assessment:** **£{{ctx.jcAssessment}}**\n\nSupporting authorities and / or comparable awards: {{ctx.jcComparables}}'},
{id:'past-losses', heading:'3. Past pecuniary loss',
 body:'Past losses, calculated to {{today}}:\n\n{{ctx.pastLossesTable}}\n\n**Total past pecuniary loss: £{{ctx.totalPastLoss}}**'},
{id:'past-interest', heading:'4. Interest on past losses',
 body:'Interest on past general damages is claimed at **2% per annum** from the date of service of proceedings ({{ctx.dateOfService}}) to the date of trial ({{ctx.dateOfTrial}}): **£{{ctx.interestGeneral}}**.\n\nInterest on past special damages is claimed at **half the special account rate** from the date of incident to the date of trial: **£{{ctx.interestSpecial}}**.'},
{id:'future-losses', heading:'5. Future pecuniary loss',
 body:'Future losses are calculated using the **Ogden Tables (8th ed)** with a discount rate of **−0.25%**.\n\n**Future loss of earnings:**\n- Net annual loss: £{{ctx.futureNetAnnualLoss}}\n- Multiplier (Ogden Table {{ctx.ogdenTable}}, age {{ctx.ageAtTrial}}, retirement {{ctx.retirementAge}}): {{ctx.ogdenMultiplier}}\n- Reduction for non-earnings contingencies (Tables A–D): {{ctx.ogdenContingencyAdjustment}}\n- **Future loss of earnings: £{{ctx.futureLossOfEarnings}}**\n\n**Future loss of pension:** £{{ctx.futureLossOfPension}}\n\n**Future cost of care / aids / equipment:** £{{ctx.futureCareCost}} (multiplier {{ctx.careMultiplier}} per Ogden Table {{ctx.careOgdenTable}})\n\n**Future medical treatment:** £{{ctx.futureMedical}}\n\n**Future travel / transport adaptations:** £{{ctx.futureTravel}}\n\n**Total future pecuniary loss: £{{ctx.totalFutureLoss}}**'},
{id:'summary', heading:'6. Summary',
 body:'| Head of loss | Amount (£) |\n|---|---:|\n| General damages | {{ctx.jcAssessment}} |\n| Interest on general damages | {{ctx.interestGeneral}} |\n| Past pecuniary loss | {{ctx.totalPastLoss}} |\n| Interest on past special damages | {{ctx.interestSpecial}} |\n| Future pecuniary loss | {{ctx.totalFutureLoss}} |\n| **TOTAL CLAIM** | **{{ctx.scheduleTotal}}** |\n\nLess any sums recoverable by the Compensation Recovery Unit (CRU certificate to be obtained).'},
{id:'evidence', heading:'7. Evidence referenced',
 body:'The figures above are supported by:\n\n{{ctx.evidenceRefs}}'},
{id:'statement', heading:'8. Statement of truth',
 body:'I believe that the facts stated in this Schedule of Loss are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.\n\nSigned: ____________________________________\n\n**{{client.firstName}} {{client.lastName}}** (Claimant)\n\nDate: ________________'}
]});
TEMPLATES_BUILTIN.push({
 id:'witness-statement', name:'Witness Statement (CPR 32 / PD 32)', version:'1.0',
 cobs:'CPR 32 · PD 32', kind:'evidence',
 description:'First-person numbered-paragraph witness statement with statement of truth.',
 sections:[
{id:'header', heading:'Witness Statement',
 body:'**In the County Court at {{ctx.courtName}}**\n**Claim No: {{ctx.claimNumber}}**\n\n**ON BEHALF OF: The Claimant**\n**WITNESS: {{ctx.witnessName}}**\n**STATEMENT NUMBER: {{ctx.witnessStatementNumber}}**\n**EXHIBITS REFERRED TO: {{ctx.witnessExhibitRefs}}**\n**DATE: {{today}}**\n\nBETWEEN:\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** — Claimant\n\nand\n\n**{{ctx.defendantName}}** — Defendant\n\n────────────────────────────────────\n**WITNESS STATEMENT OF {{ctx.witnessNameUpper}}**\n────────────────────────────────────',
 requiredFields:['client.firstName','client.lastName','case.ref','ctx.witnessName']},
{id:'introduction', heading:'',
 body:'I, **{{ctx.witnessName}}**, of {{ctx.witnessAddress}}, {{ctx.witnessOccupation}}, WILL SAY AS FOLLOWS:\n\n1. I am the {{ctx.witnessRelationToClaimant}} in this matter. The facts and matters set out in this statement are within my own knowledge, save where I indicate the source of my information or belief, in which case the information is true to the best of my knowledge and belief.\n\n2. I make this statement in support of the Claimant\'s claim against the Defendant arising out of an incident which occurred on **{{case.incidentDate}}** at **{{case.incidentLocation}}**.\n\n3. There is now produced and shown to me a paginated bundle of documents marked "**{{ctx.witnessExhibitRefs}}**" to which I refer in this statement.'},
{id:'background', heading:'Background',
 body:'4. {{ctx.witnessParaBackground1}}\n\n5. {{ctx.witnessParaBackground2}}'},
{id:'incident', heading:'The incident',
 body:'6. {{ctx.witnessParaIncident1}}\n\n7. {{ctx.witnessParaIncident2}}\n\n8. {{ctx.witnessParaIncident3}}'},
{id:'aftermath', heading:'Aftermath and injuries',
 body:'9. {{ctx.witnessParaAftermath1}}\n\n10. {{ctx.witnessParaAftermath2}}'},
{id:'impact', heading:'Continuing impact',
 body:'11. {{ctx.witnessParaImpact1}}\n\n12. {{ctx.witnessParaImpact2}}'},
{id:'statement-of-truth', heading:'Statement of Truth', locked:true,
 body:'I believe that the facts stated in this witness statement are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.\n\nSigned: ____________________________________\n\n**{{ctx.witnessName}}**\n\nDated: ________________'}
]});
TEMPLATES_BUILTIN.push({
 id:'instructions-to-expert', name:'Instructions to Expert (CPR 35)', version:'1.0',
 cobs:'CPR 35 · PD 35', kind:'expert',
 description:'Letter of instruction to single joint or party-appointed expert under CPR 35.',
 sections:[
{id:'header', heading:'Letter of Instruction to Expert',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate: {{today}}\n\n{{ctx.expertName}}\n{{ctx.expertAddress}}\n\nDear {{ctx.expertSalutation}}\n\n**Re: {{client.firstName}} {{client.lastName}}**\n**Date of incident: {{case.incidentDate}}**\n**Claim No (if issued): {{ctx.claimNumber}}**',
 requiredFields:['firm.name','case.ref','client.firstName','ctx.expertName']},
{id:'instruction-type', heading:'1. Nature of your instruction',
 body:'You are instructed as **{{ctx.expertInstructionType}}** (delete as applicable: Single Joint Expert / Expert for the Claimant / Expert for the Defendant) to provide a report dealing with the matters set out below. {{ctx.expertSJEParagraph}}'},
{id:'scope', heading:'2. Scope of the report',
 body:'You are asked to prepare a written report addressing:\n\n{{ctx.expertScopeList}}\n\nThe report must be addressed to the Court and not to any party, and must comply in form and content with **CPR Part 35**, **Practice Direction 35** and the **Guidance for the Instruction of Experts in Civil Claims** (2014 as updated).'},
{id:'overriding-duty', heading:'3. Your overriding duty', locked:true,
 body:'**CPR 35.3** provides that your duty as an expert is to **help the court on the matters within your expertise**. This duty **overrides any obligation to the person from whom you receive instructions or by whom you are paid**. You must therefore exercise independent judgment and must not act as an advocate for any party.\n\nYour report must state any qualifications, must distinguish facts from opinion, and must state the substance of all material instructions whether written or oral. The complete instructions are not privileged from disclosure (CPR 35.10(4)).'},
{id:'documents-enclosed', heading:'4. Documents enclosed',
 body:'We enclose, for your consideration, the following:\n\n{{ctx.expertDocumentsList}}'},
{id:'questions', heading:'5. Specific questions',
 body:'In your report please address, in particular:\n\n{{ctx.expertQuestionsList}}'},
{id:'fee-time', heading:'6. Fee and timing',
 body:'**Agreed fee:** £{{ctx.expertFee}} (plus VAT and reasonable disbursements).\n**Required by:** {{ctx.expertDeadline}}.\n\nIf you anticipate that you will not be able to meet the deadline, please notify us immediately.\n\nWhere you are instructed as Single Joint Expert, your fee will be paid in equal shares by the parties unless the court directs otherwise (CPR 35.8(5)).'},
{id:'declaration', heading:'7. Required declaration', locked:true,
 body:'Your report must contain the following Statement of Truth required by PD 35 §3.3:\n\n"I confirm that I have made clear which facts and matters referred to in this report are within my own knowledge and which are not. Those that are within my own knowledge I confirm to be true. The opinions I have expressed represent my true and complete professional opinions on the matters to which they refer. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth."'},
{id:'sign-off', heading:'',
 body:'Yours sincerely,\n\n**{{adviser.name}}**\nfor {{firm.name}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'complaints-notice', name:'Complaints Procedure Notice', version:'1.0',
 cobs:'DISP / FOS · Legal Ombudsman', kind:'notice',
 description:'Mandatory notice setting out the firm complaints process and the FOS / Legal Ombudsman route.',
 sections:[
{id:'header', heading:'Complaints Procedure',
 body:'**{{firm.name}}** is committed to providing a high-quality service. If at any time you are unhappy with any aspect of the service you have received, we want you to tell us so that we can put matters right and improve.\n\nThis notice sets out the procedure to be followed.\n\nDate of notice: {{today}}'},
{id:'how-to-complain', heading:'1. How to make a complaint',
 body:'Please send your complaint in writing to:\n\n**Complaints Officer**\n{{firm.name}}\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\nEmail: complaints@{{ctx.firmDomain}}\n\nPlease include:\n- your name and contact details;\n- our file or case reference (if known);\n- a clear summary of what has gone wrong;\n- what you would like us to do to put matters right.'},
{id:'what-happens-next', heading:'2. What happens next',
 body:'**Within 3 working days:** we will send written acknowledgment of your complaint and confirm who is handling it.\n\n**Within 4 weeks:** we will send either (a) a final response, or (b) a holding response explaining why we cannot give a final response and indicating when we will be able to.\n\n**Within 8 weeks:** we will send a final response. If we cannot do so we will write to you explaining why and confirm your right to refer the matter to the Ombudsman.'},
{id:'fos', heading:'3. Financial Ombudsman Service (CMR firms · FCA-regulated)', locked:true,
 body:'If you are not satisfied with our final response, or we have failed to respond within 8 weeks, you may refer your complaint to the **Financial Ombudsman Service**:\n\n- Address: Exchange Tower, London E14 9SR\n- Telephone: 0800 023 4567 (free from mobiles and landlines)\n- Email: complaint.info@financial-ombudsman.org.uk\n- Website: www.financial-ombudsman.org.uk\n\nYou must refer your complaint to the FOS **within 6 months of our final response**. The FOS provides an impartial and free service for eligible complainants.'},
{id:'legal-ombudsman', heading:'4. Legal Ombudsman (solicitors)', locked:true,
 body:'Where this firm is acting as a solicitor practice and the complaint relates to legal service, you may refer the complaint to the **Legal Ombudsman**:\n\n- Address: PO Box 6167, Slough SL1 0EH\n- Telephone: 0300 555 0333\n- Email: enquiries@legalombudsman.org.uk\n- Website: www.legalombudsman.org.uk\n\nReferral must be made within **6 months** of our final response and within **1 year** from the act or omission complained of (or 1 year from when you should reasonably have known).'},
{id:'sra-fca', heading:'5. Reporting professional misconduct', locked:true,
 body:'If your complaint concerns the professional conduct of an individual (rather than the quality of service), you may report the matter to:\n\n- The **Solicitors Regulation Authority** for solicitor firms — www.sra.org.uk\n- The **Financial Conduct Authority** for FCA-regulated CMC firms — www.fca.org.uk\n\nThese routes are in addition to (not in place of) the Ombudsman route described above.'}
]});
TEMPLATES_BUILTIN.push({
 id:'cooling-off-confirmation', name:'Cooling-off Confirmation (14 days)', version:'1.0',
 cobs:'Consumer Contracts Regulations 2013', kind:'notice',
 description:'Issued at point of CMR sign-up where client retains the 14-day cooling-off period.',
 sections:[
{id:'header', heading:'Cooling-off Period · Confirmation',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate of agreement: {{ctx.coolingOffStart}}\n\nDear {{client.title}} {{client.lastName}},'},
{id:'rights', heading:'Your 14-day right to cancel', locked:true,
 body:'Under the **Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013**, because the agreement between us was entered into off-premises or at a distance, you have the right to cancel this contract **within 14 days** without giving any reason and without paying any cancellation charge.\n\n**The cancellation period will expire on: {{ctx.coolingOffEnd}}**\n\nTo exercise your right to cancel, you must inform us by a clear statement (for example, a letter sent by post or email) at:\n\n**{{firm.name}}, {{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}**\nEmail: {{ctx.firmEmail}}\n\nYou may use the model cancellation form below, but it is not obligatory.'},
{id:'effect', heading:'Effects of cancellation',
 body:'If you cancel within the 14-day period, we will reimburse all payments received from you (other than for any services actually provided to you at your express prior request) without undue delay and in any event not later than 14 days after the day on which we are informed of your decision to cancel.\n\nNo services will be provided during the cancellation period unless you specifically request otherwise (see Cooling-off Waiver).'},
{id:'model-form', heading:'Model cancellation form',
 body:'(complete and return this form only if you wish to cancel this contract)\n\nTo: {{firm.name}}, {{firm.registeredAddress.line1}}, {{firm.registeredAddress.postcode}}\n\nI/We [*] hereby give notice that I/We [*] cancel my/our [*] contract for the supply of the following service: claims management / legal services in respect of case ref **{{case.ref}}**.\n\nDate the contract was concluded: ____________________________________\n\nName of consumer(s): ____________________________________\n\nAddress of consumer(s): ____________________________________\n\nSignature of consumer(s) (only if this form is notified on paper): ____________________________________\n\nDate: ________________\n\n[*] delete as appropriate.'},
{id:'sign-off', heading:'',
 body:'Yours sincerely,\n\n**{{adviser.name}}**\nfor {{firm.name}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'cooling-off-waiver', name:'Cooling-off Waiver (Express)', version:'1.0',
 cobs:'Consumer Contracts Regulations 2013 reg 36', kind:'notice',
 description:'Used only where the client expressly requests service to start within the cooling-off period and acknowledges loss of cancellation rights.',
 sections:[
{id:'header', heading:'Express Request and Cooling-off Acknowledgment',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nClient: {{client.title}} {{client.firstName}} {{client.lastName}}\nDate of agreement: {{ctx.coolingOffStart}}\nDate of this acknowledgment: {{today}}'},
{id:'background', heading:'1. Background',
 body:'You signed our Client Agreement on {{ctx.coolingOffStart}}. By virtue of the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 you have, as a starting position, **14 days from that date in which to cancel** the agreement without giving any reason.\n\nYou have asked us to begin work on your claim **immediately**, and before the end of that 14-day period.'},
{id:'effect', heading:'2. Effect of this request', locked:true,
 body:'Under regulation 36 of the 2013 Regulations:\n\n(a) we are not permitted to begin performance of the service during the cancellation period unless you make an **express request** that we do so, on a **durable medium**;\n\n(b) if you make such a request and **subsequently cancel** within the 14-day period, you remain liable to pay us an amount which is in proportion to what has been supplied up to the time you communicated the cancellation — calculated on the basis of the total price agreed;\n\n(c) if you make such a request and the service is **fully performed** during the cancellation period, **you will lose the right to cancel** once the service has been fully performed.'},
{id:'declaration', heading:'3. My express request',
 body:'I, **{{client.title}} {{client.firstName}} {{client.lastName}}**, confirm that:\n\n- I have read and understood the 14-day cooling-off rights set out in the Confirmation of Cooling-off provided to me; and\n- I expressly request that {{firm.name}} begin work on my claim **immediately**, before the end of the 14-day cancellation period; and\n- I understand that if I subsequently cancel within the 14 days, I will pay for any work reasonably done on a proportionate basis; and\n- I understand that if the work is fully completed within the 14 days I will lose my right to cancel.\n\nReason for the request to start immediately: {{ctx.coolingOffWaiverReason}}\n\n[SIGNATURE_BLOCK]'}
]});
TEMPLATES_BUILTIN.push({
 id:'disengagement-letter', name:'Disengagement Letter', version:'1.0',
 cobs:'SRA / CMR conduct', kind:'closure',
 description:'Firm withdraws from the retainer. Sets out reasons, file-handling, costs and time-limit warnings.',
 sections:[
{id:'header', heading:'Disengagement Letter',
 body:'**{{firm.name}}**\nOur Ref: {{case.ref}}\nDate: {{today}}\n\n{{client.title}} {{client.firstName}} {{client.lastName}}\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\nDear {{client.title}} {{client.lastName}},\n\n**Re: Your claim arising from the incident on {{case.incidentDate}}**'},
{id:'withdrawal', heading:'1. Notice of withdrawal',
 body:'We write to give you formal notice that, with effect from **{{ctx.disengagementEffectiveDate}}**, we will no longer be acting for you in connection with the above claim.\n\nThe reason for our decision is: {{ctx.disengagementReason}}\n\nWe appreciate that this news will be unwelcome and we are providing the information below to enable you to take immediate steps to protect your position.'},
{id:'limitation', heading:'2. Time limits — URGENT', locked:true,
 body:'Important: your claim is subject to **limitation periods**, after which it may no longer be possible to issue proceedings. In particular:\n\n- Personal injury: **3 years** from the date of the incident or the date of knowledge (whichever is later).\n- Contract / general civil claims: **6 years** from the date of the cause of action.\n- Clinical negligence: **3 years** from the date of the act/omission or knowledge.\n\nThe earliest applicable limitation date for your claim is on or before **{{ctx.limitationDate}}**.\n\nIf proceedings are not properly issued before that date, your claim may be statute-barred and you will not be able to pursue it. We strongly recommend that you instruct alternative solicitors / representatives **without delay**.'},
{id:'file', heading:'3. Your file',
 body:'Your file will be made available for collection from our office, or for transfer to alternative solicitors, upon your written request. We will release the file to incoming solicitors against an undertaking in usual form regarding our costs.\n\nWe retain the original signed Client Agreement, ID documents, and any documents subject to a solicitor\'s lien for unpaid costs (if any). All client property held will be returned promptly.'},
{id:'costs', heading:'4. Costs to date',
 body:'Our costs to date are summarised below:\n\n- Basic charges (time spent): £{{ctx.disengagementBasicCharges}}\n- Disbursements (incurred + paid): £{{ctx.disengagementDisbursements}}\n- VAT (where applicable): £{{ctx.disengagementVat}}\n- **Total: £{{ctx.disengagementTotal}}**\n\nWhere a Conditional Fee Agreement or Damages-Based Agreement is in place, our entitlement to charge depends upon the terms of that agreement and the reason for termination. Please refer to clauses 8 and 9 of the CFA / clause 5 of the DBA. {{ctx.disengagementCostsBasis}}'},
{id:'complaints', heading:'5. Right to complain', locked:true,
 body:'If you are dissatisfied with our decision to disengage, please refer to our **Complaints Procedure** and ultimately the **Financial Ombudsman Service** (CMR) or **Legal Ombudsman** (solicitors) — contact details on file. The relevant referral time-limit is 6 months from our final response.'},
{id:'sign-off', heading:'',
 body:'Yours sincerely,\n\n**{{adviser.name}}**\nfor {{firm.name}}'}
]});
TEMPLATES_BUILTIN.push({
 id:'bill-of-costs', name:'Bill of Costs (inter-partes)', version:'1.0',
 cobs:'CPR 47 · Precedent S / N', kind:'costs',
 description:'Inter-partes bill of costs for detailed assessment (summary precedent narrative form).',
 sections:[
{id:'header', heading:'Bill of Costs',
 body:'**In the County Court at {{ctx.courtName}}**\n**Claim No: {{ctx.claimNumber}}**\n\nBETWEEN:\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** — Claimant (Receiving Party)\n\nand\n\n**{{ctx.defendantName}}** — Defendant (Paying Party)\n\n────────────────────────────────────\n**BILL OF COSTS OF THE CLAIMANT**\nfor assessment on the **{{ctx.billBasis}}** basis (standard / indemnity)\n────────────────────────────────────\n\nDated: {{today}}'},
{id:'background', heading:'1. Background',
 body:'1.1 This bill of costs is filed pursuant to the order of {{ctx.billOrderingJudge}} dated {{ctx.billOrderDate}}, which provided that the Defendant pay the Claimant\'s costs of the claim to be subject to detailed assessment if not agreed.\n\n1.2 The claim arose out of the incident on {{case.incidentDate}}. {{case.description}}\n\n1.3 Proceedings were issued on {{ctx.dateOfIssue}} and concluded on {{ctx.dateConcluded}} by {{ctx.billHowConcluded}}.'},
{id:'rates', heading:'2. Rates and fee-earners',
 body:'Work was undertaken by the following fee-earners at the rates indicated (Guideline Hourly Rates {{ctx.ghrYear}}):\n\n| Fee earner | Grade | Hourly rate (£) |\n|---|---|---:|\n| {{ctx.feNameA}} | A | {{ctx.cfaRatePartner}} |\n| {{ctx.feNameB}} | B | {{ctx.cfaRateSenior}} |\n| {{ctx.feNameC}} | C | {{ctx.cfaRateSolicitor}} |\n| {{ctx.feNameD}} | D | {{ctx.cfaRateParalegal}} |'},
{id:'profit-costs', heading:'3. Profit costs',
 body:'Profit costs are claimed in respect of the following phases (Precedent H / J alignment):\n\n| Phase | Time recorded (hr) | £ |\n|---|---:|---:|\n| Pre-action | {{ctx.billHrsPreAction}} | {{ctx.billCostsPreAction}} |\n| Issue / pleadings | {{ctx.billHrsPleadings}} | {{ctx.billCostsPleadings}} |\n| CMC | {{ctx.billHrsCMC}} | {{ctx.billCostsCMC}} |\n| Disclosure | {{ctx.billHrsDisclosure}} | {{ctx.billCostsDisclosure}} |\n| Witness statements | {{ctx.billHrsWitness}} | {{ctx.billCostsWitness}} |\n| Expert reports | {{ctx.billHrsExpert}} | {{ctx.billCostsExpert}} |\n| Trial preparation | {{ctx.billHrsTrialPrep}} | {{ctx.billCostsTrialPrep}} |\n| Trial / settlement | {{ctx.billHrsTrial}} | {{ctx.billCostsTrial}} |\n| **Profit costs total** | **{{ctx.billTotalHours}}** | **{{ctx.billProfitCostsTotal}}** |'},
{id:'disbursements', heading:'4. Disbursements',
 body:'| Item | £ |\n|---|---:|\n| Court fees | {{ctx.disbCourtFees}} |\n| Counsel\'s fees | {{ctx.disbCounsel}} |\n| Medical reports | {{ctx.disbMedical}} |\n| Expert reports | {{ctx.disbExpert}} |\n| Medical records | {{ctx.disbRecords}} |\n| Travel | {{ctx.disbTravel}} |\n| Other | {{ctx.disbOther}} |\n| **Disbursements total** | **{{ctx.disbTotal}}** |'},
{id:'summary', heading:'5. Summary',
 body:'| | £ |\n|---|---:|\n| Profit costs | {{ctx.billProfitCostsTotal}} |\n| Disbursements | {{ctx.disbTotal}} |\n| Sub-total | {{ctx.billSubTotal}} |\n| VAT @ 20% on chargeable items | {{ctx.billVat}} |\n| **TOTAL BILL** | **{{ctx.billGrandTotal}}** |'},
{id:'certificate', heading:'6. Certificate',
 body:'I certify that this bill is a true statement of the costs incurred by the Receiving Party in this matter, and that the figures are accurate and have been calculated correctly. Indemnity principle: the costs claimed do not exceed the costs which the Receiving Party is liable to pay to the Solicitor.\n\nSigned: ____________________________________\n\n**{{adviser.name}}**, Solicitor for the Claimant\n\nDate: ________________'}
]});
TEMPLATES_BUILTIN.push({
 id:'n1-particulars', name:'N1 Claim Form · Particulars of Claim (narrative)', version:'1.0',
 cobs:'CPR 7 · CPR 16 · PD 16', kind:'pleading',
 description:'Informational narrative of the Particulars of Claim section used with the N1 form.',
 sections:[
{id:'header', heading:'Particulars of Claim',
 body:'**In the County Court at {{ctx.courtName}}**\n**Claim No: {{ctx.claimNumber}}** (to be issued)\n\nBETWEEN:\n\n**{{client.title}} {{client.firstName}} {{client.lastName}}** — Claimant\n\nand\n\n**{{ctx.defendantName}}** — Defendant\n\n────────────────────────────────────\n**PARTICULARS OF CLAIM**\n────────────────────────────────────'},
{id:'parties', heading:'1. The parties',
 body:'1.1 The Claimant is {{client.title}} {{client.firstName}} {{client.lastName}}, an individual residing at {{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}.\n\n1.2 The Defendant is {{ctx.defendantName}}, of {{ctx.defendantAddress}}, {{ctx.defendantStatus}}.'},
{id:'incident', heading:'2. The incident',
 body:'2.1 On **{{case.incidentDate}}** at **{{case.incidentLocation}}**, the following occurred:\n\n{{case.description}}\n\n2.2 {{ctx.locFactualNarrative}}'},
{id:'duty', heading:'3. Duty of care / statutory duty',
 body:'3.1 At all material times the Defendant owed to the Claimant a duty {{ctx.dutyOfCareStatement}}.\n\n3.2 {{ctx.statutoryDutyStatement}}'},
{id:'breach-particulars', heading:'4. Particulars of breach / negligence',
 body:'4.1 The Defendant was in breach of the duty pleaded above. The Particulars of Negligence are:\n\n{{ctx.locAllegationsList}}\n\n4.2 The Claimant will rely upon **res ipsa loquitur** where appropriate {{ctx.resIpsaLoquiturNote}}.'},
{id:'causation', heading:'5. Causation',
 body:'5.1 By reason of the matters aforesaid, the Claimant has suffered injury, loss and damage.\n\n5.2 But for the Defendant\'s breach of duty, the Claimant would not have sustained the injuries and consequential losses set out below.'},
{id:'injury', heading:'6. Particulars of injury',
 body:'6.1 As a result of the incident the Claimant sustained the injuries set out in the medical report of {{ctx.medicalReportAuthor}} dated {{ctx.medicalReportDate}}, served herewith.\n\n6.2 Brief particulars: {{ctx.injurySummary}}\n\n6.3 The Claimant\'s date of birth is {{client.dob}}.'},
{id:'special-damages', heading:'7. Particulars of special damages',
 body:'7.1 Special damages are pleaded in the Schedule of Loss served herewith.\n\n7.2 Summary:\n\n{{ctx.specialDamagesSummary}}'},
{id:'interest', heading:'8. Interest',
 body:'8.1 The Claimant claims interest pursuant to **section 69 of the County Courts Act 1984** (or section 35A of the Senior Courts Act 1981 where applicable) on such damages as may be awarded, at such rate and for such period as the Court thinks fit.'},
{id:'prayer', heading:'AND THE CLAIMANT CLAIMS:',
 body:'(1) Damages limited to £{{ctx.statementOfValue}};\n(2) Interest pursuant to statute;\n(3) Costs;\n(4) Such further or other relief as the Court thinks fit.'},
{id:'statement-of-truth', heading:'Statement of Truth', locked:true,
 body:'I believe that the facts stated in these Particulars of Claim are true. The Claimant understands that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.\n\nFull name: ____________________________________\n\nSigned: ____________________________________\n\nPosition (if signing on behalf of Claimant): ____________________________________\n\nDate: ________________'}
]});
function mergeTemplates(customs){
 const map=new Map();
 for(const t of TEMPLATES_BUILTIN)map.set(t.id,JSON.parse(JSON.stringify(t)));
 for(const c of customs||[]){
 const base=map.get(c.id);
 if(!base){map.set(c.id,c);continue}
 if(c.sectionOverrides){
 for(const sec of base.sections){
 if(sec.locked)continue;
 if(c.sectionOverrides[sec.id]!=null)sec.body=c.sectionOverrides[sec.id];
 }
 }
 base._custom=true;
 }
 return Array.from(map.values());
}
// ════════════════════════════════════════════════════════════════
// INTERPOLATION & RENDERING
// ════════════════════════════════════════════════════════════════
function getPath(obj,path){
 if(obj==null)return undefined;
 const parts=path.split('.');
 let cur=obj;
 for(const p of parts){if(cur==null)return undefined;cur=cur[p]}
 return cur;
}
function age(dob){
 if(!dob)return '';
 const b=new Date(dob);if(isNaN(b))return '';
 const t=new Date();
 let a=t.getFullYear()-b.getFullYear();
 const m=t.getMonth()-b.getMonth();
 if(m<0||(m===0&&t.getDate()<b.getDate()))a--;
 return a;
}
function ageAt(dob,when){
 if(!dob||!when)return '';
 const b=new Date(dob),t=new Date(when);if(isNaN(b)||isNaN(t))return '';
 let a=t.getFullYear()-b.getFullYear();
 const m=t.getMonth()-b.getMonth();
 if(m<0||(m===0&&t.getDate()<b.getDate()))a--;
 return a;
}
function fmtDateStr(s){if(!s)return '';const d=new Date(s);if(isNaN(d))return s;return d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
function addDays(d,n){const t=new Date(d);t.setDate(t.getDate()+n);return t}
function buildContext(clientId,caseId,extra){
 const client=state.clients.find(c=>c.id===clientId)||{};
 const kase=state.cases.find(k=>k.id===caseId)||{};
 const firm=state.firm||{};
 const adviser=state.advisers.find(a=>a.id===(client.adviserId||kase.responsibleHandlerId||state.ui.activeAdviserId))||{name:'(unassigned handler)',phone:'',email:''};
 const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
 const clientCopy=JSON.parse(JSON.stringify(client));
 clientCopy.age=age(client.dob);
 if(client.dob&&client.address)clientCopy.address.line2=client.address.line2||'';
 // case copy with display-friendly date
 const caseCopy=JSON.parse(JSON.stringify(kase));
 if(caseCopy.incidentDate)caseCopy.incidentDate=fmtDateStr(caseCopy.incidentDate);
 caseCopy.cfaSuccessFeePct=caseCopy.cfaSuccessFeePct||100;
 caseCopy.cfaCappedDamagesPct=caseCopy.cfaCappedDamagesPct||25;
 caseCopy.dbaPct=caseCopy.dbaPct||50;
 // defendants list
 const defs=(kase.liability&&kase.liability.defendantsIdentified)||[];
 const firstDef=defs[0]||{};
 const defendantsList=defs.length?defs.map(d=>d.name+(d.insurer?' (insured by '+d.insurer+')':'')+(d.role?' — '+d.role:'')).join('; '):'the Defendant';
 // pre-action deadline
 const protMap={'pre-action-pi':21,'pre-action-clinical-neg':120,'rta-portal':30,'el-pl-portal':30};
 const dayDelta=protMap[kase.protocol]||21;
 const responseDeadline=fmtDateStr(addDays(new Date(),dayDelta).toISOString());
 // special-damages summary list
 const sds=(kase.valuation&&kase.valuation.specialDamages)||[];
 const specialDamagesSummary=sds.length?sds.map(s=>'- **'+s.category+'**: £'+fmt(s.amount)+(s.evidenceRefs&&s.evidenceRefs.length?' (refs: '+s.evidenceRefs.join(', ')+')':'')).join('\n'):'- Loss of earnings to date — TBC\n- Medical expenses — TBC\n- Care and assistance — TBC\n- Travel expenses — TBC';
 // past-loss table from special damages
 let pastLossesTable='| Head of loss | £ |\n|---|---:|';
 let pastTotal=0;
 if(sds.length){sds.forEach(s=>{pastTotal+=+s.amount||0;pastLossesTable+='\n| '+s.category+' | '+fmt(s.amount||0)+' |'});pastLossesTable+='\n| **Total** | **'+fmt(pastTotal)+'** |'}
 else{pastLossesTable+='\n| Loss of earnings to date | TBC |\n| Medical expenses | TBC |\n| Travel | TBC |\n| Care | TBC |\n| **Total** | **TBC** |'}
 // jc band
 const jc=(kase.valuation&&kase.valuation.generalDamages)||{};
 // valuation override from fallclaim mesh
 const valOverride=(state.ui.valuationFromFallClaim&&state.ui.valuationFromFallClaim.caseId===kase.id)?state.ui.valuationFromFallClaim:{};
 const ageAtIncident=kase.incidentDate?ageAt(client.dob,kase.incidentDate):age(client.dob);
 const ctxDefault={
 // CFA rates (GHR 2024 London band 1 rough mids — firms override)
 cfaRatePartner:'373',cfaRateSenior:'289',cfaRateSolicitor:'244',cfaRateParalegal:'139',
 cfaAteRecommendation:'do',
 cfaAtePremium:'TBC (quote to follow)',
 // letter-of-claim
 defendantName:firstDef.name||'(Defendant Name)',
 defendantAddress:firstDef.address||'(Defendant address)',
 defendantInsurerLine:firstDef.insurer?', insured by '+firstDef.insurer+(firstDef.refNumber?' (insurer ref '+firstDef.refNumber+')':''):'',
 defendantsList,
 defendantSolicitorsName:'(Defendant\'s Solicitors)',
 defendantSolicitorsAddress:'(Address)',
 defendantStatus:'(a company / individual / partnership) of the same address',
 locFactualNarrative:'The Claimant relies on the contemporaneous documents and witness evidence in support of the narrative above.',
 locAllegationsList:'- failing to take reasonable care for the safety of the Claimant;\n- failing to provide and / or maintain a safe system of work / premises / road / equipment;\n- failing to identify and act upon foreseeable risk of injury;\n- failing to comply with applicable statutory duty (see particulars).',
 injurySummary:'(injury summary — to be supplemented by medical report)',
 medicalEvidenceStatus:'is in the process of being medically examined',
 specialDamagesSummary,
 documentsRequestedList:'- accident book / incident report entries;\n- CCTV / dashcam footage covering the incident;\n- contemporaneous photographs;\n- risk assessments and method statements (EL claims);\n- maintenance records;\n- insurance details;\n- witness statements;\n- any internal investigation report.',
 responseDeadline,
 locOfferAmount:(kase.valuation&&kase.valuation.totalEstimate)||'TBC',
 // pre-action disclosure
 padDocumentsList:'- accident / incident report;\n- risk assessment and method statement;\n- maintenance and inspection records for the relevant equipment / premises;\n- CCTV footage covering the incident;\n- any insurance certificate or policy schedule;\n- any internal communications relating to the incident.',
 locLikelyClaim:'the Claimant\'s claim arises from personal injury caused by alleged breach of duty by the prospective respondent',
 // part 36
 p36ClaimantAmount:(kase.valuation&&kase.valuation.totalEstimate)||'TBC',
 p36DefendantAmount:'TBC',
 claimNumber:kase.portalRef||'(not yet issued)',
 // schedule of loss
 courtName:'(Court)',
 ageAtIncident,
 ageAtTrial:age(client.dob),
 preIncidentOccupation:'(occupation)',
 preIncidentEarnings:'(net annual earnings)',
 currentOccupation:'(current)',
 jcBand:jc.injuryBand||valOverride.jcBand||'(JC bracket)',
 jcLower:jc.lower||valOverride.jcLower||0,
 jcUpper:jc.upper||valOverride.jcUpper||0,
 jcAssessment:jc.assessment||valOverride.jcAssessment||0,
 jcComparables:'(comparable awards to be cited)',
 pastLossesTable,
 totalPastLoss:fmt(pastTotal||0),
 dateOfService:'(date of service)',
 dateOfTrial:'(date of trial)',
 interestGeneral:'TBC',
 interestSpecial:'TBC',
 ogdenTable:'4',
 ogdenMultiplier:'TBC',
 ogdenContingencyAdjustment:'TBC',
 futureNetAnnualLoss:'0',
 futureLossOfEarnings:'TBC',
 futureLossOfPension:'TBC',
 futureCareCost:'TBC',
 careMultiplier:'TBC',
 careOgdenTable:'28',
 futureMedical:'TBC',
 futureTravel:'TBC',
 totalFutureLoss:'TBC',
 scheduleTotal:fmt(kase.valuation&&kase.valuation.totalEstimate||0),
 evidenceRefs:'- Medical report of (Author) dated (Date)\n- Wage slips for 12 months pre- and post-incident\n- Receipts bundle (medical / travel / care)\n- Witness statements served herewith',
 // witness
 witnessName:client.firstName?(client.firstName+' '+client.lastName):'(Witness Name)',
 witnessNameUpper:(client.firstName?(client.firstName+' '+client.lastName):'(WITNESS NAME)').toUpperCase(),
 witnessAddress:client.address?(client.address.line1+', '+client.address.city+', '+client.address.postcode):'(address)',
 witnessOccupation:'(occupation)',
 witnessRelationToClaimant:'Claimant',
 witnessStatementNumber:'1',
 witnessExhibitRefs:'CL/1',
 witnessParaBackground1:'(set out background — context, where you were, why)',
 witnessParaBackground2:'(further background as required)',
 witnessParaIncident1:'(describe the incident in chronological order — what happened, when, who was present)',
 witnessParaIncident2:'(continue chronological narrative)',
 witnessParaIncident3:'(refer to exhibits where relevant: "I refer to the photograph at page X of CL/1")',
 witnessParaAftermath1:'(immediate aftermath — emergency services, first aid, hospital attendance)',
 witnessParaAftermath2:'(initial medical treatment)',
 witnessParaImpact1:'(continuing physical and psychological impact)',
 witnessParaImpact2:'(impact on work, family life, hobbies)',
 // expert
 expertName:'(Expert Name)',
 expertAddress:'(Expert address)',
 expertSalutation:'(Dr / Mr / Ms)',
 expertInstructionType:'Expert for the Claimant',
 expertSJEParagraph:'Where you are instructed as a Single Joint Expert, you are also receiving these instructions from the Defendant\'s solicitors and must treat both parties even-handedly.',
 expertScopeList:'1. The diagnosis, prognosis and treatment of the Claimant\'s injuries;\n2. Causation — whether the injuries are attributable to the incident on '+(caseCopy.incidentDate||'(date)')+';\n3. The Claimant\'s capacity to work and any restrictions on activities of daily living;\n4. The need for and cost of any future treatment, care, aids or equipment.',
 expertDocumentsList:'- our Letter of Claim and the Defendant\'s Response (or denial);\n- the Claimant\'s GP and hospital records;\n- any previous reports;\n- the Claimant\'s witness statement.',
 expertQuestionsList:'1. What is your diagnosis of the Claimant\'s injuries?\n2. To what extent is each injury attributable to the index incident, on the balance of probabilities?\n3. What treatment has the Claimant received and what is your prognosis?\n4. What is your view on the Claimant\'s capacity to return to work and over what timescale?\n5. Are there any pre-existing conditions which materially affect the prognosis?',
 expertFee:'TBC',
 expertDeadline:'(within 8 weeks)',
 // complaints
 firmDomain:(firm.name||'firm').toLowerCase().replace(/[^a-z0-9]/g,'')+'.co.uk',
 firmEmail:'complaints@'+((firm.name||'firm').toLowerCase().replace(/[^a-z0-9]/g,'')+'.co.uk'),
 // cooling off
 coolingOffStart:client.cooling&&client.cooling.offDate?fmtDateStr(client.cooling.offDate):today,
 coolingOffEnd:fmtDateStr(addDays(new Date(client.cooling&&client.cooling.offDate||Date.now()),14).toISOString()),
 coolingOffWaiverReason:'Limitation period within 14 days; protective steps required.',
 // disengagement
 disengagementEffectiveDate:fmtDateStr(addDays(new Date(),28).toISOString()),
 disengagementReason:'(set out reason — e.g. irretrievable breakdown of solicitor / client relationship, conflict of interest identified, prospects of success below threshold)',
 limitationDate:kase.limitationDate?fmtDateStr(kase.limitationDate):'(LIMITATION DATE — verify)',
 disengagementBasicCharges:'TBC',
 disengagementDisbursements:'TBC',
 disengagementVat:'TBC',
 disengagementTotal:'TBC',
 disengagementCostsBasis:'In the present case our position on costs is: (to be set out — typically nothing payable unless termination is for cause).',
 // bill of costs
 billBasis:'standard',
 billOrderingJudge:'(Judge)',
 billOrderDate:'(date)',
 dateOfIssue:'(date)',
 dateConcluded:'(date)',
 billHowConcluded:'acceptance of the Defendant\'s Part 36 offer',
 ghrYear:'2024',
 feNameA:'Partner',feNameB:'Senior Solicitor',feNameC:'Solicitor',feNameD:'Paralegal',
 billHrsPreAction:'0.0',billCostsPreAction:'0.00',
 billHrsPleadings:'0.0',billCostsPleadings:'0.00',
 billHrsCMC:'0.0',billCostsCMC:'0.00',
 billHrsDisclosure:'0.0',billCostsDisclosure:'0.00',
 billHrsWitness:'0.0',billCostsWitness:'0.00',
 billHrsExpert:'0.0',billCostsExpert:'0.00',
 billHrsTrialPrep:'0.0',billCostsTrialPrep:'0.00',
 billHrsTrial:'0.0',billCostsTrial:'0.00',
 billTotalHours:'0.0',billProfitCostsTotal:'0.00',
 disbCourtFees:'0.00',disbCounsel:'0.00',disbMedical:'0.00',disbExpert:'0.00',disbRecords:'0.00',disbTravel:'0.00',disbOther:'0.00',disbTotal:'0.00',
 billSubTotal:'0.00',billVat:'0.00',billGrandTotal:'0.00',
 // n1
 statementOfValue:'25,000',
 dutyOfCareStatement:'in tort to take reasonable care to avoid acts or omissions which the Defendant could reasonably foresee would be likely to injure the Claimant',
 statutoryDutyStatement:'Further or alternatively, the Defendant owed the Claimant a statutory duty under the relevant regulations applying to the activity / premises in question.',
 resIpsaLoquiturNote:'in that the incident is of a kind which does not ordinarily occur in the absence of negligence and the means by which it occurred were within the exclusive control of the Defendant',
 medicalReportAuthor:'(Author)',medicalReportDate:'(date)'
 };
 const ctx=Object.assign(ctxDefault,state.ui.extraContext||{},(extra||{}),(valOverride.ctx||{}));
 return {client:clientCopy, firm, adviser, case:caseCopy, ctx, today, docRef:'FCP-'+(kase.ref||client.id||'demo').slice(-8).toUpperCase()+'-'+new Date().toISOString().slice(0,10)};
}
function interpolate(body,ctx){
 return body.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g,function(_,path){
 const v=getPath(ctx,path);
 if(v==null||v===''){return '<span class="placeholder-empty">{{'+path+'}}</span>'}
 if(Array.isArray(v))return v.join(', ');
 return String(v);
 });
}
function inlineMd(s){return s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/_([^_]+)_/g,'<em>$1</em>')}
function md2html(s){
 if(!s)return '';
 s=s.replace(/\[SIGNATURE_BLOCK\]/g,'<div class="sig-block"><div><div class="sig-line"></div>Signed (Client)<br>Date: ________________</div><div><div class="sig-line"></div>Signed (for {{firm.name}})<br>Date: ________________</div></div>');
 s=s.replace(/(^\|.+\|$\n?){2,}/gm,function(block){
 const lines=block.trim().split('\n');
 if(lines.length<2)return block;
 const headers=lines[0].split('|').slice(1,-1).map(c=>c.trim());
 const align=lines[1].split('|').slice(1,-1).map(c=>c.trim().endsWith(':')?'right':'left');
 const rows=lines.slice(2).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()));
 const ths=headers.map((h,i)=>'<th style="text-align:'+align[i]+'">'+inlineMd(h)+'</th>').join('');
 const trs=rows.map(r=>'<tr>'+r.map((c,i)=>'<td style="text-align:'+align[i]+'">'+inlineMd(c)+'</td>').join('')+'</tr>').join('');
 return '<table><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table>';
 });
 const lines=s.split('\n');
 let html='';let inList=null;
 for(let i=0;i<lines.length;i++){
 const ln=lines[i];
 const mUl=ln.match(/^\s*[-*]\s+(.*)$/);
 const mOl=ln.match(/^\s*\d+\.\s+(.*)$/);
 if(mUl){if(inList!=='ul'){if(inList)html+='</'+inList+'>';html+='<ul>';inList='ul'}html+='<li>'+inlineMd(mUl[1])+'</li>'}
 else if(mOl){if(inList!=='ol'){if(inList)html+='</'+inList+'>';html+='<ol>';inList='ol'}html+='<li>'+inlineMd(mOl[1])+'</li>'}
 else{
 if(inList){html+='</'+inList+'>';inList=null}
 if(ln.trim()==='')html+='';
 else if(ln.trim().startsWith('<'))html+=ln;
 else html+='<p>'+inlineMd(ln)+'</p>';
 }
 }
 if(inList)html+='</'+inList+'>';
 return html;
}
function renderTemplate(tplId,clientId,caseId,extra){
 const tpl=state.templates.find(t=>t.id===tplId);
 if(!tpl)return {html:'',markdown:'',missing:[]};
 const ctx=buildContext(clientId,caseId,extra);
 const overrides=(state.ui.sectionOverrides||{})[tplId]||{};
 let html='<h1>'+esc(tpl.name)+'</h1>';
 html+='<div class="doc-meta">'+esc(tpl.cobs||'')+' &middot; '+esc(ctx.today)+' &middot; '+esc((state.firm&&state.firm.name)||'')+'</div>';
 let md='# '+tpl.name+'\n\n_'+(tpl.cobs||'')+' · '+ctx.today+'_\n\n';
 const missing=[];
 for(const sec of tpl.sections){
 if(sec.requiredFields){
 for(const f of sec.requiredFields){
 const v=getPath(ctx,f);
 if(v==null||v==='')missing.push(f);
 }
 }
 const rawBody=overrides[sec.id]!=null?overrides[sec.id]:sec.body;
 const interp=interpolate(rawBody,ctx);
 const sechtml=md2html(interp);
 if(sec.heading)html+='<h2>'+esc(sec.heading)+'</h2>';
 if(sec.locked)html+='<div class="clause-locked">'+sechtml+'</div>';
 else html+=sechtml;
 if(sec.heading)md+='## '+sec.heading+'\n\n';
 md+=interp.replace(/<[^>]+>/g,'')+'\n\n';
 }
 return {html, markdown:md, missing};
}
// ════════════════════════════════════════════════════════════════
// T0 KEYWORD ROUTER · 12 rules
// ════════════════════════════════════════════════════════════════
const T0_RULES=[
 {kw:['cfa','success fee','laspo','conditional fee'], a:'Under LASPO 2012 and the Conditional Fee Agreements Order 2013, CFA success fees are no longer recoverable from the losing defendant — they are paid by the client from damages. In **personal injury** claims the success fee is capped at **25%** of (a) general damages for PSLA plus (b) past pecuniary loss net of CRU recoverable benefits. Future pecuniary loss is excluded from the cap base.'},
 {kw:['dba','damages based','damages-based'], a:'Damages-Based Agreements (DBA Regs 2013) charge the client a % of damages recovered. Caps: **PI claims 25%** (in or out of court); **employment tribunals 35%**; **all other civil claims 50%**, inclusive of VAT and counsel\'s fees. The Ontario model applies — opponent\'s costs recovered are credited against the DBA Payment.'},
 {kw:['letter of claim','pre-action','protocol','loc','21 days','30 days','4 months'], a:'Pre-Action Protocol Letter of Claim response periods: **standard PI** — 21 days to acknowledge + 3 months to respond on liability; **MOJ portal (RTA/EL/PL)** — 1 business day electronic acknowledgment + 15 (RTA) or 30 (EL/PL) business days for liability decision; **clinical negligence** — 14 days to acknowledge + 4 months to respond.'},
 {kw:['part 36','cpr 36','offer to settle','21-day','21 day relevant'], a:'CPR Part 36 offers carry strict cost consequences. Claimant offer beaten at trial (CPR 36.17(4)): defendant pays indemnity costs from end of relevant period + interest up to base+10% + an "additional amount" up to £75,000 (10% of first £500k damages, 5% of next £500k). Defendant offer not beaten by claimant (CPR 36.17(3)): claimant pays defendant\'s costs from end of relevant period. Relevant period is min 21 days under CPR 36.5.'},
 {kw:['schedule of loss','quantum','ogden','interest','sol'], a:'Schedule of Loss must itemise (i) general damages (PSLA) by reference to JC Guidelines bracket; (ii) past pecuniary loss with evidence refs; (iii) interest — 2% on general from service to trial, half-special-account rate on past special damages from incident; (iv) future loss using Ogden Tables 8 with current discount rate (−0.25%). PD 16 para 4 requires service with Particulars in PI claims.'},
 {kw:['witness statement','cpr 32','statement of truth'], a:'CPR 32.4 / PD 32: witness statement is in **first person**, numbered paragraphs, in the witness\'s own words (not the lawyer\'s), separating facts within knowledge from those on information and belief (with source). Must include the prescribed **statement of truth** (PD 22). Exhibits referenced as "[WITNESS INITIALS]/1". Signed and dated.'},
 {kw:['expert','cpr 35','instructions to expert','single joint','sje'], a:'CPR 35.3 — expert\'s overriding duty is to the court and overrides any duty to the instructing party. CPR 35.10 — report must state substance of all material instructions and these are NOT privileged from disclosure. PD 35 §3.3 requires the prescribed statement of truth. Single Joint Expert (CPR 35.8): instructed by both parties, fee shared, even-handed.'},
 {kw:['fos','financial ombudsman','complaints','dispute','legal ombudsman'], a:'CMR firms: Financial Ombudsman Service (FOS) — 0800 023 4567. Solicitor firms: Legal Ombudsman — 0300 555 0333. Internal complaint must be acknowledged within 3 working days and final response within 8 weeks. Client has **6 months** from final response to escalate to the Ombudsman.'},
 {kw:['cooling','cooling-off','14 day','consumer contracts','waiver'], a:'Consumer Contracts Regs 2013: where the agreement is made off-premises or at a distance, the consumer has 14 days to cancel without reason. To start work in the cooling-off period the firm needs an **express request on a durable medium** (reg 36). If service is fully performed within 14 days at consumer\'s request, right to cancel is **lost**.'},
 {kw:['without prejudice','wp','settlement','correspondence'], a:'"Without prejudice" privilege protects genuine settlement communications from being put before the court on the substantive issue. "Without prejudice save as to costs" (the Calderbank formula) reserves the right to refer to the offer on the question of costs once liability and quantum have been decided. Standard Letter of Claim offers should be marked WP-SATC.'},
 {kw:['bill of costs','assessment','precedent s','precedent n','cpr 47'], a:'Inter-partes detailed assessment under CPR 47. Bill follows Precedent S (electronic) or Precedent N format with phases aligned to Precedent H costs budget (pre-action, pleadings, CMC, disclosure, witness, expert, trial prep, trial). Must contain a signed certificate as to accuracy and indemnity principle.'},
 {kw:['n1','particulars of claim','pleading','cpr 16','pd 16'], a:'CPR 7 commences proceedings by N1 claim form; PD 16 sets Particulars of Claim content: concise statement of facts relied on, statutory and common-law duty, breach particulars, causation, particulars of injury (PI: with medical report attached PD 16 §4.3), schedule of loss (PI: PD 16 §4.2), interest claim under SCA 1981 s.35A / CCA 1984 s.69, statement of truth.'},
];
function t0Answer(q){
 if(!q)return null;
 const Q=q.toLowerCase();
 for(const r of T0_RULES){if(r.kw.some(k=>Q.includes(k)))return {text:r.a, source:'T0 · offline keyword router'}}
 return null;
}
async function t3Answer(q){
 if(!state.settings.anthropicKey)return {text:'T3 (BYOK) requires an Anthropic API key in Settings. T0 has no match for this question.', source:'T3 · no key'};
 try{
 const r=await fetch('https://api.anthropic.com/v1/messages',{
 method:'POST',
 headers:{'content-type':'application/json','x-api-key':state.settings.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
 body:JSON.stringify({model:'claude-haiku-4-5',max_tokens:600,messages:[{role:'user',content:'You are an assistant inside FallClaimPaper, a sovereign UK claims document generator for CMC / solicitor firms. Answer briefly and accurately about UK Claims rules (CPR, LASPO, DBA Regs, Pre-Action Protocols, Part 36). If you are unsure, say so. Question: '+q}]})
 });
 if(!r.ok){const txt=await r.text();return {text:'API error · '+r.status+' · '+txt.slice(0,200), source:'T3 · error'}}
 const j=await r.json();
 return {text:(j.content&&j.content[0]&&j.content[0].text)||'(empty)', source:'T3 · Claude Haiku 4.5'};
 }catch(e){return {text:'Network error: '+e.message, source:'T3 · error'}}
}
async function answerQuestion(q){const t0=t0Answer(q);if(t0)return t0;return await t3Answer(q)}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEMO SEEDING · "Alice Patel" rule (overwrite-me)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function maybeSeedDemo(){
 if(state.firm||state.clients.length>0)return;
 const firmId='fm_'+crypto.randomUUID().slice(0,8);
 const adviserId='ad_'+crypto.randomUUID().slice(0,8);
 const clientId='cl_'+crypto.randomUUID().slice(0,8);
 const caseId='cs_'+crypto.randomUUID().slice(0,8);
 state.firm={
 id:firmId,createdAt:now(),updatedAt:now(),
 name:'DEMO Claims & Co · overwrite me',
 tradingName:'DEMO Claims',
 fcaRefNo:'000000',companiesHouseNo:'00000000',vatNumber:'',
 registeredAddress:{line1:'1 Example Street',line2:'',city:'London',postcode:'SW1A 1AA',country:'GB'},
 piInsurer:'',piPolicyNo:'',piExpiresAt:null,professionalBody:'SRA',
 brandColor:'#8b1a1a',brandLogoDataUri:'',setupCompletedAt:now()
 };
 await idbPut('firms',state.firm);
 const adviser={id:adviserId,firmId,createdAt:now(),updatedAt:now(),archivedAt:null,name:'Aleksandra Demo',email:'aleks@demo.example',phone:'020 7000 0000',cmrAuthRef:'',smcrRole:'SMF22',role:'solicitor',status:'active',startedAt:now(),leftAt:null};
 state.advisers.push(adviser);await idbPut('advisers',adviser);
 state.ui.activeAdviserId=adviserId;
 const client={
 id:clientId,firmId,createdAt:now(),updatedAt:now(),archivedAt:null,
 title:'Ms',firstName:'Alice',middleName:'',lastName:'Patel',preferredName:'Alice',
 dob:'1985-04-22',gender:'',nationality:'GB',countryOfResidence:'GB',
 nino:'AB123456C',utr:'',taxResidency:['GB'],
 email:'alice@demo.example',phone:'+44 7700 900111',
 address:{line1:'14 Granary Square',line2:'',city:'London',region:'England',postcode:'N1C 4AA',country:'GB',since:'2020-01-01'},
 addressHistory:[],relationships:[],
 kyc:{status:'verified',riskGrade:'low',pepFlag:false,pepDetails:'',sanctionsStatus:'clear',sanctionsCheckedAt:now()-86400000*14,sanctionsCheckedBy:adviserId,sourceOfFunds:'earnings',sourceOfFundsNotes:'',sourceOfWealth:'earnings',sourceOfWealthNotes:'',vulnerableCustomerFlag:false,vulnerabilityCategory:'',vulnerabilityNotes:'',documentsHeld:[],lastReviewAt:now()-86400000*14,nextReviewDue:now()+86400000*351},
 cooling:{offDate:now()-86400000*10,waived:false},
 complaintsNoticeIssuedAt:null,
 referralSource:'direct',referralFee:0,
 suitability:{attitudeToRisk:4,capacityForLoss:'medium',knowledgeExperience:'medium',investmentHorizon:0,objectives:[],incomeNeeds:0,ethicalPreferences:'',lastReviewAt:null},
 adviserId,engagement:{startedAt:now()-86400000*10,type:'ongoing',feeBasis:'CFA',feeAgreementHash:'',feeAgreementSignedAt:now()-86400000*10,initialFee:0,ongoingFee:0,nextReviewDue:null},
 notes:[{ts:now()-86400000*10,adviserId,text:'RTA â€” rear-shunt at traffic lights. Whiplash + minor lower-back. ATE recommended.'}],
 links:{fallclaimCaseIds:[caseId],fallpracticeFeeLedgerIds:[],fallclaimpaperDocumentIds:[]}
 };
 state.clients.push(client);await idbPut('clients',client);
 state.ui.selectedClientId=clientId;
 const kase={
 id:caseId,firmId,clientId,ts:now()-86400000*10,updatedAt:now(),closedAt:null,
 ref:'C-2026-0001',type:'rta',
 incidentDate:'2025-12-04',
 incidentLocation:'A40 Westway, junction with West Cross Route, London W12',
 description:'The Claimant was stationary at a red traffic signal when the Defendant’s vehicle collided into the rear of the Claimant’s vehicle at low speed. The Claimant suffered whiplash to the cervical spine and a lower-back strain.',
 responsibleHandlerId:adviserId,supervisingPartnerId:adviserId,
 liability:{admitted:false,contributoryPct:0,splitNotes:'',defendantsIdentified:[{name:'John Smith',insurer:'Acme Motor Insurance Ltd',refNumber:'AMI/2025/55512',role:'Driver of the rear vehicle',address:'22 Some Road, London W11 1AA'}]},
 valuation:{specialDamages:[{category:'lost-earnings',amount:1850,evidenceRefs:['wage-slip-DEC2025','HR-letter-Jan26']},{category:'medical-expenses',amount:420,evidenceRefs:['physio-receipt-bundle']},{category:'travel',amount:160,evidenceRefs:['fuel-receipts','uber-statements']}],generalDamages:{injuryBand:'JC 7(A)(c)(iii) â€” Minor neck injuries · full recovery within 1 year',lower:2450,upper:4350,assessment:3500},interest:0,totalEstimate:5930},
 protocol:'rta-portal',portalRef:'',letterOfClaimSentAt:null,responseDeadline:null,defendantResponseAt:null,part36Offers:[],
 limitationDate:new Date('2028-12-04').getTime(),
 feeArrangement:'cfa',cfaSuccessFeePct:100,cfaCappedDamagesPct:25,dbaPct:50,ateInsurer:'',atePremium:0,
 status:'active',outcome:'',settlementAmount:0,settledAt:null,paymentReceivedAt:null,
 timeline:[{ts:now()-86400000*10,kind:'instruction',notes:'Client signed CFA + DBA opt-out form. Cooling-off 14d running.'}],
 nextStepDue:now()+86400000*7,
 filedDocuments:[],feeRecords:[]
 };
 state.cases.push(kase);await idbPut('cases',kase);
 state.ui.selectedCaseId=caseId;
 state.ui.selectedTemplateId='client-agreement-cfa';
 const r=renderTemplate('client-agreement-cfa',clientId,caseId,null);
 const doc={
 id:'dc_'+crypto.randomUUID().slice(0,8),
 clientId,caseId,templateId:'client-agreement-cfa',templateName:'Client Agreement · CFA (LASPO)',
 version:'1.0',
 title:'DEMO · Alice Patel · RTA · CFA · overwrite me',
 html:r.html,markdown:r.markdown,
 sha256:await sha256(r.html),
 generatedAt:now(),generatedBy:adviserId,
 signed:false,signedAt:null,signatureHash:'',
 status:'draft'
 };
 state.documents.push(doc);await idbPut('documents',doc);
 await audit('demo.seeded',{clientId,caseId,adviserId,reasoning:'Initial empty-state demo · Alice Patel · RTA · CFA.',payload:{firmId,adviserId,clientId,caseId,docId:doc.id}});
 await persistUI();
}
function renderTabs(){
 const nav=$('#tabNav');
 nav.innerHTML=TABS.map(t=>'<button data-tab="'+t.id+'" class="'+(state.active===t.id?'active':'')+'"><span style="font-family:var(--serif);font-size:14px;color:var(--brass)">'+t.ico+'</span> '+t.name+'</button>').join('');
 nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.active=b.dataset.tab;persistUI();render()});
 $('#brandName').textContent=state.brandName||'FallClaimPaper';
 $('#tierBadge').textContent=state.settings.anthropicKey?'T3':'T0';
}
function renderDisclaimer(){
 return '<div class="disclaimer"><strong>Disclaimer.</strong> FallClaimPaper is a tool for UK claims firms (CMC and solicitor practices). It assists with case management, fee tracking, regulated document generation, and FCA CMR / SRA compliance. It is not court filing software; pleadings and submissions remain the firm&rsquo;s responsibility. <strong>Sovereign &middot; client data never leaves the device.</strong></div>';
}
function render(){
 renderTabs();
 const v=$('#view');
 let html=renderDisclaimer();
 switch(state.active){
 case 'dashboard':html+=viewDashboard();break;
 case 'clients':html+=viewClients();break;
 case 'cases':html+=viewCases();break;
 case 'generate':html+=viewGenerate();break;
 case 'library':html+=viewLibrary();break;
 case 'templates':html+=viewTemplates();break;
 case 'firm':html+=viewFirm();break;
 case 'audit':html+=viewAudit();break;
 case 'help':html+=viewHelp();break;
 default:html+=viewDashboard();
 }
 v.innerHTML=html;bindCurrentView();
}
function bindCurrentView(){
 $$('[data-action]').forEach(el=>{el.onclick=e=>{const a=el.dataset.action;const h=ACTIONS[a];if(h)h(el,e)}});
 $$('[data-bind-input]').forEach(el=>{el.oninput=e=>{const a=el.dataset.bindInput;const h=INPUTS[a];if(h)h(el,e)}});
 $$('[data-bind-change]').forEach(el=>{el.onchange=e=>{const a=el.dataset.bindChange;const h=INPUTS[a];if(h)h(el,e)}});
}
function viewDashboard(){
 const recent=state.documents.slice().sort((a,b)=>b.generatedAt-a.generatedAt).slice(0,8);
 return `
<div class="section-h"><h2>Dashboard</h2><div class="sub">v${VERSION} &middot; prime ${PRIME} &middot; ${state.documents.length} docs &middot; ${state.cases.length} cases &middot; ${state.clients.length} clients</div></div>
<div class="grid">
 <div class="card">
 <h3>Firm <span class="meta">${state.firm?'CONFIGURED':'NOT SET'}</span></h3>
 <div class="kpi"><span class="l">Name</span><span class="v">${esc(state.firm?state.firm.name:'â€”')}</span></div>
 <div class="kpi"><span class="l">FCA / SRA Ref</span><span class="v">${esc(state.firm?state.firm.fcaRefNo||'â€”':'â€”')}</span></div>
 <div class="kpi"><span class="l">Handlers</span><span class="v">${state.advisers.length}</span></div>
 <div class="kpi"><span class="l">Clients</span><span class="v brass">${state.clients.length}</span></div>
 <div class="kpi"><span class="l">Open cases</span><span class="v brass">${state.cases.filter(k=>k.status==='active'||k.status==='intake').length}</span></div>
 </div>
 <div class="card">
 <h3>Documents</h3>
 <div class="kpi"><span class="l">Drafts</span><span class="v">${state.documents.filter(d=>d.status==='draft').length}</span></div>
 <div class="kpi"><span class="l">Issued</span><span class="v amber">${state.documents.filter(d=>d.status==='issued').length}</span></div>
 <div class="kpi"><span class="l">Signed</span><span class="v green">${state.documents.filter(d=>d.status==='signed').length}</span></div>
 <div class="kpi"><span class="l">Templates</span><span class="v">${state.templates.length}</span></div>
 </div>
 <div class="card">
 <h3>Quick start</h3>
 <p style="font-size:12px;color:var(--cream-dim);margin-bottom:9px">Pick a client, pick a case, pick a template, generate.</p>
 <button class="btn primary" data-action="goto-generate">Generate document &rarr;</button>
 <div style="height:6px"></div>
 <button class="btn ghost" data-action="goto-firm">Configure firm</button>
 </div>
 <div class="card">
 <h3>Bundle mesh <span class="meta">fall-claim &middot; prime ${PRIME}</span></h3>
 <p style="font-size:12px;color:var(--cream-dim)">Live link to fallclaim &middot; fallclaimonboard &middot; fallclaimpractice.</p>
 <button class="btn sm ghost" data-action="resync">Re-sync now</button>
 </div>
</div>
<div class="section-h" style="margin-top:24px"><h2>Recent documents</h2></div>
${recent.length?'<table><thead><tr><th>Generated</th><th>Client</th><th>Case</th><th>Template</th><th>Status</th><th></th></tr></thead><tbody>'+
 recent.map(d=>{
 const c=state.clients.find(x=>x.id===d.clientId);
 const k=state.cases.find(x=>x.id===d.caseId);
 return '<tr><td>'+dateTime(d.generatedAt)+'</td><td>'+(c?esc(c.firstName+' '+c.lastName):'â€”')+'</td><td>'+(k?esc(k.ref):'â€”')+'</td><td>'+esc(d.templateName)+'</td><td><span class="pill '+d.status+'">'+d.status+'</span></td><td><button class="btn sm ghost" data-action="open-doc" data-id="'+d.id+'">open</button></td></tr>';
 }).join('')+'</tbody></table>':'<div class="empty"><h3>No documents yet</h3><p>The empty state seeded a demo. Go to Library to inspect or Generate to make your own.</p></div>'}
`;
}
function viewClients(){
 const cs=state.clients.filter(c=>!c.archivedAt);
 return `
<div class="section-h"><h2>Clients</h2>
 <div class="actions">
 <button class="btn ghost sm" data-action="resync">re-sync mesh</button>
 <button class="btn primary sm" data-action="client-new">+ new client</button>
 </div>
</div>
${cs.length?cs.map(c=>{
 const adv=state.advisers.find(a=>a.id===c.adviserId);
 const ndocs=state.documents.filter(d=>d.clientId===c.id).length;
 const ncases=state.cases.filter(k=>k.clientId===c.id).length;
 return `<div class="card" style="margin-bottom:10px">
 <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
 <div style="flex:1;min-width:240px">
 <h3 style="margin-bottom:4px">${esc(c.title||'')} ${esc(c.firstName||'')} ${esc(c.lastName||'')} <span class="meta">${esc(c.id)}</span></h3>
 <div style="font-size:11px;color:var(--cream-dim);font-family:var(--mono)">${esc(c.email||'â€”')} &middot; ${esc(c.phone||'â€”')}</div>
 <div style="font-size:11px;color:var(--cream-muted);margin-top:4px">${esc(c.address?(c.address.line1+', '+c.address.city+', '+c.address.postcode):'')}</div>
 <div style="margin-top:6px">
 <span class="tag ${c.kyc&&c.kyc.status==='verified'?'green':'amber'}">KYC ${esc((c.kyc&&c.kyc.status)||'pending')}</span>
 <span class="tag muted">${esc(c.referralSource||'direct')}</span>
 ${c.cooling&&c.cooling.waived?'<span class="tag amber">cooling waived</span>':''}
 ${c.kyc&&c.kyc.vulnerableCustomerFlag?'<span class="tag red">vulnerable</span>':''}
 </div>
 </div>
 <div style="text-align:right">
 <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted)">Handler: ${esc(adv?adv.name:'â€”')}</div>
 <div style="font-family:var(--mono);font-size:10px;color:var(--brass);margin-top:3px">${ncases} case${ncases===1?'':'s'} &middot; ${ndocs} doc${ndocs===1?'':'s'}</div>
 <div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
 <button class="btn sm ghost" data-action="client-edit" data-id="${c.id}">edit</button>
 <button class="btn sm" data-action="client-generate" data-id="${c.id}">generate doc &rarr;</button>
 </div>
 </div>
 </div>
 </div>`;
}).join(''):'<div class="empty"><h3>No clients in store</h3><p>Open fallclaim or fallclaimonboard to capture clients, or click + new client to enter one manually.</p></div>'}
`;
}
function viewCases(){
 const ks=state.cases.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 return `
<div class="section-h"><h2>Cases</h2>
 <div class="actions">
 <button class="btn ghost sm" data-action="resync">re-sync</button>
 <button class="btn primary sm" data-action="case-new">+ new case</button>
 </div>
</div>
${ks.length?ks.map(k=>{
 const c=state.clients.find(x=>x.id===k.clientId);
 const ndocs=state.documents.filter(d=>d.caseId===k.id).length;
 const def=k.liability&&k.liability.defendantsIdentified&&k.liability.defendantsIdentified[0];
 return `<div class="card" style="margin-bottom:10px">
 <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
 <div style="flex:1;min-width:240px">
 <h3 style="margin-bottom:4px">${esc(k.ref)} &middot; ${esc(k.type)} <span class="meta">${esc(k.id)}</span></h3>
 <div style="font-size:12px;color:var(--cream)">${esc(c?c.firstName+' '+c.lastName:'â€”')} v ${esc(def?def.name:'(no defendant)')}</div>
 <div style="font-size:11px;color:var(--cream-muted);font-family:var(--mono);margin-top:4px">Incident: ${esc(k.incidentDate||'?')} &middot; ${esc(k.incidentLocation||'?')}</div>
 <div style="margin-top:6px">
 <span class="tag ${k.status==='active'?'green':k.status==='settled'?'blue':'muted'}">${esc(k.status)}</span>
 <span class="tag muted">${esc(k.protocol||'â€”')}</span>
 <span class="tag muted">${esc(k.feeArrangement||'cfa')}</span>
 ${k.liability&&k.liability.admitted?'<span class="tag green">liability admitted</span>':''}
 </div>
 </div>
 <div style="text-align:right">
 <div style="font-family:var(--mono);font-size:11px;color:var(--brass)">est. £${fmt(k.valuation&&k.valuation.totalEstimate||0)}</div>
 <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);margin-top:3px">${ndocs} document${ndocs===1?'':'s'}</div>
 <div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
 <button class="btn sm ghost" data-action="case-edit" data-id="${k.id}">edit</button>
 <button class="btn sm" data-action="case-generate" data-id="${k.id}">generate &rarr;</button>
 </div>
 </div>
 </div>
 </div>`;
}).join(''):'<div class="empty"><h3>No cases</h3><p>Open fallclaim to capture cases, or click + new case here.</p></div>'}
`;
}
function viewGenerate(){
 const cid=state.ui.selectedClientId;
 const kid=state.ui.selectedCaseId;
 const tid=state.ui.selectedTemplateId;
 const tpl=state.templates.find(t=>t.id===tid);
 const cs=state.clients.filter(c=>!c.archivedAt);
 const kFiltered=cid?state.cases.filter(k=>k.clientId===cid):state.cases.slice();
 let preview='<div class="empty"><h3>Pick a client, a case, and a template</h3><p>All three are needed to render. Some templates (e.g. Complaints Notice) tolerate no case.</p></div>';
 let missingChips='';
 if(cid&&tpl){
 const r=renderTemplate(tid,cid,kid,null);
 preview='<div class="paper">'+r.html+'</div>';
 if(r.missing.length){missingChips='<div class="req-list">'+r.missing.map(m=>'<span class="req miss">missing: '+esc(m)+'</span>').join('')+'</div>'}
 else{missingChips='<div class="req-list"><span class="req ok">all required fields present</span></div>'}
 }
 const overrides=(state.ui.sectionOverrides||{})[tid]||{};
 const isScheduleOfLoss=tid==='schedule-of-loss';
 return `
<div class="section-h"><h2>Generate document</h2>
 <div class="actions">
 ${cid&&kid&&isScheduleOfLoss?'<button class="btn ghost sm" data-action="request-valuation">+ valuation from fallclaim</button>':''}
 ${cid&&tpl?'<button class="btn primary sm" data-action="commit-doc">commit + save &rarr;</button>':''}
 </div>
</div>
<div class="doc-stage">
 <aside class="doc-side">
 <div class="card">
 <h3>1 &middot; Client</h3>
 <select data-bind-change="select-client" style="width:100%">
 <option value="">â€” select client â€”</option>
 ${cs.map(c=>'<option value="'+c.id+'"'+(c.id===cid?' selected':'')+'>'+esc(c.firstName+' '+c.lastName)+'</option>').join('')}
 </select>
 ${cid?'<div style="margin-top:6px;font-size:10px;color:var(--cream-muted);font-family:var(--mono)">'+esc(cid)+'</div>':''}
 </div>
 <div class="card">
 <h3>2 &middot; Case</h3>
 <select data-bind-change="select-case" style="width:100%">
 <option value="">â€” select case â€”</option>
 ${kFiltered.map(k=>'<option value="'+k.id+'"'+(k.id===kid?' selected':'')+'>'+esc(k.ref+' · '+k.type)+'</option>').join('')}
 </select>
 ${kid?'<div style="margin-top:6px;font-size:10px;color:var(--cream-muted);font-family:var(--mono)">'+esc(kid)+'</div>':''}
 </div>
 <div class="card">
 <h3>3 &middot; Template</h3>
 <div class="tpl-list">
 ${state.templates.map(t=>'<div class="tpl-row '+(t.id===tid?'active':'')+'" data-action="select-tpl" data-id="'+t.id+'"><div><div class="nm">'+esc(t.name)+'</div><div class="sub">'+esc(t.cobs||'')+' · '+esc(t.kind)+'</div></div></div>').join('')}
 </div>
 </div>
 ${cid&&tpl?'<div class="card"><h3>4 &middot; Required fields</h3>'+missingChips+'</div>':''}
 ${state.ui.valuationFromFallClaim?'<div class="card"><h3>Valuation &middot; fallclaim</h3><div style="font-size:11px;color:var(--cream-dim);font-family:var(--mono)">'+esc(JSON.stringify(state.ui.valuationFromFallClaim).slice(0,200))+'â€¦</div><button class="btn sm ghost" style="margin-top:6px" data-action="clear-valuation">clear</button></div>':''}
 </aside>
 <section>
 ${cid&&tpl?'<details style="margin-bottom:10px"><summary style="cursor:pointer;font-family:var(--mono);font-size:11px;color:var(--brass);letter-spacing:0.08em;text-transform:uppercase">&#9826; inline edit sections</summary><div style="margin-top:10px">'+
 tpl.sections.map(sec=>{
 const cur=overrides[sec.id]!=null?overrides[sec.id]:sec.body;
 return '<div class="section-edit '+(sec.locked?'locked':'')+'"><div class="hd"><div class="nm">'+esc(sec.heading||'(no heading)')+'</div><div class="tg">'+esc(sec.id)+(sec.locked?' · locked':'')+'</div></div>'+
 (sec.locked?'<div style="font-family:var(--mono);font-size:11px;color:var(--cream-dim);padding:6px 0">Regulatory clause â€” locked. Edit blocked to protect compliance.</div>':
 '<textarea data-bind-input="edit-section" data-tpl="'+esc(tid)+'" data-sec="'+esc(sec.id)+'" rows="6">'+esc(cur)+'</textarea>')+
 (overrides[sec.id]!=null&&!sec.locked?'<button class="btn sm ghost" style="margin-top:6px" data-action="reset-section" data-tpl="'+esc(tid)+'" data-sec="'+esc(sec.id)+'">reset to default</button>':'')+
 '</div>';
 }).join('')+
 '</div></details>':''}
 ${preview}
 ${cid&&tpl?'<div style="margin-top:14px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost sm" data-action="export-md">&darr; markdown</button><button class="btn ghost sm" data-action="export-html">&darr; standalone html</button><button class="btn ghost sm" data-action="hand-off-fallpdf">&rarr; FallPDF</button><button class="btn primary" data-action="commit-doc">commit + save</button></div>':''}
 </section>
</div>
`;
}
function viewLibrary(){
 const fc=state.ui.libFilterClient||'';
 const fk=state.ui.libFilterCase||'';
 const ft=state.ui.libFilterTpl||'';
 const fs=state.ui.libFilterStatus||'';
 let docs=state.documents.slice();
 if(fc)docs=docs.filter(d=>d.clientId===fc);
 if(fk)docs=docs.filter(d=>d.caseId===fk);
 if(ft)docs=docs.filter(d=>d.templateId===ft);
 if(fs)docs=docs.filter(d=>d.status===fs);
 docs.sort((a,b)=>b.generatedAt-a.generatedAt);
 const opened=state.ui.selectedDocumentId?state.documents.find(d=>d.id===state.ui.selectedDocumentId):null;
 return `
<div class="section-h"><h2>Document library</h2><div class="sub">${state.documents.length} total &middot; ${docs.length} after filter</div></div>
<div class="card" style="margin-bottom:14px">
 <div class="row-3">
 <div class="field"><label>Client</label><select data-bind-change="lib-filter-client"><option value="">all</option>${state.clients.map(c=>'<option value="'+c.id+'"'+(c.id===fc?' selected':'')+'>'+esc(c.firstName+' '+c.lastName)+'</option>').join('')}</select></div>
 <div class="field"><label>Case</label><select data-bind-change="lib-filter-case"><option value="">all</option>${state.cases.map(k=>'<option value="'+k.id+'"'+(k.id===fk?' selected':'')+'>'+esc(k.ref)+'</option>').join('')}</select></div>
 <div class="field"><label>Template</label><select data-bind-change="lib-filter-tpl"><option value="">all</option>${state.templates.map(t=>'<option value="'+t.id+'"'+(t.id===ft?' selected':'')+'>'+esc(t.name)+'</option>').join('')}</select></div>
 </div>
 <div class="row">
 <div class="field"><label>Status</label><select data-bind-change="lib-filter-status"><option value="">all</option><option value="draft"${fs==='draft'?' selected':''}>draft</option><option value="issued"${fs==='issued'?' selected':''}>issued</option><option value="signed"${fs==='signed'?' selected':''}>signed</option></select></div>
 </div>
</div>
${docs.length?'<table><thead><tr><th>Generated</th><th>Title</th><th>Client</th><th>Case</th><th>Template</th><th>Status</th><th>Hash</th><th></th></tr></thead><tbody>'+
 docs.map(d=>{
 const c=state.clients.find(x=>x.id===d.clientId);
 const k=state.cases.find(x=>x.id===d.caseId);
 return '<tr><td>'+dateTime(d.generatedAt)+'</td><td>'+esc(d.title||'â€”')+'</td><td>'+(c?esc(c.firstName+' '+c.lastName):'â€”')+'</td><td>'+(k?esc(k.ref):'â€”')+'</td><td>'+esc(d.templateName)+'</td><td><span class="pill '+d.status+'">'+d.status+'</span></td><td style="font-family:var(--mono);font-size:10px;color:var(--cream-muted)">'+(d.sha256||'').slice(0,10)+'â€¦</td><td style="white-space:nowrap"><button class="btn sm ghost" data-action="open-doc" data-id="'+d.id+'">open</button> <button class="btn sm ghost" data-action="del-doc" data-id="'+d.id+'">Ã—</button></td></tr>';
 }).join('')+'</tbody></table>':'<div class="empty"><h3>No documents match these filters</h3><p>Adjust the filters or go to Generate.</p></div>'}
${opened?'<div class="card" style="margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">'+esc(opened.title||opened.templateName)+'</h3><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn sm ghost" data-action="export-doc-md" data-id="'+opened.id+'">&darr; md</button><button class="btn sm ghost" data-action="export-doc-html" data-id="'+opened.id+'">&darr; html</button>'+(opened.status==='draft'?'<button class="btn sm" data-action="mark-issued" data-id="'+opened.id+'">mark issued</button>':'')+(opened.status!=='signed'?'<button class="btn sm" data-action="mark-signed" data-id="'+opened.id+'">mark signed</button>':'')+'<button class="btn sm ghost" data-action="close-doc">close</button></div></div><div class="paper">'+opened.html+'</div></div>':''}
`;
}
function viewTemplates(){
 const tid=state.ui.selectedTemplateId;
 const tpl=state.templates.find(t=>t.id===tid)||state.templates[0];
 return `
<div class="section-h"><h2>Template editor</h2><div class="sub">${state.templates.length} templates &middot; regulatory clauses locked</div></div>
<div class="grid-2">
 <div>
 <div class="card">
 <h3>Catalogue</h3>
 <div class="tpl-list">
 ${state.templates.map(t=>'<div class="tpl-row '+(tpl&&t.id===tpl.id?'active':'')+'" data-action="select-tpl-editor" data-id="'+t.id+'"><div><div class="nm">'+esc(t.name)+(t._custom?' <span style="font-family:var(--mono);font-size:9px;color:var(--brass)">CUSTOM</span>':'')+'</div><div class="sub">'+esc(t.cobs||'')+'</div></div></div>').join('')}
 </div>
 </div>
 </div>
 <div>
 ${tpl?'<div class="card"><h3>'+esc(tpl.name)+' <span class="meta">v'+esc(tpl.version)+'</span></h3><p style="font-size:12px;color:var(--cream-dim);margin-bottom:10px">'+esc(tpl.description)+'</p><div style="font-size:10px;color:var(--cream-muted);font-family:var(--mono);margin-bottom:14px">'+esc(tpl.cobs||'')+'</div>'+
 tpl.sections.map(sec=>{
 const overrides=(state.ui.sectionOverrides||{})[tpl.id]||{};
 const cur=overrides[sec.id]!=null?overrides[sec.id]:sec.body;
 return '<div class="section-edit '+(sec.locked?'locked':'')+'"><div class="hd"><div class="nm">'+esc(sec.heading||'(no heading)')+'</div><div class="tg">'+esc(sec.id)+(sec.locked?' · locked · regulatory':'')+'</div></div>'+
 (sec.locked?'<pre style="font-family:var(--mono);font-size:11px;color:var(--cream-dim);white-space:pre-wrap;margin:6px 0">'+esc(sec.body)+'</pre>':
 '<textarea data-bind-input="edit-tpl-section" data-tpl="'+esc(tpl.id)+'" data-sec="'+esc(sec.id)+'" rows="6">'+esc(cur)+'</textarea>')+
 (overrides[sec.id]!=null&&!sec.locked?'<div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span style="font-family:var(--mono);font-size:10px;color:var(--brass);text-transform:uppercase;letter-spacing:0.08em">edited</span><button class="btn sm ghost" data-action="reset-tpl-section" data-tpl="'+esc(tpl.id)+'" data-sec="'+esc(sec.id)+'">reset</button></div>':'')+
 '</div>';
 }).join('')+
 '<div style="margin-top:14px;display:flex;gap:5px;justify-content:flex-end"><button class="btn primary sm" data-action="save-tpl-overrides" data-tpl="'+esc(tpl.id)+'">save customisations</button></div>'+
 '</div>':''}
 </div>
</div>
`;
}
function viewFirm(){
 const f=state.firm||{name:'',fcaRefNo:'',tradingName:'',companiesHouseNo:'',vatNumber:'',registeredAddress:{line1:'',line2:'',city:'',postcode:'',country:'GB'},piInsurer:'',piPolicyNo:'',piExpiresAt:null,professionalBody:''};
 return `
<div class="section-h"><h2>Firm</h2><div class="actions">${state.firm?'<button class="btn primary sm" data-action="firm-save">save + broadcast</button>':'<button class="btn primary sm" data-action="firm-save">create firm record</button>'}</div></div>
<div class="card">
 <h3>Firm identity</h3>
 <div class="row">
 <div class="field"><label>Legal name</label><input id="f-name" value="${esc(f.name)}"></div>
 <div class="field"><label>Trading name</label><input id="f-trading" value="${esc(f.tradingName)}"></div>
 </div>
 <div class="row">
 <div class="field"><label>FCA / SRA reference</label><input id="f-fca" value="${esc(f.fcaRefNo)}"></div>
 <div class="field"><label>Companies House no</label><input id="f-ch" value="${esc(f.companiesHouseNo)}"></div>
 </div>
 <div class="row">
 <div class="field"><label>VAT no</label><input id="f-vat" value="${esc(f.vatNumber)}"></div>
 <div class="field"><label>Professional body</label><input id="f-pro" value="${esc(f.professionalBody)}" placeholder="SRA / FCA CMR"></div>
 </div>
</div>
<div class="card" style="margin-top:12px">
 <h3>Registered address</h3>
 <div class="row">
 <div class="field"><label>Line 1</label><input id="f-a1" value="${esc(f.registeredAddress.line1)}"></div>
 <div class="field"><label>Line 2</label><input id="f-a2" value="${esc(f.registeredAddress.line2)}"></div>
 </div>
 <div class="row-3">
 <div class="field"><label>City</label><input id="f-city" value="${esc(f.registeredAddress.city)}"></div>
 <div class="field"><label>Postcode</label><input id="f-pc" value="${esc(f.registeredAddress.postcode)}"></div>
 <div class="field"><label>Country</label><input id="f-cc" value="${esc(f.registeredAddress.country)}"></div>
 </div>
</div>
<div class="card" style="margin-top:12px">
 <h3>PI insurance</h3>
 <div class="row-3">
 <div class="field"><label>Insurer</label><input id="f-pi" value="${esc(f.piInsurer)}"></div>
 <div class="field"><label>Policy no</label><input id="f-pino" value="${esc(f.piPolicyNo)}"></div>
 <div class="field"><label>Expires</label><input id="f-pix" type="date" value="${isoDate(f.piExpiresAt)}"></div>
 </div>
</div>
<div class="section-h" style="margin-top:24px"><h2>Handlers / advisers</h2><div class="actions"><button class="btn primary sm" data-action="adv-new">+ handler</button></div></div>
${state.advisers.length?state.advisers.map(a=>'<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><div style="font-family:var(--serif);font-size:14px">'+esc(a.name)+' <span class="meta" style="font-family:var(--mono);font-size:10px;color:var(--brass);letter-spacing:0.1em;margin-left:6px">'+esc(a.role||a.smcrRole||'')+'</span></div><div style="font-size:11px;color:var(--cream-muted);font-family:var(--mono)">'+esc(a.email||'')+' · '+esc(a.phone||'')+' · '+esc(a.cmrAuthRef||a.fcaRefNo||'no ref')+'</div></div><div style="display:flex;gap:4px"><button class="btn sm ghost" data-action="adv-active" data-id="'+a.id+'">'+(state.ui.activeAdviserId===a.id?'active':'set active')+'</button><button class="btn sm ghost" data-action="adv-edit" data-id="'+a.id+'">edit</button></div></div></div>').join(''):'<div class="empty"><h3>No handlers</h3><p>Add a handler before generating documents.</p></div>'}
`;
}
function viewAudit(){
 const rows=state.audit.slice().reverse().slice(0,500);
 return `
<div class="section-h"><h2>Audit chain</h2><div class="sub">${state.audit.length} entries &middot; P3 &middot; sha-256 chained &middot; 6yr retention</div>
 <div class="actions"><button class="btn ghost sm" data-action="audit-export">&darr; export JSON</button><button class="btn ghost sm" data-action="audit-verify">verify chain</button></div>
</div>
<div class="card">
 <div style="display:grid;grid-template-columns:50px 110px 1fr 100px;gap:8px;padding:6px 10px;font-family:var(--mono);font-size:10px;color:var(--brass);letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid var(--line)"><div>#</div><div>when</div><div>action / reasoning</div><div>hash</div></div>
 ${rows.length?rows.map(e=>'<div class="audit-row"><div>'+e.i+'</div><div>'+new Date(e.ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+'</div><div><strong style="color:var(--cream)">'+esc(e.action)+'</strong>'+(e.reasoning?' · '+esc(e.reasoning):'')+'</div><div style="color:var(--cream-muted)">'+(e.docHash||'').slice(0,8)+'</div></div>').join(''):'<div class="empty"><p>No audit entries yet.</p></div>'}
</div>
`;
}
function viewHelp(){
 const chat=state.ui.chat||[];
 return `
<div class="section-h"><h2>Q &amp; A</h2><div class="sub">T0 offline keyword router &middot; T3 BYOK fallback</div></div>
<div class="card">
 <div class="chat" id="chatBox">
 ${chat.length?chat.map(m=>'<div class="msg '+m.role+'">'+esc(m.text)+(m.source?'<div class="src">'+esc(m.source)+'</div>':'')+'</div>').join(''):'<div class="empty"><h3>Ask anything about UK claims documents</h3><p>e.g. <em>"CFA success fee cap?"</em>, <em>"DBA cap?"</em>, <em>"Letter of Claim PI deadlines?"</em>, <em>"Part 36 cost consequences?"</em></p></div>'}
 </div>
 <div class="chat-input">
 <input id="chatQ" placeholder="ask about CPR, LASPO, DBA, Part 36, pre-action protocolâ€¦" data-bind-input="chat-q">
 <button class="btn primary" data-action="chat-send">ask</button>
 </div>
 <p style="font-size:11px;color:var(--cream-muted);margin-top:8px;font-family:var(--mono)">T0 rules: ${T0_RULES.length} &middot; T3: ${state.settings.anthropicKey?'configured':'not configured (Settings)'}</p>
</div>
`;
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODALS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openModal(kind){
 const m=$('#modal');
 if(kind==='settings'){
 $('#modalTitle').textContent='Settings';
 $('#modalBody').innerHTML=`
 <div class="field" style="margin-bottom:10px"><label>Brand name (forkable)</label><input id="s-brand" value="${esc(state.brandName||'')}"></div>
 <div class="field" style="margin-bottom:10px"><label>Anthropic API key (T3 BYOK · never leaves device)</label><input id="s-key" type="password" placeholder="sk-ant-..." value="${esc(state.settings.anthropicKey||'')}"></div>
 <div class="field" style="margin-bottom:10px"><label><input type="checkbox" id="s-audit" ${state.settings.auditChain?'checked':''}> audit chain on every change</label></div>
 <div class="field" style="margin-bottom:10px"><label><input type="checkbox" id="s-broadcast" ${state.settings.autoBroadcast?'checked':''}> broadcast changes on fall-claim mesh</label></div>
 <p style="font-size:11px;color:var(--cream-muted);font-family:var(--mono)">${TOOLNAME}@${VERSION} · prime ${PRIME} · schema ${SCHEMA_VERSION}</p>
 <div class="actions"><button class="btn ghost" onclick="closeModal()">cancel</button><button class="btn primary" id="s-save">save</button></div>
 `;
 $('#s-save').onclick=async()=>{
 state.brandName=$('#s-brand').value.trim()||'FallClaimPaper';
 state.settings.anthropicKey=$('#s-key').value.trim();
 state.settings.auditChain=$('#s-audit').checked;
 state.settings.autoBroadcast=$('#s-broadcast').checked;
 await persistUI();
 closeModal();render();toast('settings saved');
 };
 }else if(kind==='client-edit'||kind==='client-new'){
 const c=kind==='client-new'?{title:'Mr',firstName:'',lastName:'',dob:'',nino:'',email:'',phone:'',address:{line1:'',city:'',postcode:'',country:'GB'},kyc:{status:'pending',riskGrade:'low'},cooling:{offDate:now(),waived:false},referralSource:'direct',referralFee:0}:state.clients.find(x=>x.id===state._editingClientId);
 $('#modalTitle').textContent=kind==='client-new'?'New client':'Edit '+(c.firstName+' '+c.lastName);
 $('#modalBody').innerHTML=`
 <div class="row-3"><div class="field"><label>Title</label><input id="c-title" value="${esc(c.title||'')}"></div><div class="field"><label>First</label><input id="c-first" value="${esc(c.firstName||'')}"></div><div class="field"><label>Last</label><input id="c-last" value="${esc(c.lastName||'')}"></div></div>
 <div class="row"><div class="field"><label>DOB</label><input id="c-dob" type="date" value="${esc(c.dob||'')}"></div><div class="field"><label>NINO</label><input id="c-nino" value="${esc(c.nino||'')}"></div></div>
 <div class="row"><div class="field"><label>Email</label><input id="c-email" value="${esc(c.email||'')}"></div><div class="field"><label>Phone</label><input id="c-phone" value="${esc(c.phone||'')}"></div></div>
 <div class="row"><div class="field"><label>Address line 1</label><input id="c-a1" value="${esc(c.address&&c.address.line1||'')}"></div><div class="field"><label>City</label><input id="c-city" value="${esc(c.address&&c.address.city||'')}"></div></div>
 <div class="row"><div class="field"><label>Postcode</label><input id="c-pc" value="${esc(c.address&&c.address.postcode||'')}"></div><div class="field"><label>Handler</label><select id="c-adv"><option value="">â€”</option>${state.advisers.map(a=>'<option value="'+a.id+'"'+(a.id===c.adviserId?' selected':'')+'>'+esc(a.name)+'</option>').join('')}</select></div></div>
 <div class="row"><div class="field"><label>Referral source</label><select id="c-ref"><option value="direct">direct</option><option value="lead-generator">lead generator</option><option value="solicitor-referral">solicitor referral</option><option value="introducer">introducer</option></select></div><div class="field"><label>Referral fee (£)</label><input id="c-reffee" type="number" value="${esc(c.referralFee||0)}"></div></div>
 <div class="row"><div class="field"><label>KYC status</label><select id="c-kyc"><option value="pending">pending</option><option value="verified">verified</option><option value="review">review</option><option value="failed">failed</option></select></div><div class="field"><label>Cooling-off waived?</label><select id="c-cw"><option value="false">no (default â€” 14d cooling-off runs)</option><option value="true">yes (express waiver signed)</option></select></div></div>
 <div class="field" style="margin-bottom:10px"><label><input type="checkbox" id="c-vuln" ${c.kyc&&c.kyc.vulnerableCustomerFlag?'checked':''}> vulnerable customer flag (FG21/1)</label></div>
 <div class="actions"><button class="btn ghost" onclick="closeModal()">cancel</button>${kind==='client-edit'?'<button class="btn danger ghost" id="c-archive">archive</button>':''}<button class="btn primary" id="c-save">save + broadcast</button></div>
 `;
 setTimeout(()=>{
 $('#c-kyc').value=(c.kyc&&c.kyc.status)||'pending';
 $('#c-ref').value=c.referralSource||'direct';
 $('#c-cw').value=(c.cooling&&c.cooling.waived)?'true':'false';
 },10);
 $('#c-save').onclick=async()=>{
 const isNew=kind==='client-new';
 const id=isNew?'cl_'+crypto.randomUUID().slice(0,8):c.id;
 const upd={...(isNew?{}:c),
 id,firmId:state.firm?state.firm.id:'',
 createdAt:c.createdAt||now(),updatedAt:now(),archivedAt:c.archivedAt||null,
 title:$('#c-title').value,firstName:$('#c-first').value,lastName:$('#c-last').value,
 dob:$('#c-dob').value,nino:$('#c-nino').value,email:$('#c-email').value,phone:$('#c-phone').value,
 address:{line1:$('#c-a1').value,line2:'',city:$('#c-city').value,region:'England',postcode:$('#c-pc').value,country:'GB',since:c.address&&c.address.since||''},
 adviserId:$('#c-adv').value||c.adviserId||state.ui.activeAdviserId,
 referralSource:$('#c-ref').value,
 referralFee:+$('#c-reffee').value||0,
 kyc:{...(c.kyc||{}),status:$('#c-kyc').value,vulnerableCustomerFlag:$('#c-vuln').checked},
 cooling:{offDate:(c.cooling&&c.cooling.offDate)||now(),waived:$('#c-cw').value==='true'},
 complaintsNoticeIssuedAt:c.complaintsNoticeIssuedAt||null,
 relationships:c.relationships||[],
 suitability:c.suitability||{attitudeToRisk:4,capacityForLoss:'medium',knowledgeExperience:'medium',investmentHorizon:0,objectives:[],incomeNeeds:0,ethicalPreferences:'',lastReviewAt:null},
 engagement:c.engagement||{type:'ongoing',feeBasis:'CFA',initialFee:0,ongoingFee:0},
 links:c.links||{fallclaimCaseIds:[],fallpracticeFeeLedgerIds:[],fallclaimpaperDocumentIds:[]}
 };
 const idx=state.clients.findIndex(x=>x.id===id);
 if(idx>=0)state.clients[idx]=upd;else state.clients.push(upd);
 await idbPut('clients',upd);
 await audit(isNew?'client.created':'client.updated',{clientId:id,reasoning:isNew?'Client added via FallClaimPaper':'Client edited via FallClaimPaper',payload:{id,name:upd.firstName+' '+upd.lastName}});
 await emitClientUpdate(upd);
 closeModal();render();toast(isNew?'client created · broadcast':'client saved · broadcast');
 };
 if(kind==='client-edit'){
 $('#c-archive').onclick=async()=>{
 if(!confirm('Archive (soft-delete, 6-year retention)?'))return;
 c.archivedAt=now();c.updatedAt=now();
 await idbPut('clients',c);
 await audit('client.archived',{clientId:c.id,reasoning:'Soft-archive (retention).',payload:{id:c.id}});
 broadcast(bcClaim,'client.archived',c);
 closeModal();render();toast('client archived');
 };
 }
 }else if(kind==='adv-new'||kind==='adv-edit'){
 const a=kind==='adv-new'?{name:'',email:'',phone:'',cmrAuthRef:'',role:'caseworker',smcrRole:'',status:'active'}:state.advisers.find(x=>x.id===state._editingAdvId);
 $('#modalTitle').textContent=kind==='adv-new'?'New handler':'Edit '+a.name;
 $('#modalBody').innerHTML=`
 <div class="field" style="margin-bottom:8px"><label>Name</label><input id="a-name" value="${esc(a.name)}"></div>
 <div class="row"><div class="field"><label>Email</label><input id="a-email" value="${esc(a.email)}"></div><div class="field"><label>Phone</label><input id="a-phone" value="${esc(a.phone)}"></div></div>
 <div class="row"><div class="field"><label>CMR auth / SRA roll</label><input id="a-cmr" value="${esc(a.cmrAuthRef||a.fcaRefNo||'')}"></div><div class="field"><label>Role</label><select id="a-role"><option value="caseworker">caseworker</option><option value="paralegal">paralegal</option><option value="solicitor">solicitor</option><option value="partner">partner</option><option value="COLP-equiv">COLP-equivalent</option></select></div></div>
 <div class="actions"><button class="btn ghost" onclick="closeModal()">cancel</button><button class="btn primary" id="a-save">save + broadcast</button></div>
 `;
 setTimeout(()=>{$('#a-role').value=a.role||'caseworker'},10);
 $('#a-save').onclick=async()=>{
 const isNew=kind==='adv-new';
 const id=isNew?'ad_'+crypto.randomUUID().slice(0,8):a.id;
 const upd={...(isNew?{}:a),id,firmId:state.firm?state.firm.id:'',createdAt:a.createdAt||now(),updatedAt:now(),archivedAt:a.archivedAt||null,
 name:$('#a-name').value,email:$('#a-email').value,phone:$('#a-phone').value,cmrAuthRef:$('#a-cmr').value,role:$('#a-role').value,smcrRole:a.smcrRole||'',status:'active',startedAt:a.startedAt||now(),leftAt:null};
 const idx=state.advisers.findIndex(x=>x.id===id);
 if(idx>=0)state.advisers[idx]=upd;else state.advisers.push(upd);
 await idbPut('advisers',upd);
 await audit(isNew?'adviser.created':'adviser.updated',{adviserId:id,reasoning:isNew?'Handler added':'Handler edited',payload:{name:upd.name}});
 await emitAdviserUpdate(upd);
 closeModal();render();toast(isNew?'handler created · broadcast':'handler saved · broadcast');
 };
 }else if(kind==='case-new'||kind==='case-edit'){
 const k=kind==='case-new'?{ref:'C-'+new Date().getFullYear()+'-'+String(state.cases.length+1).padStart(4,'0'),type:'rta',incidentDate:'',incidentLocation:'',description:'',clientId:state.ui.selectedClientId||'',protocol:'pre-action-pi',feeArrangement:'cfa',cfaSuccessFeePct:100,cfaCappedDamagesPct:25,dbaPct:50,status:'active',liability:{admitted:false,contributoryPct:0,defendantsIdentified:[{name:'',insurer:'',refNumber:'',role:'',address:''}]},valuation:{specialDamages:[],generalDamages:{injuryBand:'',lower:0,upper:0,assessment:0},interest:0,totalEstimate:0},timeline:[],part36Offers:[]}:state.cases.find(x=>x.id===state._editingCaseId);
 const def=(k.liability&&k.liability.defendantsIdentified&&k.liability.defendantsIdentified[0])||{name:'',insurer:'',refNumber:'',role:'',address:''};
 $('#modalTitle').textContent=kind==='case-new'?'New case':'Edit case '+k.ref;
 $('#modalBody').innerHTML=`
 <div class="row"><div class="field"><label>Case reference</label><input id="k-ref" value="${esc(k.ref)}"></div><div class="field"><label>Client</label><select id="k-cli">${state.clients.map(c=>'<option value="'+c.id+'"'+(c.id===k.clientId?' selected':'')+'>'+esc(c.firstName+' '+c.lastName)+'</option>').join('')}</select></div></div>
 <div class="row"><div class="field"><label>Type</label><select id="k-type"><option value="rta">rta</option><option value="el">el (employer)</option><option value="pl">pl (public liability)</option><option value="clinical-neg">clinical neg</option><option value="housing-disrepair">housing disrepair</option><option value="financial-misselling">financial misselling</option><option value="data-breach">data breach</option><option value="trip">trip</option><option value="other">other</option></select></div><div class="field"><label>Protocol</label><select id="k-prot"><option value="pre-action-pi">pre-action-pi</option><option value="pre-action-clinical-neg">pre-action-clinical-neg</option><option value="rta-portal">rta-portal</option><option value="el-pl-portal">el-pl-portal</option><option value="housing-disrepair">housing-disrepair</option><option value="small-claims">small-claims</option><option value="fast-track">fast-track</option><option value="multi-track">multi-track</option><option value="none">none</option></select></div></div>
 <div class="row"><div class="field"><label>Incident date</label><input id="k-id" type="date" value="${esc(k.incidentDate||'')}"></div><div class="field"><label>Incident location</label><input id="k-loc" value="${esc(k.incidentLocation||'')}"></div></div>
 <div class="field" style="margin-bottom:8px"><label>Description</label><textarea id="k-desc" rows="3">${esc(k.description||'')}</textarea></div>
 <h3 style="font-family:var(--serif);font-size:13px;margin:14px 0 8px;color:var(--brass)">Primary defendant</h3>
 <div class="row"><div class="field"><label>Name</label><input id="k-defn" value="${esc(def.name)}"></div><div class="field"><label>Insurer</label><input id="k-defi" value="${esc(def.insurer)}"></div></div>
 <div class="row"><div class="field"><label>Insurer ref</label><input id="k-defr" value="${esc(def.refNumber)}"></div><div class="field"><label>Role</label><input id="k-defrole" value="${esc(def.role)}"></div></div>
 <div class="field" style="margin-bottom:8px"><label>Address</label><input id="k-defaddr" value="${esc(def.address)}"></div>
 <h3 style="font-family:var(--serif);font-size:13px;margin:14px 0 8px;color:var(--brass)">Fee arrangement</h3>
 <div class="row-3"><div class="field"><label>Basis</label><select id="k-fee"><option value="cfa">CFA</option><option value="dba">DBA</option><option value="hourly">hourly</option><option value="fixed">fixed</option><option value="legal-aid">legal aid</option></select></div><div class="field"><label>CFA success fee %</label><input id="k-cfapct" type="number" value="${esc(k.cfaSuccessFeePct||100)}"></div><div class="field"><label>DBA %</label><input id="k-dbapct" type="number" value="${esc(k.dbaPct||50)}"></div></div>
 <h3 style="font-family:var(--serif);font-size:13px;margin:14px 0 8px;color:var(--brass)">Status</h3>
 <div class="row"><div class="field"><label>Status</label><select id="k-st"><option value="intake">intake</option><option value="active">active</option><option value="settled">settled</option><option value="discontinued">discontinued</option><option value="won">won</option><option value="lost">lost</option></select></div><div class="field"><label>Limitation date</label><input id="k-lim" type="date" value="${k.limitationDate?isoDate(k.limitationDate):''}"></div></div>
 <div class="actions"><button class="btn ghost" onclick="closeModal()">cancel</button><button class="btn primary" id="k-save">save + broadcast</button></div>
 `;
 setTimeout(()=>{$('#k-type').value=k.type;$('#k-prot').value=k.protocol||'pre-action-pi';$('#k-fee').value=k.feeArrangement||'cfa';$('#k-st').value=k.status||'active'},10);
 $('#k-save').onclick=async()=>{
 const isNew=kind==='case-new';
 const id=isNew?'cs_'+crypto.randomUUID().slice(0,8):k.id;
 const upd={...(isNew?{liability:{admitted:false,contributoryPct:0,splitNotes:'',defendantsIdentified:[]},valuation:{specialDamages:[],generalDamages:{injuryBand:'',lower:0,upper:0,assessment:0},interest:0,totalEstimate:0},timeline:[],part36Offers:[],filedDocuments:[],feeRecords:[]}:k),
 id,firmId:state.firm?state.firm.id:'',ts:k.ts||now(),updatedAt:now(),closedAt:k.closedAt||null,
 ref:$('#k-ref').value,clientId:$('#k-cli').value,type:$('#k-type').value,
 incidentDate:$('#k-id').value,incidentLocation:$('#k-loc').value,description:$('#k-desc').value,
 responsibleHandlerId:k.responsibleHandlerId||state.ui.activeAdviserId||'',
 supervisingPartnerId:k.supervisingPartnerId||state.ui.activeAdviserId||'',
 protocol:$('#k-prot').value,
 feeArrangement:$('#k-fee').value,
 cfaSuccessFeePct:+$('#k-cfapct').value||100,
 cfaCappedDamagesPct:25,
 dbaPct:+$('#k-dbapct').value||50,
 ateInsurer:k.ateInsurer||'',atePremium:k.atePremium||0,
 status:$('#k-st').value,
 limitationDate:$('#k-lim').value?new Date($('#k-lim').value).getTime():null,
 liability:{admitted:k.liability&&k.liability.admitted||false,contributoryPct:k.liability&&k.liability.contributoryPct||0,splitNotes:k.liability&&k.liability.splitNotes||'',defendantsIdentified:[{name:$('#k-defn').value,insurer:$('#k-defi').value,refNumber:$('#k-defr').value,role:$('#k-defrole').value,address:$('#k-defaddr').value}]},
 portalRef:k.portalRef||'',letterOfClaimSentAt:k.letterOfClaimSentAt||null,responseDeadline:k.responseDeadline||null,defendantResponseAt:k.defendantResponseAt||null,
 outcome:k.outcome||'',settlementAmount:k.settlementAmount||0,settledAt:k.settledAt||null,paymentReceivedAt:k.paymentReceivedAt||null,
 nextStepDue:k.nextStepDue||null
 };
 const idx=state.cases.findIndex(x=>x.id===id);
 if(idx>=0)state.cases[idx]=upd;else state.cases.push(upd);
 await idbPut('cases',upd);
 await audit(isNew?'case.created':'case.updated',{clientId:upd.clientId,caseId:id,reasoning:isNew?'Case created':'Case edited',payload:{id,ref:upd.ref}});
 await emitCaseUpdate(upd);
 closeModal();render();toast(isNew?'case created · broadcast':'case saved · broadcast');
 };
 }
 m.classList.add('open');
}
function closeModal(){$('#modal').classList.remove('open')}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACTIONS · delegated click handlers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const ACTIONS={
 'goto-generate':()=>{state.active='generate';persistUI();render()},
 'goto-firm':()=>{state.active='firm';persistUI();render()},
 'goto-library':()=>{state.active='library';persistUI();render()},
 'resync':()=>{if(bcClaim){bcClaim.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{wants:['clients','advisers','firm','cases']}});toast('sync.request sent')}},
 'request-valuation':()=>{if(state.ui.selectedCaseId)requestValuation(state.ui.selectedCaseId)},
 'clear-valuation':()=>{state.ui.valuationFromFallClaim=null;persistUI();render()},
 'select-tpl':el=>{state.ui.selectedTemplateId=el.dataset.id;persistUI();render()},
 'select-tpl-editor':el=>{state.ui.selectedTemplateId=el.dataset.id;persistUI();render()},
 'open-doc':el=>{state.ui.selectedDocumentId=el.dataset.id;state.active='library';persistUI();render()},
 'close-doc':()=>{state.ui.selectedDocumentId=null;persistUI();render()},
 'del-doc':async el=>{
 if(!confirm('Delete this document record?'))return;
 const id=el.dataset.id;
 state.documents=state.documents.filter(d=>d.id!==id);
 await idbDel('documents',id);
 await audit('document.deleted',{reasoning:'User deleted document record.',payload:{id}});
 render();toast('deleted');
 },
 'mark-issued':async el=>{
 const id=el.dataset.id;const d=state.documents.find(x=>x.id===id);if(!d)return;
 d.status='issued';d.issuedAt=now();await idbPut('documents',d);
 await audit('document.issued',{clientId:d.clientId,caseId:d.caseId,reasoning:'Marked issued to recipient.',payload:{id}});
 render();toast('marked issued');
 },
 'mark-signed':async el=>{
 const id=el.dataset.id;const d=state.documents.find(x=>x.id===id);if(!d)return;
 d.status='signed';d.signed=true;d.signedAt=now();
 d.signatureHash=await sha256((d.html||'')+'|signed:'+d.signedAt);
 await idbPut('documents',d);
 await audit('document.signed',{clientId:d.clientId,caseId:d.caseId,reasoning:'Marked signed.',payload:{id,signatureHash:d.signatureHash}});
 render();toast('marked signed');
 },
 'export-md':()=>{
 const r=renderTemplate(state.ui.selectedTemplateId,state.ui.selectedClientId,state.ui.selectedCaseId,null);
 downloadText(r.markdown,(state.ui.selectedTemplateId||'doc')+'-preview.md','text/markdown');
 },
 'export-html':()=>{
 const r=renderTemplate(state.ui.selectedTemplateId,state.ui.selectedClientId,state.ui.selectedCaseId,null);
 downloadText(standaloneHtml(r.html),(state.ui.selectedTemplateId||'doc')+'-preview.html','text/html');
 },
 'export-doc-md':el=>{const d=state.documents.find(x=>x.id===el.dataset.id);if(!d)return;downloadText(d.markdown||'',(d.templateId||'doc')+'.md','text/markdown')},
 'export-doc-html':el=>{const d=state.documents.find(x=>x.id===el.dataset.id);if(!d)return;downloadText(standaloneHtml(d.html||''),(d.templateId||'doc')+'.html','text/html')},
 'hand-off-fallpdf':()=>{
 const r=renderTemplate(state.ui.selectedTemplateId,state.ui.selectedClientId,state.ui.selectedCaseId,null);
 const filename=(state.ui.selectedTemplateId||'doc')+'-'+((state.ui.selectedCaseId||'demo').slice(-6))+'.pdf';
 toast('handed off to FallPDF (if open)');
 },
 'commit-doc':async()=>{
 if(!state.ui.selectedClientId||!state.ui.selectedTemplateId){toast('pick a client and template');return}
 const tpl=state.templates.find(t=>t.id===state.ui.selectedTemplateId);
 const client=state.clients.find(c=>c.id===state.ui.selectedClientId);
 const kase=state.cases.find(k=>k.id===state.ui.selectedCaseId);
 const r=renderTemplate(tpl.id,client.id,kase?kase.id:null,null);
 const doc={
 id:'dc_'+crypto.randomUUID().slice(0,8),
 clientId:client.id,caseId:kase?kase.id:null,
 templateId:tpl.id,templateName:tpl.name,
 version:tpl.version,
 title:tpl.name+' · '+(client.firstName+' '+client.lastName)+(kase?' · '+kase.ref:'')+' · '+new Date().toLocaleDateString('en-GB'),
 html:r.html,markdown:r.markdown,
 sha256:await sha256(r.html),
 generatedAt:now(),generatedBy:state.ui.activeAdviserId||client.adviserId||'',
 signed:false,signedAt:null,signatureHash:'',
 status:'draft'
 };
 state.documents.push(doc);
 await idbPut('documents',doc);
 if(client.links){client.links.fallclaimpaperDocumentIds=client.links.fallclaimpaperDocumentIds||[];client.links.fallclaimpaperDocumentIds.push(doc.id);client.updatedAt=now();await idbPut('clients',client)}
 if(kase){kase.filedDocuments=kase.filedDocuments||[];kase.filedDocuments.push(doc.id);kase.updatedAt=now();await idbPut('cases',kase);await emitCaseUpdate(kase)}
 await audit('document.created',{clientId:client.id,caseId:kase?kase.id:'',reasoning:tpl.name+' generated for '+client.firstName+' '+client.lastName,payload:{id:doc.id,templateId:tpl.id,sha256:doc.sha256}});
 await emitDocCreated(doc);
 toast('committed · '+doc.id);
 state.ui.selectedDocumentId=doc.id;state.active='library';
 await persistUI();render();
 },
 'edit-section':()=>{},
 'reset-section':el=>{
 const tpl=el.dataset.tpl,sec=el.dataset.sec;
 if(state.ui.sectionOverrides[tpl])delete state.ui.sectionOverrides[tpl][sec];
 persistUI();render();
 },
 'edit-tpl-section':()=>{},
 'reset-tpl-section':el=>{
 const tpl=el.dataset.tpl,sec=el.dataset.sec;
 if(state.ui.sectionOverrides[tpl])delete state.ui.sectionOverrides[tpl][sec];
 persistUI();render();toast('section reset');
 },
 'save-tpl-overrides':async el=>{
 const tplId=el.dataset.tpl;
 const overrides=(state.ui.sectionOverrides||{})[tplId]||{};
 const rec={id:tplId,sectionOverrides:overrides,updatedAt:now()};
 await idbPut('templates',rec);
 state.templates=mergeTemplates(await idbGetAll('templates'));
 await audit('template.customised',{reasoning:'Template '+tplId+' customised.',payload:{id:tplId,sectionsChanged:Object.keys(overrides)}});
 toast('template customisations saved');render();
 },
 'client-new':()=>{openModal('client-new')},
 'client-edit':el=>{state._editingClientId=el.dataset.id;openModal('client-edit')},
 'client-generate':el=>{state.ui.selectedClientId=el.dataset.id;state.active='generate';persistUI();render()},
 'case-new':()=>{openModal('case-new')},
 'case-edit':el=>{state._editingCaseId=el.dataset.id;openModal('case-edit')},
 'case-generate':el=>{const k=state.cases.find(x=>x.id===el.dataset.id);if(k){state.ui.selectedCaseId=k.id;state.ui.selectedClientId=k.clientId;state.active='generate';persistUI();render()}},
 'adv-new':()=>{openModal('adv-new')},
 'adv-edit':el=>{state._editingAdvId=el.dataset.id;openModal('adv-edit')},
 'adv-active':async el=>{state.ui.activeAdviserId=el.dataset.id;await persistUI();render();toast('active handler set')},
 'firm-save':async()=>{
 const f=state.firm||{id:'fm_'+crypto.randomUUID().slice(0,8),createdAt:now()};
 f.updatedAt=now();
 f.name=$('#f-name').value;f.tradingName=$('#f-trading').value;f.fcaRefNo=$('#f-fca').value;f.companiesHouseNo=$('#f-ch').value;f.vatNumber=$('#f-vat').value;f.professionalBody=$('#f-pro').value;
 f.registeredAddress={line1:$('#f-a1').value,line2:$('#f-a2').value,city:$('#f-city').value,postcode:$('#f-pc').value,country:$('#f-cc').value};
 f.piInsurer=$('#f-pi').value;f.piPolicyNo=$('#f-pino').value;f.piExpiresAt=$('#f-pix').value?new Date($('#f-pix').value).getTime():null;
 f.setupCompletedAt=f.setupCompletedAt||now();
 state.firm=f;await idbPut('firms',f);
 await audit('firm.updated',{reasoning:'Firm record edited.',payload:{id:f.id,name:f.name}});
 await emitFirmUpdate();
 toast('firm saved · broadcast');render();
 },
 'chat-send':async()=>{
 const i=$('#chatQ');const q=(i.value||'').trim();if(!q)return;
 state.ui.chat=state.ui.chat||[];
 state.ui.chat.push({role:'user',text:q});
 i.value='';render();
 const a=await answerQuestion(q);
 state.ui.chat.push({role:'bot',text:a.text,source:a.source});
 await persistUI();render();
 requestAnimationFrame(()=>{const c=$('#chatBox');if(c)c.scrollTop=c.scrollHeight});
 },
 'audit-export':()=>{downloadText(JSON.stringify(state.audit,null,2),'fallclaimpaper-audit-'+new Date().toISOString().slice(0,10)+'.json','application/json')},
 'audit-verify':async()=>{
 let ok=true;let prevHash='';
 for(const e of state.audit){if((e.prevHash||'')!==prevHash){ok=false;break}prevHash=e.docHash}
 toast(ok?'chain intact · '+state.audit.length+' entries':'CHAIN BROKEN');
 }
};
const INPUTS={
 'select-client':el=>{state.ui.selectedClientId=el.value;state.ui.selectedCaseId=null;persistUI();render()},
 'select-case':el=>{state.ui.selectedCaseId=el.value;persistUI();render()},
 'edit-section':el=>{
 const tpl=el.dataset.tpl,sec=el.dataset.sec;
 state.ui.sectionOverrides[tpl]=state.ui.sectionOverrides[tpl]||{};
 state.ui.sectionOverrides[tpl][sec]=el.value;
 clearTimeout(window._sectEdit);
 window._sectEdit=setTimeout(()=>{render()},400);
 },
 'edit-tpl-section':el=>{
 const tpl=el.dataset.tpl,sec=el.dataset.sec;
 state.ui.sectionOverrides[tpl]=state.ui.sectionOverrides[tpl]||{};
 state.ui.sectionOverrides[tpl][sec]=el.value;
 },
 'lib-filter-client':el=>{state.ui.libFilterClient=el.value;persistUI();render()},
 'lib-filter-case':el=>{state.ui.libFilterCase=el.value;persistUI();render()},
 'lib-filter-tpl':el=>{state.ui.libFilterTpl=el.value;persistUI();render()},
 'lib-filter-status':el=>{state.ui.libFilterStatus=el.value;persistUI();render()},
 'chat-q':()=>{},
};
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORT helpers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function downloadText(text,filename,mime){
 const blob=new Blob([text],{type:mime||'text/plain'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();
 setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url)},100);
}
function standaloneHtml(inner){
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>FallClaimPaper document</title>
<style>
body{background:#f3eee2;color:#1a1611;font-family:'Libre Baskerville',Georgia,serif;font-size:13px;line-height:1.7;padding:40px;max-width:820px;margin:0 auto}
h1{font-size:22px;text-align:center;margin-bottom:6px}
h2{font-size:16px;margin:22px 0 8px;border-bottom:1px solid #cfc7b3;padding-bottom:4px;color:#3a1e10}
h3{font-size:14px;margin:16px 0 6px;font-style:italic}
p{margin:8px 0;text-align:justify}ul,ol{margin:8px 0 8px 22px}li{margin:3px 0}
.doc-meta{text-align:center;font-size:11px;color:#6a5a40;font-family:monospace;margin-bottom:18px;letter-spacing:0.08em}
.sig-block{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:30px;font-size:12px}
.sig-line{border-bottom:1px solid #1a1611;min-height:38px;margin-bottom:4px}
table{border-collapse:collapse;width:100%;margin:10px 0;font-family:sans-serif;font-size:12px}
th,td{border:1px solid #cfc7b3;padding:6px 9px}
th{background:#e6dec6;color:#3a1e10;text-align:left}
.clause-locked{background:#efe7d2;border-left:3px solid #8b1a1a;padding:8px 12px;margin:8px 0;font-size:12px;font-style:italic}
.clause-locked::before{content:'â—Š regulatory clause · ';font-family:monospace;font-size:9px;color:#8b1a1a;letter-spacing:0.08em;text-transform:uppercase;font-style:normal}
.placeholder-empty{background:#ffe9b3;color:#8b1a1a;padding:0 4px;border-radius:2px;font-weight:700}
hr{border:none;border-top:1px solid #cfc7b3;margin:14px 0}
</style></head><body>${inner}</body></html>`;
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KONOMI shim
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BOOT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(async function init(){
 try{
 await openDB();
 await loadAll();
 await maybeSeedDemo();
 await loadAll();
 await initMesh();
 render();
 setTimeout(()=>{if(bcClaim)bcClaim.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{wants:['clients','advisers','firm','cases']}})},500);
 }catch(e){
 console.error(e);
 }
})();

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { VERSION };
