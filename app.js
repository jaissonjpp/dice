/**
 * Rolador de Dados — Gothic Theme
 * Core application logic: dice pool, rolling, vampire mode, presets, and history.
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────

  const DICE_TYPES = {
    d4:   { sides: 4,   icon: '◆',  label: 'd4'   },
    d6:   { sides: 6,   icon: '⬡',  label: 'd6'   },
    d8:   { sides: 8,   icon: '◈',  label: 'd8'   },
    d10:  { sides: 10,  icon: '⬟',  label: 'd10'  },
    d12:  { sides: 12,  icon: '⬠',  label: 'd12'  },
    d20:  { sides: 20,  icon: '⏣',  label: 'd20'  },
    d100: { sides: 100, icon: '◉',  label: 'd100' },
  };

  const MAX_DICE_PER_TYPE = 20;
  const MAX_HISTORY = 100;
  const MAX_PRESETS = 20;
  const ROLL_ANIMATION_DURATION = 600;
  const ROLL_ANIMATION_INTERVAL = 50;
  const STORAGE_HISTORY = 'dice-roller-history';
  const STORAGE_PRESETS = 'dice-roller-presets';

  // ── State ──────────────────────────────────────────────────────────────

  /** @type {Map<string, number>} die type → quantity */
  const dicePool = new Map();

  /** @type {Array<Object>} */
  let history = [];

  /** @type {Array<{name: string, pool: Object, vampireMode: boolean, difficulty: number}>} */
  let presets = [];

  let isRolling = false;
  let vampireMode = false;
  let difficulty = 6;

  // ── DOM References ─────────────────────────────────────────────────────

  const $appLayout       = document.querySelector('.app-layout');
  const $diceGrid        = document.getElementById('dice-grid');
  const $dicePool        = document.getElementById('dice-pool');
  const $poolEmpty       = document.getElementById('pool-empty');
  const $rollBtn         = document.getElementById('roll-btn');
  const $resultsGrid     = document.getElementById('results-grid');
  const $resultsTitle    = document.getElementById('results-title');
  const $historyClear    = document.getElementById('history-clear');
  const $historyList     = document.getElementById('history-list');
  const $historyPanel    = document.getElementById('history-panel');
  const $mobileToggle    = document.getElementById('history-mobile-toggle');

  // Vampire Mode
  const $vampireToggle   = document.getElementById('vampire-toggle');
  const $vampireModeBar  = document.getElementById('vampire-mode-bar');
  const $difficultyGroup = document.getElementById('difficulty-group');
  const $difficultyValue = document.getElementById('difficulty-value');
  const $diffUp          = document.getElementById('diff-up');
  const $diffDown        = document.getElementById('diff-down');
  const $vampireSummary  = document.getElementById('vampire-summary');
  const $vampireSumVal   = document.getElementById('vampire-summary-value');
  const $vampireSumDet   = document.getElementById('vampire-summary-detail');

  // Presets
  const $savePresetBtn   = document.getElementById('save-preset-btn');
  const $presetsSection  = document.getElementById('presets-section');
  const $presetsList     = document.getElementById('presets-list');

  // ── Initialization ─────────────────────────────────────────────────────

  function init() {
    loadHistory();
    loadPresets();
    renderHistory();
    renderPresets();
    bindEvents();
  }

  // ── Event Binding ──────────────────────────────────────────────────────

  function bindEvents() {
    // Dice selector buttons
    $diceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.dice-btn');
      if (!btn || isRolling || btn.classList.contains('disabled-vampire')) return;
      addDie(btn.dataset.die);
      createRipple(btn, e);
    });

    // Roll button
    $rollBtn.addEventListener('click', () => {
      if (isRolling || dicePool.size === 0) return;
      rollAllDice();
    });

    // History
    $historyClear.addEventListener('click', clearHistory);
    $mobileToggle.addEventListener('click', toggleMobileHistory);

    // Pool delegation
    $dicePool.addEventListener('click', (e) => {
      if (isRolling) return;
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const die = target.dataset.die;
      const action = target.dataset.action;
      if (action === 'increment') incrementDie(die);
      else if (action === 'decrement') decrementDie(die);
      else if (action === 'remove') removeDie(die);
    });

    // Vampire Mode toggle
    $vampireToggle.addEventListener('change', () => {
      vampireMode = $vampireToggle.checked;
      applyVampireMode();
    });

    // Difficulty controls
    $diffUp.addEventListener('click', () => {
      if (difficulty < 10) {
        difficulty++;
        $difficultyValue.textContent = difficulty;
      }
    });
    $diffDown.addEventListener('click', () => {
      if (difficulty > 2) {
        difficulty--;
        $difficultyValue.textContent = difficulty;
      }
    });

    // Save preset
    $savePresetBtn.addEventListener('click', showPresetSaveInput);

    // Presets list delegation
    $presetsList.addEventListener('click', (e) => {
      if (isRolling) return;
      const delBtn = e.target.closest('.preset-chip-delete');
      if (delBtn) {
        e.stopPropagation();
        const index = parseInt(delBtn.dataset.index);
        deletePreset(index);
        return;
      }
      const chip = e.target.closest('.preset-chip');
      if (chip) {
        loadPreset(parseInt(chip.dataset.index));
      }
    });

    // Close mobile history when clicking outside
    document.addEventListener('click', (e) => {
      if (
        $historyPanel.classList.contains('open') &&
        !$historyPanel.contains(e.target) &&
        !$mobileToggle.contains(e.target)
      ) {
        closeMobileHistory();
      }
    });
  }

  // ── Vampire Mode ───────────────────────────────────────────────────────

  function applyVampireMode() {
    // Toggle bar active state
    $vampireModeBar.classList.toggle('active', vampireMode);

    // Show/hide difficulty
    $difficultyGroup.classList.toggle('hidden', !vampireMode);

    // Disable/enable non-d10 dice
    document.querySelectorAll('.dice-btn').forEach(btn => {
      if (btn.dataset.die !== 'd10') {
        btn.classList.toggle('disabled-vampire', vampireMode);
      }
    });

    // If vampire mode on, clear non-d10 from pool
    if (vampireMode) {
      const nonD10 = [];
      for (const [type] of dicePool) {
        if (type !== 'd10') nonD10.push(type);
      }
      nonD10.forEach(t => dicePool.delete(t));
      renderPool();
      updateRollButton();
    }

    // Clear results
    $resultsGrid.innerHTML = '';
    $resultsTitle.classList.add('hidden');
    $vampireSummary.classList.add('hidden');
  }

  // ── Dice Pool Management ───────────────────────────────────────────────

  function addDie(type) {
    if (!DICE_TYPES[type]) return;
    if (vampireMode && type !== 'd10') return;
    const current = dicePool.get(type) || 0;
    if (current >= MAX_DICE_PER_TYPE) return;
    dicePool.set(type, current + 1);
    renderPool();
    updateRollButton();
  }

  function incrementDie(type) {
    const current = dicePool.get(type) || 0;
    if (current >= MAX_DICE_PER_TYPE) return;
    dicePool.set(type, current + 1);
    renderPool();
  }

  function decrementDie(type) {
    const current = dicePool.get(type) || 0;
    if (current <= 1) { removeDie(type); return; }
    dicePool.set(type, current - 1);
    renderPool();
  }

  function removeDie(type) {
    dicePool.delete(type);
    renderPool();
    updateRollButton();
  }

  // ── Pool Rendering ─────────────────────────────────────────────────────

  function renderPool() {
    if (dicePool.size === 0) {
      $poolEmpty.classList.remove('hidden');
      $savePresetBtn.classList.add('hidden');
      $dicePool.querySelectorAll('.pool-item').forEach(el => el.remove());
      updateRollButton();
      return;
    }

    $poolEmpty.classList.add('hidden');
    $savePresetBtn.classList.remove('hidden');

    const orderedTypes = Object.keys(DICE_TYPES).filter(t => dicePool.has(t));

    $dicePool.querySelectorAll('.pool-item').forEach(el => {
      if (!dicePool.has(el.dataset.die)) el.remove();
    });

    orderedTypes.forEach(type => {
      const qty = dicePool.get(type);
      const info = DICE_TYPES[type];
      let el = $dicePool.querySelector(`.pool-item[data-die="${type}"]`);

      if (el) {
        el.querySelector('.qty-value').textContent = qty;
      } else {
        el = document.createElement('div');
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
      }

      el.querySelector('.pool-item-name').textContent = `${qty}× ${info.label}`;
    });
  }

  function updateRollButton() {
    $rollBtn.disabled = dicePool.size === 0;
  }

  // ── Rolling Logic (Cryptographically Fair CSPRNG) ──────────────────────

  /**
   * Cryptographically secure, perfectly uniform random number generator.
   * Uses Web Crypto API (crypto.getRandomValues) with rejection sampling
   * to eliminate modulo bias completely.
   *
   * @param {number} sides - Number of sides on the die (e.g. 4, 6, 8, 10, 12, 20, 100)
   * @returns {number} Integer between 1 and sides (inclusive)
   */
  function rollDie(sides) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      // 32-bit unsigned integer max value: 0xFFFFFFFF (4,294,967,295)
      const maxUint32 = 0xFFFFFFFF;
      // Largest multiple of sides that fits into 32 bits
      const limit = maxUint32 - (maxUint32 % sides);
      const buffer = new Uint32Array(1);
      let rand;

      // Rejection sampling: discard numbers in the remaining modulo tail
      // This guarantees every face has the exact identical mathematical probability
      do {
        window.crypto.getRandomValues(buffer);
        rand = buffer[0];
      } while (rand >= limit);

      return (rand % sides) + 1;
    }

    // Graceful fallback if Web Crypto is unavailable
    return Math.floor(Math.random() * sides) + 1;
  }

  async function rollAllDice() {
    if (isRolling) return;
    isRolling = true;

    $rollBtn.classList.add('rolling');
    $rollBtn.disabled = true;
    $resultsGrid.innerHTML = '';
    $resultsTitle.classList.remove('hidden');
    $vampireSummary.classList.add('hidden');

    // Build flat array of dice to roll
    const diceToRoll = [];
    for (const [type, qty] of dicePool) {
      for (let i = 0; i < qty; i++) {
        diceToRoll.push({ type, sides: DICE_TYPES[type].sides });
      }
    }

    // Create result elements
    const resultEls = diceToRoll.map((die, index) => {
      const el = document.createElement('div');
      el.className = 'result-die rolling-anim';
      el.style.animationDelay = `${index * 60}ms`;
      el.innerHTML = `
        <span class="result-value">?</span>
        <span class="result-type">${die.type}</span>
      `;
      $resultsGrid.appendChild(el);
      return { el, die };
    });

    // Animate numbers cycling
    const cycleIntervals = resultEls.map(({ el, die }) => {
      const valueEl = el.querySelector('.result-value');
      return setInterval(() => {
        valueEl.textContent = rollDie(die.sides);
      }, ROLL_ANIMATION_INTERVAL);
    });

    await delay(ROLL_ANIMATION_DURATION);

    // Final results
    const results = [];
    resultEls.forEach(({ el, die }, i) => {
      clearInterval(cycleIntervals[i]);
      const value = rollDie(die.sides);
      results.push({ type: die.type, sides: die.sides, value });

      const valueEl = el.querySelector('.result-value');
      valueEl.textContent = value;
      el.classList.remove('rolling-anim');

      if (vampireMode) {
        // Vampire mode coloring
        if (value === 10) {
          el.classList.add('is-special-success');
        } else if (value >= difficulty) {
          el.classList.add('is-success');
        } else if (value === 1) {
          el.classList.add('is-botch');
        }
      } else {
        // Normal mode coloring
        if (value === die.sides) {
          el.classList.add('is-max');
        } else if (value === 1) {
          el.classList.add('is-one');
        }
      }
    });

    // Vampire mode: calculate successes
    let vampireResult = null;
    if (vampireMode) {
      vampireResult = calculateVampireResult(results);
      showVampireSummary(vampireResult);
    }

    // Save to history
    saveRoll(results, vampireResult);

    // Reset button
    $rollBtn.classList.remove('rolling');
    $rollBtn.disabled = false;
    isRolling = false;
  }

  // ── Vampire Result Calculation ─────────────────────────────────────────

  function calculateVampireResult(results) {
    let rawSuccesses = 0;
    let ones = 0;
    let tens = 0;

    results.forEach(r => {
      if (r.value === 10) {
        rawSuccesses++;
        tens++;
      } else if (r.value >= difficulty) {
        rawSuccesses++;
      } else if (r.value === 1) {
        ones++;
      }
    });

    // In Storyteller rules:
    // 1s cancel successes 1-for-1
    const netSuccesses = rawSuccesses - ones;

    // Regra Oficial Storyteller (V20 / Clássico):
    // - Sucesso: netSuccesses > 0
    // - Falha Crítica (Botch): NENHUM sucesso obtido (rawSuccesses === 0) E pelo menos um 1 rolado (ones > 0)
    // - Falha Simples: netSuccesses <= 0, mas pelo menos um sucesso foi obtido inicialmente, OU nenhum sucesso e nenhum 1
    let type;
    if (netSuccesses > 0) {
      type = 'success';
    } else if (rawSuccesses === 0 && ones > 0) {
      type = 'critical-failure';
    } else {
      type = 'failure';
    }

    return {
      successes: rawSuccesses,
      ones,
      tens,
      net: Math.max(0, netSuccesses),
      type,
      difficulty,
    };
  }

  function showVampireSummary(result) {
    $vampireSummary.classList.remove('hidden');
    $vampireSumVal.className = 'vampire-summary-value ' + result.type;
    $vampireSumDet.textContent = '';

    if (result.type === 'success') {
      const plural = result.net === 1 ? 'Sucesso' : 'Sucessos';
      $vampireSumVal.textContent = `${result.net} ${plural}`;
      const details = [];
      if (result.tens > 0) details.push(`${result.tens} especial(is)`);
      if (result.ones > 0) details.push(`${result.ones} cancelado(s)`);
      $vampireSumDet.textContent = details.join(' · ');
    } else if (result.type === 'critical-failure') {
      $vampireSumVal.textContent = 'Falha Crítica!';
      $vampireSumDet.textContent = `${result.ones} dado(s) com valor 1`;
      // Screen shake effect
      $appLayout.classList.add('screen-shake');
      setTimeout(() => $appLayout.classList.remove('screen-shake'), 500);
    } else {
      $vampireSumVal.textContent = 'Falha';
      $vampireSumDet.textContent = 'Nenhum sucesso obtido';
    }
  }

  // ── Presets / Favorites ────────────────────────────────────────────────

  function showPresetSaveInput() {
    // Check if inline input already exists
    if (document.querySelector('.preset-save-inline')) return;

    const container = document.createElement('div');
    container.className = 'preset-save-inline';
    container.innerHTML = `
      <input type="text" class="preset-name-input" placeholder="Nome do favorito..." maxlength="30" autofocus>
      <button class="preset-confirm-btn" type="button" title="Salvar">✓</button>
      <button class="preset-cancel-btn" type="button" title="Cancelar">✕</button>
    `;

    // Insert after pool section
    const poolSection = document.getElementById('pool-section');
    poolSection.after(container);

    const input = container.querySelector('.preset-name-input');
    const confirmBtn = container.querySelector('.preset-confirm-btn');
    const cancelBtn = container.querySelector('.preset-cancel-btn');

    input.focus();

    const save = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      savePreset(name);
      container.remove();
    };

    const cancel = () => container.remove();

    confirmBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') cancel();
    });
  }

  function savePreset(name) {
    const poolSnapshot = {};
    for (const [type, qty] of dicePool) {
      poolSnapshot[type] = qty;
    }

    const preset = {
      name,
      pool: poolSnapshot,
      vampireMode,
      difficulty,
    };

    presets.push(preset);
    if (presets.length > MAX_PRESETS) presets.shift();

    persistPresets();
    renderPresets();
  }

  function loadPreset(index) {
    const preset = presets[index];
    if (!preset) return;

    // Set vampire mode if preset was saved in vampire mode
    if (preset.vampireMode !== vampireMode) {
      vampireMode = preset.vampireMode;
      $vampireToggle.checked = vampireMode;
      applyVampireMode();
    }

    if (preset.difficulty && vampireMode) {
      difficulty = preset.difficulty;
      $difficultyValue.textContent = difficulty;
    }

    // Load dice pool
    dicePool.clear();
    for (const [type, qty] of Object.entries(preset.pool)) {
      if (DICE_TYPES[type]) {
        dicePool.set(type, qty);
      }
    }

    renderPool();
    updateRollButton();
  }

  function deletePreset(index) {
    presets.splice(index, 1);
    persistPresets();
    renderPresets();
  }

  function renderPresets() {
    $presetsList.innerHTML = '';

    if (presets.length === 0) {
      $presetsSection.classList.add('hidden');
      return;
    }

    $presetsSection.classList.remove('hidden');

    presets.forEach((preset, i) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.dataset.index = i;

      const diceStr = Object.entries(preset.pool)
        .map(([type, qty]) => `${qty}${type}`)
        .join('+');

      const vampireTag = preset.vampireMode ? ' 🦇' : '';

      chip.innerHTML = `
        <span class="preset-chip-name">${escapeHtml(preset.name)}${vampireTag}</span>
        <span class="preset-chip-dice">${diceStr}</span>
        <button class="preset-chip-delete" data-index="${i}" type="button" title="Excluir">✕</button>
      `;

      $presetsList.appendChild(chip);
    });
  }

  function persistPresets() {
    try {
      localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
    } catch (_) {}
  }

  function loadPresets() {
    try {
      const data = localStorage.getItem(STORAGE_PRESETS);
      if (data) presets = JSON.parse(data);
    } catch (_) {
      presets = [];
    }
  }

  // ── History ────────────────────────────────────────────────────────────

  function saveRoll(results, vampireResult) {
    const poolSnapshot = {};
    for (const [type, qty] of dicePool) {
      poolSnapshot[type] = qty;
    }

    const entry = {
      timestamp: Date.now(),
      pool: poolSnapshot,
      results: results.map(r => ({ type: r.type, value: r.value })),
    };

    if (vampireResult) {
      entry.vampire = {
        type: vampireResult.type,
        net: vampireResult.net,
        difficulty: vampireResult.difficulty,
      };
    }

    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();

    persistHistory();
    renderHistory();
  }

  function renderHistory() {
    $historyList.innerHTML = '';

    if (history.length === 0) {
      $historyClear.classList.add('hidden');
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'Nenhuma rolagem ainda';
      $historyList.appendChild(empty);
      return;
    }

    $historyClear.classList.remove('hidden');

    history.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'history-entry';

      const time = new Date(entry.timestamp);
      const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const diceStr = Object.entries(entry.pool)
        .map(([type, qty]) => `${qty}${type}`)
        .join(' + ');

      const resultsStr = entry.results.map(r => r.value).join(', ');

      let vampireHtml = '';
      if (entry.vampire) {
        const v = entry.vampire;
        let label, cssClass;
        if (v.type === 'success') {
          label = `${v.net} sucesso(s)`;
          cssClass = 'success';
        } else if (v.type === 'critical-failure') {
          label = 'Falha Crítica!';
          cssClass = 'critical-failure';
        } else {
          label = 'Falha';
          cssClass = 'failure';
        }
        vampireHtml = `<span class="entry-vampire-result ${cssClass}">${label}</span>`;
      }

      el.innerHTML = `
        <div class="entry-header">
          <span class="entry-dice">${diceStr}</span>
          <span class="entry-time">${timeStr}</span>
        </div>
        <span class="entry-results">${resultsStr}</span>
        ${vampireHtml}
      `;

      $historyList.appendChild(el);
    });
  }

  function clearHistory() {
    history = [];
    persistHistory();
    renderHistory();
  }

  function persistHistory() {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    } catch (_) {}
  }

  function loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_HISTORY);
      if (data) history = JSON.parse(data);
    } catch (_) {
      history = [];
    }
  }

  // ── Mobile History Panel ───────────────────────────────────────────────

  function toggleMobileHistory() {
    $historyPanel.classList.toggle('open');
    $mobileToggle.classList.toggle('active');
  }

  function closeMobileHistory() {
    $historyPanel.classList.remove('open');
    $mobileToggle.classList.remove('active');
  }

  // ── UI Helpers ─────────────────────────────────────────────────────────

  function createRipple(button, event) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Start ──────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
