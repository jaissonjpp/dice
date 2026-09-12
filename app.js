/**
 * Rolador de Dados — Gothic Theme
 * Storyteller 3rd Edition (Revised) Engine & Dice Roller
 */
(function () {
  'use strict';

  // ── Constantes & Tipos de Dados ───────────────────────────────────────────
  const DICE_TYPES = {
    d4:   { sides: 4,   icon: '◆', label: 'd4' },
    d6:   { sides: 6,   icon: '⬡', label: 'd6' },
    d8:   { sides: 8,   icon: '◈', label: 'd8' },
    d10:  { sides: 10,  icon: '⬟', label: 'd10' },
    d12:  { sides: 12,  icon: '⬠', label: 'd12' },
    d20:  { sides: 20,  icon: '⏣', label: 'd20' },
    d100: { sides: 100, icon: '◉', label: 'd100' }
  };
  const MAX_DICE = 20, MAX_HIST = 100, MAX_PRE = 20, ROLL_DUR = 600;
  const K_HIST = 'dice-roller-history', K_PRE = 'dice-roller-presets';

  // ── Estado ────────────────────────────────────────────────────────────────
  const dicePool = new Map();
  let history = [], presets = [];
  let isRolling = false, vampireMode = false, difficulty = 6;

  // ── Elementos DOM ─────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const $appLayout     = document.querySelector('.app-layout');
  const $diceGrid      = $('dice-grid');
  const $dicePool      = $('dice-pool');
  const $poolEmpty     = $('pool-empty');
  const $rollBtn       = $('roll-btn');
  const $resultsGrid   = $('results-grid');
  const $resultsTitle  = $('results-title');
  const $vampireToggle = $('vampire-toggle');
  const $vampireBar    = $('vampire-mode-bar');
  const $diffGroup     = $('difficulty-group');
  const $diffValue     = $('difficulty-value');
  const $diffControls  = document.querySelector('.difficulty-controls');
  const $vampireSum    = $('vampire-summary');
  const $vampireVal    = $('vampire-summary-value');
  const $vampireDet    = $('vampire-summary-detail');
  const $savePresetBtn = $('save-preset-btn');
  const $presetBox     = $('preset-save-container');
  const $presetInput   = $('preset-name-input');
  const $presetsSec    = $('presets-section');
  const $presetsList   = $('presets-list');
  const $historyClear  = $('history-clear');
  const $historyList   = $('history-list');
  const $historyPanel  = $('history-panel');
  const $mobileToggle  = $('history-mobile-toggle');

  // ── Helper de Storage ─────────────────────────────────────────────────────
  const storage = (key, val) => {
    try {
      if (val !== undefined) return localStorage.setItem(key, JSON.stringify(val));
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  };

  // ── Inicialização e Eventos ───────────────────────────────────────────────
  function init() {
    history = storage(K_HIST);
    presets = storage(K_PRE);
    renderHistory();
    renderPresets();
    bindEvents();
  }

  function bindEvents() {
    $diceGrid.addEventListener('click', e => {
      const btn = e.target.closest('.dice-btn');
      if (!btn || isRolling || btn.classList.contains('disabled-vampire')) return;
      updateDie(btn.dataset.die, 1);
    });

    $rollBtn.addEventListener('click', () => !isRolling && dicePool.size > 0 && rollAllDice());

    $dicePool.addEventListener('click', e => {
      if (isRolling) return;
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const { die, action } = target.dataset;
      if (action === 'increment') updateDie(die, 1);
      else if (action === 'decrement') updateDie(die, -1);
      else if (action === 'remove') updateDie(die, null);
    });

    $vampireToggle.addEventListener('change', () => {
      if (isRolling) { $vampireToggle.checked = vampireMode; return; }
      vampireMode = $vampireToggle.checked;
      applyVampireMode();
    });

    $('diff-up').addEventListener('click', () => setDifficulty(difficulty + 1));
    $('diff-down').addEventListener('click', () => setDifficulty(difficulty - 1));

    $savePresetBtn.addEventListener('click', () => {
      $presetBox.classList.remove('hidden');
      $presetInput.value = '';
      $presetInput.focus();
    });
    $('preset-confirm-btn').addEventListener('click', handleSavePreset);
    $('preset-cancel-btn').addEventListener('click', () => $presetBox.classList.add('hidden'));
    $presetInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSavePreset();
      if (e.key === 'Escape') $presetBox.classList.add('hidden');
    });

    $presetsList.addEventListener('click', e => {
      if (isRolling) return;
      const delBtn = e.target.closest('.preset-chip-delete');
      if (delBtn) {
        e.stopPropagation();
        deletePreset(parseInt(delBtn.dataset.index, 10));
        return;
      }
      const chip = e.target.closest('.preset-chip');
      if (chip) loadPreset(parseInt(chip.dataset.index, 10));
    });

    $historyClear.addEventListener('click', () => {
      history = [];
      storage(K_HIST, history);
      renderHistory();
    });

    $mobileToggle.addEventListener('click', toggleMobileHistory);
    document.addEventListener('click', e => {
      if ($historyPanel.classList.contains('open') && !$historyPanel.contains(e.target) && !$mobileToggle.contains(e.target)) {
        closeMobileHistory();
      }
    });
  }

  // ── Modo Vampiro & Dificuldade ────────────────────────────────────────────
  function setDifficulty(val) {
    if (val < 2 || val > 10) return;
    difficulty = val;
    $diffValue.textContent = difficulty;
    if ($diffControls) $diffControls.setAttribute('aria-valuenow', difficulty);
  }

  function applyVampireMode() {
    $vampireBar.classList.toggle('active', vampireMode);
    $diffGroup.classList.toggle('hidden', !vampireMode);
    document.querySelectorAll('.dice-btn').forEach(btn => {
      if (btn.dataset.die !== 'd10') btn.classList.toggle('disabled-vampire', vampireMode);
    });

    if (vampireMode) {
      for (const [type] of dicePool) if (type !== 'd10') dicePool.delete(type);
      renderPool();
    }
    clearResults();
  }

  function clearResults() {
    $resultsGrid.innerHTML = '';
    $resultsTitle.classList.add('hidden');
    $vampireSum.classList.add('hidden');
  }

  // ── Gerenciamento do Pool de Dados ────────────────────────────────────────
  function updateDie(type, delta) {
    if (!DICE_TYPES[type] || (vampireMode && type !== 'd10')) return;
    const current = dicePool.get(type) || 0;
    if (delta === null || current + delta <= 0) {
      dicePool.delete(type);
    } else {
      dicePool.set(type, Math.min(MAX_DICE, current + delta));
    }
    renderPool();
  }

  function renderPool() {
    const empty = dicePool.size === 0;
    $poolEmpty.classList.toggle('hidden', !empty);
    $savePresetBtn.classList.toggle('hidden', empty);
    if (empty) $presetBox.classList.add('hidden');
    $rollBtn.disabled = empty;

    $dicePool.querySelectorAll('.pool-item').forEach(el => el.remove());
    if (empty) return;

    Object.keys(DICE_TYPES).filter(t => dicePool.has(t)).forEach(type => {
      const qty = dicePool.get(type), info = DICE_TYPES[type];
      const el = document.createElement('div');
      el.className = 'pool-item';
      el.dataset.die = type;
      el.innerHTML = `
        <span class="pool-item-icon">${info.icon}</span>
        <span class="pool-item-name">${qty}× ${info.label}</span>
        <div class="pool-item-controls">
          <button class="qty-btn" data-action="decrement" data-die="${type}" type="button" aria-label="Diminuir ${info.label}">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="increment" data-die="${type}" type="button" aria-label="Aumentar ${info.label}">+</button>
        </div>
        <button class="remove-btn" data-action="remove" data-die="${type}" type="button" aria-label="Remover ${info.label}">✕</button>
      `;
      $dicePool.appendChild(el);
    });
  }

  // ── Motor de Rolagem (CSPRNG & Animação) ───────────────────────────────────
  function rollDie(sides) {
    if (window.crypto && window.crypto.getRandomValues) {
      const limit = 0xFFFFFFFF - (0xFFFFFFFF % sides);
      const buf = new Uint32Array(1);
      let rand;
      do {
        window.crypto.getRandomValues(buf);
        rand = buf[0];
      } while (rand >= limit);
      return (rand % sides) + 1;
    }
    return Math.floor(Math.random() * sides) + 1;
  }

  async function rollAllDice() {
    if (isRolling || dicePool.size === 0) return;
    isRolling = true;
    try {
      $rollBtn.classList.add('rolling');
      $rollBtn.disabled = true;
      $vampireToggle.disabled = true;
      clearResults();
      $resultsTitle.classList.remove('hidden');

      const diceToRoll = [];
      for (const [type, qty] of dicePool) {
        for (let i = 0; i < qty; i++) diceToRoll.push({ type, sides: DICE_TYPES[type].sides });
      }

      const resultEls = diceToRoll.map((die, idx) => {
        const el = document.createElement('div');
        el.className = 'result-die rolling-anim';
        el.style.animationDelay = `${idx * 60}ms`;
        el.innerHTML = `<span class="result-value">?</span><span class="result-type">${die.type}</span>`;
        $resultsGrid.appendChild(el);
        return { el, die };
      });

      const intervals = resultEls.map(({ el, die }) => {
        const valEl = el.querySelector('.result-value');
        return setInterval(() => { valEl.textContent = Math.floor(Math.random() * die.sides) + 1; }, 50);
      });

      await new Promise(res => setTimeout(res, ROLL_DUR));

      const results = resultEls.map(({ el, die }, i) => {
        clearInterval(intervals[i]);
        const value = rollDie(die.sides);
        el.querySelector('.result-value').textContent = value;
        el.classList.remove('rolling-anim');

        if (vampireMode) {
          if (value === 10) el.classList.add('is-special-success');
          else if (value >= difficulty) el.classList.add('is-success');
          else if (value === 1) el.classList.add('is-cancel');
        } else {
          if (value === die.sides) el.classList.add('is-max');
          else if (value === 1) el.classList.add('is-one');
        }
        return { type: die.type, sides: die.sides, value };
      });

      const vampireResult = vampireMode ? calculateVampireResult(results) : null;
      if (vampireResult) showVampireSummary(vampireResult);
      saveRoll(results, vampireResult);
    } finally {
      $rollBtn.classList.remove('rolling');
      $rollBtn.disabled = dicePool.size === 0;
      $vampireToggle.disabled = false;
      isRolling = false;
    }
  }

  // ── Regras da 3ª Edição de Vampiro (Storyteller Revised) ───────────────────
  function calculateVampireResult(results) {
    let rawSuccesses = 0, ones = 0, tens = 0;
    results.forEach(r => {
      if (r.value === 10) { rawSuccesses++; tens++; }
      else if (r.value >= difficulty) rawSuccesses++;
      else if (r.value === 1) ones++;
    });

    const net = rawSuccesses - ones;
    let type = 'failure';
    if (net > 0) type = 'success';
    else if (rawSuccesses === 0 && ones > 0) type = 'critical-failure'; // Botch genuíno

    return { rawSuccesses, ones, tens, net: Math.max(0, net), type, difficulty };
  }

  function showVampireSummary(res) {
    $vampireSum.classList.remove('hidden');
    $vampireVal.className = 'vampire-summary-value ' + res.type;

    if (res.type === 'success') {
      $vampireVal.textContent = `${res.net} ${res.net === 1 ? 'Sucesso' : 'Sucessos'}`;
      const det = [];
      if (res.tens > 0) det.push(`${res.tens} no 10`);
      if (res.ones > 0) det.push(`${res.ones} cancelado(s) por 1`);
      det.push(`Dif. ${res.difficulty}`);
      $vampireDet.textContent = det.join(' · ');
    } else if (res.type === 'critical-failure') {
      $vampireVal.textContent = 'Falha Crítica!';
      $vampireDet.textContent = `Nenhum sucesso e ${res.ones} dado(s) com valor 1 (Dif. ${res.difficulty})`;
      $appLayout.classList.add('screen-shake');
      setTimeout(() => $appLayout.classList.remove('screen-shake'), 500);
    } else {
      $vampireVal.textContent = 'Falha';
      $vampireDet.textContent = res.rawSuccesses > 0
        ? `${res.rawSuccesses} sucesso(s) anulado(s) por dados com valor 1 (Dif. ${res.difficulty})`
        : `Nenhum dado atingiu a dificuldade ${res.difficulty}`;
    }
  }

  // ── Favoritos (Presets) ───────────────────────────────────────────────────
  function handleSavePreset() {
    const name = $presetInput.value.trim();
    if (!name) return $presetInput.focus();
    const pool = {};
    for (const [type, qty] of dicePool) pool[type] = qty;

    const preset = { name, pool, vampireMode };
    if (vampireMode) preset.difficulty = difficulty;

    presets.push(preset);
    if (presets.length > MAX_PRE) presets.shift();
    storage(K_PRE, presets);
    renderPresets();
    $presetBox.classList.add('hidden');
  }

  function loadPreset(idx) {
    const p = presets[idx];
    if (!p) return;
    clearResults();

    if (p.vampireMode !== vampireMode) {
      vampireMode = p.vampireMode;
      $vampireToggle.checked = vampireMode;
      applyVampireMode();
    }
    if (vampireMode) setDifficulty(p.difficulty || 6);

    dicePool.clear();
    for (const [type, qty] of Object.entries(p.pool)) {
      if (DICE_TYPES[type] && (!vampireMode || type === 'd10')) dicePool.set(type, qty);
    }
    renderPool();
  }

  function deletePreset(idx) {
    presets.splice(idx, 1);
    storage(K_PRE, presets);
    renderPresets();
  }

  function renderPresets() {
    $presetsList.innerHTML = '';
    $presetsSec.classList.toggle('hidden', presets.length === 0);
    presets.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.dataset.index = i;
      const diceStr = Object.entries(p.pool).map(([t, q]) => `${q}${t}`).join('+');
      chip.innerHTML = `
        <span class="preset-chip-name">${escapeHtml(p.name)}${p.vampireMode ? ' 🦇' : ''}</span>
        <span class="preset-chip-dice">${diceStr}</span>
        <button class="preset-chip-delete" data-index="${i}" type="button" title="Excluir">✕</button>
      `;
      $presetsList.appendChild(chip);
    });
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  function saveRoll(results, vampire) {
    const pool = {};
    for (const [t, q] of dicePool) pool[t] = q;
    history.unshift({ timestamp: Date.now(), pool, results, vampire });
    if (history.length > MAX_HIST) history.pop();
    storage(K_HIST, history);
    renderHistory();
  }

  function renderHistory() {
    $historyList.innerHTML = '';
    $historyClear.classList.toggle('hidden', history.length === 0);
    if (history.length === 0) {
      $historyList.innerHTML = '<div class="history-empty">Nenhuma rolagem ainda</div>';
      return;
    }

    history.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'history-entry';
      const timeStr = new Date(entry.timestamp).toLocaleTimeString('pt-BR');
      const diceStr = Object.entries(entry.pool).map(([t, q]) => `${q}${t}`).join(' + ');
      const resultsStr = entry.results.map(r => r.value).join(', ');

      let vHtml = '';
      if (entry.vampire) {
        const v = entry.vampire, diff = v.difficulty ? ` · Dif. ${v.difficulty}` : '';
        const txt = v.type === 'success' ? `${v.net} sucesso(s)${diff}` : (v.type === 'critical-failure' ? `Falha Crítica!${diff}` : `Falha${diff}`);
        vHtml = `<span class="entry-vampire-result ${v.type}">${txt}</span>`;
      }

      el.innerHTML = `
        <div class="entry-header"><span class="entry-dice">${diceStr}</span><span class="entry-time">${timeStr}</span></div>
        <span class="entry-results">${resultsStr}</span>${vHtml}
      `;
      $historyList.appendChild(el);
    });
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
  function toggleMobileHistory() {
    const open = $historyPanel.classList.toggle('open');
    $mobileToggle.classList.toggle('active', open);
    $mobileToggle.setAttribute('aria-label', open ? 'Fechar histórico' : 'Abrir histórico');
  }

  function closeMobileHistory() {
    $historyPanel.classList.remove('open');
    $mobileToggle.classList.remove('active');
    $mobileToggle.setAttribute('aria-label', 'Abrir histórico');
  }


  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
