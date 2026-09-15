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
  const MAX_DICE = 100, MAX_HIST = 100, MAX_PRE = 20, ROLL_DUR = 600;
  const K_HIST = 'dice-roller-history', K_PRE = 'dice-roller-presets', K_COLLAPSED = 'dice-roller-history-collapsed';

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
  const $diffDown      = $('diff-down');
  const $diffUp        = $('diff-up');
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
  const $historyPanel    = $('history-panel');
  const $mobileToggle    = $('history-mobile-toggle');
  const $historyCloseBtn = $('history-close-btn');
  const $historyBackdrop = $('history-backdrop');

  // ── Helper de Storage Unificado ───────────────────────────────────────────
  const storage = {
    get: (key, fallback = null) => {
      try {
        const item = localStorage.getItem(key);
        if (item === null) return fallback;
        try {
          return JSON.parse(item);
        } catch (_) {
          return item;
        }
      } catch (_) {
        return fallback;
      }
    },
    set: (key, val) => {
      try {
        const toStore = typeof val === 'object' ? JSON.stringify(val) : String(val);
        localStorage.setItem(key, toStore);
      } catch (_) { /* noop */ }
    }
  };

  // ── Inicialização e Eventos ───────────────────────────────────────────────
  function init() {
    history = storage.get(K_HIST, []);
    presets = storage.get(K_PRE, []);
    $vampireToggle.checked = false;
    vampireMode = false;
    renderHistory();
    renderPresets();
    updateDifficultyControls();
    bindEvents();
    if (storage.get(K_COLLAPSED) === 'true' && !isMobile()) {
      collapseDesktopHistory(true);
    }
  }

  function bindEvents() {
    $diceGrid.addEventListener('click', e => {
      const btn = e.target.closest('.dice-btn');
      if (!btn || isRolling || btn.classList.contains('disabled-vampire')) return;
      const step = e.shiftKey ? 5 : 1;
      updateDie(btn.dataset.die, step);
    });

    $rollBtn.addEventListener('click', rollAllDice);

    $dicePool.addEventListener('click', e => {
      if (isRolling) return;
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const { die, action } = target.dataset;
      const step = e.shiftKey ? 5 : 1;
      if (action === 'increment') updateDie(die, step);
      else if (action === 'decrement') updateDie(die, -step);
      else if (action === 'remove') updateDie(die, null);
    });

    $dicePool.addEventListener('change', e => {
      if (!isRolling && e.target.classList.contains('qty-input')) {
        setDieQty(e.target.dataset.die, e.target.value);
      }
    });

    $dicePool.addEventListener('keydown', e => {
      if (e.target.classList.contains('qty-input') && e.key === 'Enter') {
        e.target.blur();
      }
    });

    $vampireToggle.addEventListener('change', () => {
      if (isRolling) { $vampireToggle.checked = vampireMode; return; }
      vampireMode = $vampireToggle.checked;
      applyVampireMode();
    });

    if ($diffUp) $diffUp.addEventListener('click', () => { if (!isRolling) setDifficulty(difficulty + 1); });
    if ($diffDown) $diffDown.addEventListener('click', () => { if (!isRolling) setDifficulty(difficulty - 1); });

    $savePresetBtn.addEventListener('click', () => {
      if (isRolling) return;
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
      if (isRolling) return;
      history = [];
      storage.set(K_HIST, history);
      renderHistory();
    });

    $mobileToggle.addEventListener('click', toggleHistory);
    if ($historyCloseBtn) $historyCloseBtn.addEventListener('click', closeHistory);
    if ($historyBackdrop) {
      $historyBackdrop.addEventListener('click', e => {
        e.stopPropagation();
        closeMobileHistory();
      });
    }
    document.addEventListener('click', e => {
      if ($historyPanel.classList.contains('open') && !$historyPanel.contains(e.target) && !$mobileToggle.contains(e.target)) {
        closeMobileHistory();
      }
    });

    window.addEventListener('resize', () => {
      if (isMobile()) {
        $mobileToggle.classList.remove('desktop-visible');
      } else {
        closeMobileHistory();
        $mobileToggle.classList.toggle('desktop-visible', storage.get(K_COLLAPSED) === 'true');
      }
    });
  }

  // ── Modo Vampiro & Dificuldade ────────────────────────────────────────────
  function setDifficulty(val) {
    if (val < 2 || val > 10) return;
    difficulty = val;
    $diffValue.textContent = difficulty;
    updateDifficultyControls();
  }

  function updateDifficultyControls() {
    if ($diffDown) $diffDown.disabled = isRolling || difficulty <= 2;
    if ($diffUp) $diffUp.disabled = isRolling || difficulty >= 10;
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
  function setDieQty(type, qty) {
    if (!DICE_TYPES[type] || (vampireMode && type !== 'd10')) return;
    const val = parseInt(qty, 10);
    if (isNaN(val) || val <= 0) {
      dicePool.delete(type);
    } else {
      dicePool.set(type, Math.min(MAX_DICE, Math.max(1, val)));
    }
    renderPool();
  }

  function updateDie(type, delta) {
    if (delta === null) setDieQty(type, 0);
    else setDieQty(type, (dicePool.get(type) || 0) + delta);
  }

  function renderPool() {
    const empty = dicePool.size === 0;
    $poolEmpty.classList.toggle('hidden', !empty);
    $savePresetBtn.classList.toggle('hidden', empty);
    if (empty) $presetBox.classList.add('hidden');
    $rollBtn.disabled = empty;

    // Remove elementos que não estão mais no pool
    $dicePool.querySelectorAll('.pool-item').forEach(el => {
      if (!dicePool.has(el.dataset.die)) el.remove();
    });

    if (empty) return;

    Object.keys(DICE_TYPES).filter(t => dicePool.has(t)).forEach(type => {
      const qty = dicePool.get(type), info = DICE_TYPES[type];
      let el = $dicePool.querySelector(`.pool-item[data-die="${type}"]`);

      if (el) {
        // Atualiza elemento existente sem reiniciar animação
        const nameEl = el.querySelector('.pool-item-name');
        const inputEl = el.querySelector('.qty-input');
        if (nameEl) nameEl.textContent = `${qty}× ${info.label}`;
        if (inputEl && document.activeElement !== inputEl) inputEl.value = qty;
      } else {
        // Novo elemento: adiciona animação apenas de entrada inicial
        el = document.createElement('div');
        el.className = 'pool-item pool-item-enter';
        el.dataset.die = type;
        el.innerHTML = `
          <span class="pool-item-icon">${info.icon}</span>
          <span class="pool-item-name">${qty}× ${info.label}</span>
          <div class="pool-item-controls">
            <button class="qty-btn" data-action="decrement" data-die="${type}" type="button" aria-label="Diminuir ${info.label}">−</button>
            <input type="number" class="qty-input" data-die="${type}" min="1" max="${MAX_DICE}" value="${qty}" aria-label="Quantidade de ${info.label}" title="Clique para digitar a quantidade">
            <button class="qty-btn" data-action="increment" data-die="${type}" type="button" aria-label="Aumentar ${info.label}">+</button>
          </div>
          <button class="remove-btn" data-action="remove" data-die="${type}" type="button" aria-label="Remover ${info.label}">✕</button>
        `;
        $dicePool.appendChild(el);
      }
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
    let activeIntervals = [];
    try {
      $rollBtn.classList.add('rolling');
      $rollBtn.disabled = true;
      $vampireToggle.disabled = true;
      updateDifficultyControls();
      $dicePool.querySelectorAll('.qty-input, .qty-btn, .remove-btn').forEach(el => { el.disabled = true; });
      clearResults();
      $resultsTitle.classList.remove('hidden');

      const diceToRoll = [];
      for (const [type, qty] of dicePool) {
        for (let i = 0; i < qty; i++) diceToRoll.push({ type, sides: DICE_TYPES[type].sides });
      }

      const delayStep = diceToRoll.length > 20 ? Math.max(4, 350 / diceToRoll.length) : 50;
      const resultEls = diceToRoll.map((die, idx) => {
        const el = document.createElement('div');
        el.className = 'result-die rolling-anim';
        el.style.animationDelay = `${Math.min(idx * delayStep, 350)}ms`;
        el.innerHTML = `<span class="result-value">?</span><span class="result-type">${die.type}</span>`;
        $resultsGrid.appendChild(el);
        const valEl = el.querySelector('.result-value');
        const intervalId = setInterval(() => { valEl.textContent = Math.floor(Math.random() * die.sides) + 1; }, 50);
        activeIntervals.push(intervalId);
        return { el, die, valEl };
      });

      await new Promise(res => setTimeout(res, ROLL_DUR));

      activeIntervals.forEach(clearInterval);
      activeIntervals = [];

      const results = resultEls.map(({ el, die, valEl }) => {
        const value = rollDie(die.sides);
        valEl.textContent = value;
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
      activeIntervals.forEach(clearInterval);
      activeIntervals = [];
      $rollBtn.classList.remove('rolling');
      $rollBtn.disabled = dicePool.size === 0;
      $vampireToggle.disabled = false;
      $dicePool.querySelectorAll('.qty-input, .qty-btn, .remove-btn').forEach(el => { el.disabled = false; });
      isRolling = false;
      updateDifficultyControls();
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

  // ── Helper de Formatação do Pool ─────────────────────────────────────────
  function formatPool(pool, vampireInfo = null) {
    const parts = Object.entries(pool).map(([t, q]) => `${q}${t}`);
    const base = parts.join(' + ');
    if (vampireInfo && vampireInfo.difficulty) {
      return `${base} (Dif. ${vampireInfo.difficulty})`;
    }
    return base;
  }

  // ── Favoritos (Presets) ───────────────────────────────────────────────────
  function handleSavePreset() {
    const name = $presetInput.value.trim();
    if (!name) return $presetInput.focus();
    const pool = Object.fromEntries(dicePool);

    const preset = { name, pool, vampireMode };
    if (vampireMode) preset.difficulty = difficulty;

    presets.push(preset);
    if (presets.length > MAX_PRE) presets.shift();
    storage.set(K_PRE, presets);
    renderPresets();
    $presetBox.classList.add('hidden');
  }

  function loadPreset(idx) {
    const p = presets[idx];
    if (!p) return;
    clearResults();

    const modeChanged = p.vampireMode !== vampireMode;
    vampireMode = !!p.vampireMode;
    $vampireToggle.checked = vampireMode;

    if (modeChanged) {
      $vampireBar.classList.toggle('active', vampireMode);
      $diffGroup.classList.toggle('hidden', !vampireMode);
      document.querySelectorAll('.dice-btn').forEach(btn => {
        if (btn.dataset.die !== 'd10') btn.classList.toggle('disabled-vampire', vampireMode);
      });
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
    storage.set(K_PRE, presets);
    renderPresets();
  }

  function renderPresets() {
    $presetsList.innerHTML = '';
    $presetsSec.classList.toggle('hidden', presets.length === 0);
    presets.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.dataset.index = i;
      const vInfo = p.vampireMode ? { difficulty: p.difficulty || 6 } : null;
      const diceStr = formatPool(p.pool, vInfo);
      chip.innerHTML = `
        <span class="preset-chip-name">${escapeHtml(p.name)}${p.vampireMode ? ' 🦇' : ''}</span>
        <span class="preset-chip-dice">${diceStr}</span>
        <button class="preset-chip-delete" data-index="${i}" type="button" title="Excluir">✕</button>
      `;
      $presetsList.appendChild(chip);
    });
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  function createHistoryElement(entry, animate = false) {
    const el = document.createElement('div');
    el.className = 'history-entry' + (animate ? ' history-entry-enter' : '');
    const timeStr = new Date(entry.timestamp).toLocaleTimeString('pt-BR');
    const diceStr = formatPool(entry.pool);
    const resultsStr = entry.results.map(r => r.value).join(', ');

    let vHtml = '';
    if (entry.vampire) {
      const v = entry.vampire, diff = v.difficulty ? ` · Dif. ${v.difficulty}` : '';
      const count = v.net;
      const successLabel = count === 1 ? 'sucesso' : 'sucessos';
      const txt = v.type === 'success' ? `${count} ${successLabel}${diff}` : (v.type === 'critical-failure' ? `Falha Crítica!${diff}` : `Falha${diff}`);
      vHtml = `<span class="entry-vampire-result ${v.type}">${txt}</span>`;
    }

    el.innerHTML = `
      <div class="entry-header"><span class="entry-dice">${diceStr}</span><span class="entry-time">${timeStr}</span></div>
      <span class="entry-results">${resultsStr}</span>${vHtml}
    `;
    return el;
  }

  function saveRoll(results, vampire) {
    const pool = Object.fromEntries(dicePool);
    const entry = { timestamp: Date.now(), pool, results, vampire };
    history.unshift(entry);
    if (history.length > MAX_HIST) history.pop();
    storage.set(K_HIST, history);

    const emptyEl = $historyList.querySelector('.history-empty');
    if (emptyEl) emptyEl.remove();
    $historyClear.classList.remove('hidden');

    const el = createHistoryElement(entry, true);
    $historyList.prepend(el);

    while ($historyList.children.length > MAX_HIST) {
      $historyList.lastElementChild.remove();
    }
  }

  function renderHistory() {
    $historyList.innerHTML = '';
    $historyClear.classList.toggle('hidden', history.length === 0);
    if (history.length === 0) {
      $historyList.innerHTML = '<div class="history-empty">Nenhuma rolagem ainda</div>';
      return;
    }

    history.forEach(entry => {
      $historyList.appendChild(createHistoryElement(entry, false));
    });
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function toggleHistory(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if ($historyPanel.classList.contains('open')) {
      closeMobileHistory();
    } else if (isMobile()) {
      toggleMobileHistory();
    } else {
      const isCollapsed = $historyPanel.classList.contains('collapsed');
      collapseDesktopHistory(!isCollapsed);
    }
  }

  function closeHistory(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    closeMobileHistory();
    if (!isMobile()) {
      collapseDesktopHistory(true);
    }
  }

  function collapseDesktopHistory(collapse) {
    $historyPanel.classList.toggle('collapsed', collapse);
    $mobileToggle.classList.toggle('desktop-visible', collapse);
    storage.set(K_COLLAPSED, collapse);
  }

  function toggleMobileHistory() {
    const open = $historyPanel.classList.toggle('open');
    $mobileToggle.classList.toggle('active', open);
    $mobileToggle.setAttribute('aria-label', open ? 'Fechar histórico' : 'Abrir histórico');
    if ($historyBackdrop) $historyBackdrop.classList.toggle('open', open);
  }

  function closeMobileHistory() {
    $historyPanel.classList.remove('open');
    $mobileToggle.classList.remove('active');
    $mobileToggle.setAttribute('aria-label', 'Abrir histórico');
    if ($historyBackdrop) $historyBackdrop.classList.remove('open');
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
