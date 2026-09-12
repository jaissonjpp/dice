/**
 * Rolador de Dados — Gothic Theme
 * Core application logic: dice pool management, rolling, animations, and history.
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
  const ROLL_ANIMATION_DURATION = 600; // ms
  const ROLL_ANIMATION_INTERVAL = 50;  // ms between number changes
  const STORAGE_KEY = 'dice-roller-history';

  // ── State ──────────────────────────────────────────────────────────────

  /** @type {Map<string, number>} die type → quantity */
  const dicePool = new Map();

  /** @type {Array<{timestamp: number, pool: Object, results: Array}>} */
  let history = [];

  let isRolling = false;

  // ── DOM References ─────────────────────────────────────────────────────

  const $diceGrid       = document.getElementById('dice-grid');
  const $dicePool       = document.getElementById('dice-pool');
  const $poolEmpty      = document.getElementById('pool-empty');
  const $rollBtn        = document.getElementById('roll-btn');
  const $resultsGrid    = document.getElementById('results-grid');
  const $resultsTitle   = document.getElementById('results-title');
  const $historyClear   = document.getElementById('history-clear');
  const $historyList    = document.getElementById('history-list');
  const $historyEmpty   = document.getElementById('history-empty');
  const $historyPanel   = document.getElementById('history-panel');
  const $mobileToggle   = document.getElementById('history-mobile-toggle');

  // ── Initialization ─────────────────────────────────────────────────────

  function init() {
    loadHistory();
    renderHistory();
    bindEvents();
  }

  // ── Event Binding ──────────────────────────────────────────────────────

  function bindEvents() {
    // Dice selector buttons
    $diceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.dice-btn');
      if (!btn || isRolling) return;

      const die = btn.dataset.die;
      addDie(die);
      createRipple(btn, e);
    });

    // Roll button
    $rollBtn.addEventListener('click', () => {
      if (isRolling || dicePool.size === 0) return;
      rollAllDice();
    });

    // History clear
    $historyClear.addEventListener('click', clearHistory);

    // Mobile history toggle
    $mobileToggle.addEventListener('click', toggleMobileHistory);

    // Pool delegation (quantity buttons + remove)
    $dicePool.addEventListener('click', (e) => {
      if (isRolling) return;

      const target = e.target.closest('[data-action]');
      if (!target) return;

      const die = target.dataset.die;
      const action = target.dataset.action;

      if (action === 'increment') {
        incrementDie(die);
      } else if (action === 'decrement') {
        decrementDie(die);
      } else if (action === 'remove') {
        removeDie(die);
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

  // ── Dice Pool Management ───────────────────────────────────────────────

  function addDie(type) {
    if (!DICE_TYPES[type]) return;

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
    if (current <= 1) {
      removeDie(type);
      return;
    }
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
      $dicePool.querySelectorAll('.pool-item').forEach(el => el.remove());
      updateRollButton();
      return;
    }

    $poolEmpty.classList.add('hidden');

    // Build desired order (same as DICE_TYPES keys)
    const orderedTypes = Object.keys(DICE_TYPES).filter(t => dicePool.has(t));

    // Remove items not in pool anymore
    $dicePool.querySelectorAll('.pool-item').forEach(el => {
      if (!dicePool.has(el.dataset.die)) el.remove();
    });

    orderedTypes.forEach(type => {
      const qty = dicePool.get(type);
      const info = DICE_TYPES[type];
      let el = $dicePool.querySelector(`.pool-item[data-die="${type}"]`);

      if (el) {
        // Update quantity only
        el.querySelector('.qty-value').textContent = qty;
      } else {
        // Create new item
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

      // Update name text
      el.querySelector('.pool-item-name').textContent = `${qty}× ${info.label}`;
    });
  }

  function updateRollButton() {
    $rollBtn.disabled = dicePool.size === 0;
  }

  // ── Rolling Logic ──────────────────────────────────────────────────────

  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  async function rollAllDice() {
    if (isRolling) return;
    isRolling = true;

    $rollBtn.classList.add('rolling');
    $rollBtn.disabled = true;
    $resultsGrid.innerHTML = '';
    $resultsTitle.classList.remove('hidden');

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

    // Wait for animation
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

      // Highlight max and 1
      if (value === die.sides) {
        el.classList.add('is-max');
      } else if (value === 1) {
        el.classList.add('is-one');
      }
    });

    // Save to history
    saveRoll(results);

    // Reset button
    $rollBtn.classList.remove('rolling');
    $rollBtn.disabled = false;
    isRolling = false;
  }

  // ── History ────────────────────────────────────────────────────────────

  function saveRoll(results) {
    const poolSnapshot = {};
    for (const [type, qty] of dicePool) {
      poolSnapshot[type] = qty;
    }

    const entry = {
      timestamp: Date.now(),
      pool: poolSnapshot,
      results: results.map(r => ({ type: r.type, value: r.value })),
    };

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

      el.innerHTML = `
        <div class="entry-header">
          <span class="entry-dice">${diceStr}</span>
          <span class="entry-time">${timeStr}</span>
        </div>
        <span class="entry-results">${resultsStr}</span>
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_) {
      // Storage full or unavailable — fail silently
    }
  }

  function loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        history = JSON.parse(data);
      }
    } catch (_) {
      history = [];
    }
  }

  // ── Mobile History Panel ───────────────────────────────────────────────

  function toggleMobileHistory() {
    if ($historyPanel.classList.contains('open')) {
      closeMobileHistory();
    } else {
      openMobileHistory();
    }
  }

  function openMobileHistory() {
    $historyPanel.classList.add('open');
    $mobileToggle.classList.add('active');
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

  // ── Start ──────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
