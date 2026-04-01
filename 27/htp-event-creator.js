/**
 * htp-event-creator.js — Event Creation Form
 * maxMaximizerPct + expectedVolume inputs with live cap preview
 * Depends on: htp-fee-engine.js (HTPFee)
 * No Firebase required.
 */
(function(W) {
  'use strict';

  function injectStyles() {
    if (document.getElementById('htp-creator-style')) return;
    const s = document.createElement('style');
    s.id = 'htp-creator-style';
    s.textContent = `
      .htp-creator-form {
        background: #0f172a;
        border: 1px solid rgba(73,232,194,0.2);
        border-radius: 16px;
        padding: 28px;
        font-family: 'Inter', sans-serif;
        color: #e2e8f0;
        max-width: 560px;
      }
      .htp-creator-form h2 {
        font-size: 18px; font-weight: 800; color: #fff;
        margin: 0 0 6px; letter-spacing: -0.02em;
      }
      .htp-creator-form .subtitle {
        font-size: 12px; color: #64748b; margin-bottom: 24px;
      }
      .htp-field { margin-bottom: 18px; }
      .htp-field label {
        display: block; font-size: 11px; font-weight: 700;
        color: #94a3b8; text-transform: uppercase;
        letter-spacing: 0.07em; margin-bottom: 6px;
      }
      .htp-field input, .htp-field textarea, .htp-field select {
        width: 100%; box-sizing: border-box;
        background: #1e293b; border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; padding: 10px 14px;
        color: #fff; font-size: 14px; outline: none;
        transition: border-color 0.2s; font-family: inherit;
      }
      .htp-field input:focus, .htp-field textarea:focus { border-color: #49e8c2; }
      .htp-field textarea { resize: vertical; min-height: 72px; }
      .htp-field .hint { font-size: 11px; color: #475569; margin-top: 4px; }
      .htp-field .hint.green { color: #49e8c2; }
      .htp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .htp-slider-row { display: flex; align-items: center; gap: 12px; }
      .htp-slider { flex: 1; accent-color: #49e8c2; }
      .htp-slider-val {
        min-width: 48px; text-align: right;
        font-weight: 700; color: #49e8c2; font-size: 15px;
      }
      .htp-mx-preview-box {
        background: #1e293b; border-radius: 10px;
        padding: 14px 16px; margin: 18px 0;
        border-left: 3px solid #49e8c2;
      }
      .htp-mx-preview-box .title {
        font-size: 11px; color: #64748b;
        text-transform: uppercase; letter-spacing: 0.07em;
        margin-bottom: 10px;
      }
      .htp-mx-preview-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      }
      .htp-mx-prev-cell { text-align: center; }
      .htp-mx-prev-cell .v { font-size: 17px; font-weight: 700; color: #fff; }
      .htp-mx-prev-cell .l { font-size: 10px; color: #64748b; margin-top: 2px; }
      .htp-mx-prev-cell .v.teal   { color: #49e8c2; }
      .htp-mx-prev-cell .v.yellow { color: #f59e0b; }
      .htp-parasitic-warn {
        background: rgba(245,158,11,0.08);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 8px; padding: 10px 14px;
        font-size: 12px; color: #f59e0b;
        margin-bottom: 18px; line-height: 1.6;
      }
      .htp-outcomes-list { display: flex; flex-direction: column; gap: 8px; }
      .htp-outcome-row { display: flex; gap: 8px; align-items: center; }
      .htp-outcome-row input { flex: 1; }
      .htp-outcome-row button {
        background: #1e293b; border: 1px solid rgba(255,255,255,0.08);
        color: #94a3b8; border-radius: 6px; padding: 8px 10px;
        cursor: pointer; font-size: 13px;
      }
      .htp-add-outcome {
        background: none; border: 1px dashed rgba(73,232,194,0.3);
        color: #49e8c2; border-radius: 8px; padding: 8px;
        cursor: pointer; font-size: 12px; width: 100%; margin-top: 6px;
        transition: background 0.2s;
      }
      .htp-add-outcome:hover { background: rgba(73,232,194,0.05); }
      .htp-submit-btn {
        width: 100%; padding: 14px;
        background: linear-gradient(135deg, #49e8c2, #3b82f6);
        color: #0f172a; font-weight: 800; font-size: 15px;
        border: none; border-radius: 10px; cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        letter-spacing: 0.02em; margin-top: 8px;
      }
      .htp-submit-btn:hover   { opacity: 0.9; }
      .htp-submit-btn:active  { transform: scale(0.98); }
      .htp-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .htp-creator-section-label {
        font-size: 10px; font-weight: 700;
        color: #334155; text-transform: uppercase;
        letter-spacing: 0.1em; margin: 22px 0 12px;
        padding-bottom: 6px; border-bottom: 1px solid #1e293b;
      }
    `;
    document.head.appendChild(s);
  }

  function render(containerId, onSubmit) {
    injectStyles();
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="htp-creator-form">
        <h2>Create Prediction Market</h2>
        <div class="subtitle">Your event, your rules. Non-custodial from creation to settlement.</div>

        <div class="htp-creator-section-label">Event Details</div>

        <div class="htp-field">
          <label>Event Title</label>
          <input type="text" id="htp-ev-title" placeholder="e.g. Will BTC exceed $100k by June 2026?" />
        </div>
        <div class="htp-field">
          <label>Description</label>
          <textarea id="htp-ev-desc" placeholder="Describe the resolution criteria clearly..."></textarea>
        </div>
        <div class="htp-two-col">
          <div class="htp-field">
            <label>Category</label>
            <select id="htp-ev-category">
              <option>Crypto</option>
              <option>Sports</option>
              <option>Politics</option>
              <option>Gaming</option>
              <option>Other</option>
            </select>
          </div>
          <div class="htp-field">
            <label>Resolution Date</label>
            <input type="date" id="htp-ev-date" />
          </div>
        </div>

        <div class="htp-creator-section-label">Outcomes</div>
        <div class="htp-field">
          <div class="htp-outcomes-list" id="htp-outcomes-list">
            <div class="htp-outcome-row">
              <input type="text" placeholder="Outcome A (e.g. Yes)" value="Yes" />
              <button onclick="this.parentElement.remove()">✕</button>
            </div>
            <div class="htp-outcome-row">
              <input type="text" placeholder="Outcome B (e.g. No)" value="No" />
              <button onclick="this.parentElement.remove()">✕</button>
            </div>
          </div>
          <button class="htp-add-outcome" id="htp-add-outcome">+ Add Outcome</button>
        </div>

        <div class="htp-creator-section-label">Maximizer Settings</div>

        <div class="htp-parasitic-warn">
          ⚠ Maximizers contribute only 50% to the pool — they lower odds for standard bettors.
          Set a cap to protect your market's price integrity.
        </div>

        <div class="htp-field">
          <label>Expected Pool Volume (KAS)</label>
          <input type="number" id="htp-ev-volume" min="1000" step="1000" value="100000" />
          <div class="hint">Used to calculate the maximizer cap. Scales dynamically with actual volume.</div>
        </div>

        <div class="htp-field">
          <label>Max Maximizer % of Volume</label>
          <div class="htp-slider-row">
            <input type="range" class="htp-slider" id="htp-mx-pct-slider" min="0" max="50" step="1" value="10" />
            <span class="htp-slider-val" id="htp-mx-pct-val">10%</span>
          </div>
          <div class="hint">0% = no maximizers allowed. Recommended: 5-15%.</div>
        </div>

        <div class="htp-mx-preview-box" id="htp-mx-prev-box">
          <div class="title">Maximizer Cap Preview</div>
          <div class="htp-mx-preview-grid">
            <div class="htp-mx-prev-cell">
              <div class="v teal" id="htp-prev-cap">10,000</div>
              <div class="l">Max KAS at launch</div>
            </div>
            <div class="htp-mx-prev-cell">
              <div class="v" id="htp-prev-2x">20,000</div>
              <div class="l">Cap at 2× volume</div>
            </div>
            <div class="htp-mx-prev-cell">
              <div class="v yellow" id="htp-prev-pct">10%</div>
              <div class="l">of reference volume</div>
            </div>
          </div>
        </div>

        <div class="htp-creator-section-label">Oracle & Fees</div>
        <div class="htp-field">
          <label>Oracle Type</label>
          <select id="htp-ev-oracle">
            <option value="htp">HTP Bonded Oracle (default)</option>
            <option value="manual">Manual resolution by creator</option>
          </select>
          <div class="hint">HTP oracle uses external feeds + challenge window. Manual requires your signature to resolve.</div>
        </div>
        <div class="htp-field">
          <label>Protocol Fee on Winnings</label>
          <input type="text" value="2% on net winnings (fixed)" disabled style="opacity:0.5;cursor:not-allowed" />
          <div class="hint green">Fee goes to: ${W.HTPFee ? W.HTPFee.treasuryAddress().substring(0,26)+'…' : 'treasury'}</div>
        </div>

        <button class="htp-submit-btn" id="htp-ev-submit">Create Event</button>
      </div>
    `;

    // Live cap preview
    const volInput  = document.getElementById('htp-ev-volume');
    const slider    = document.getElementById('htp-mx-pct-slider');
    const pctVal    = document.getElementById('htp-mx-pct-val');
    const prevCap   = document.getElementById('htp-prev-cap');
    const prev2x    = document.getElementById('htp-prev-2x');
    const prevPct   = document.getElementById('htp-prev-pct');

    function updatePreview() {
      const vol = parseFloat(volInput.value) || 100000;
      const pct = parseInt(slider.value) / 100;
      const cap = vol * pct;
      pctVal.textContent  = (pct * 100).toFixed(0) + '%';
      prevCap.textContent = cap.toLocaleString(undefined, {maximumFractionDigits:0});
      prev2x.textContent  = (vol * 2 * pct).toLocaleString(undefined, {maximumFractionDigits:0});
      prevPct.textContent = (pct * 100).toFixed(0) + '%';
    }

    slider.addEventListener('input', updatePreview);
    volInput.addEventListener('input', updatePreview);
    updatePreview();

    // Add outcome
    document.getElementById('htp-add-outcome').addEventListener('click', function() {
      const list = document.getElementById('htp-outcomes-list');
      const row = document.createElement('div');
      row.className = 'htp-outcome-row';
      row.innerHTML = `<input type="text" placeholder="New outcome" /><button onclick="this.parentElement.remove()">✕</button>`;
      list.appendChild(row);
    });

    // Submit
    document.getElementById('htp-ev-submit').addEventListener('click', function() {
      const title = document.getElementById('htp-ev-title').value.trim();
      if (!title) { alert('Please enter an event title.'); return; }

      const outcomes = Array.from(document.querySelectorAll('#htp-outcomes-list input'))
        .map(i => i.value.trim()).filter(Boolean);
      if (outcomes.length < 2) { alert('Please enter at least 2 outcomes.'); return; }

      const payload = {
        title,
        description:     document.getElementById('htp-ev-desc').value.trim(),
        category:        document.getElementById('htp-ev-category').value,
        resolutionDate:  document.getElementById('htp-ev-date').value,
        outcomes,
        maxMaximizerPct: parseInt(slider.value) / 100,
        expectedVolume:  parseFloat(volInput.value) || 100000,
        oracleType:      document.getElementById('htp-ev-oracle').value,
        creatorAddress:  W.walletAddress || W.htpAddress || null,
        protocolFeePct:  0.02,
        treasuryAddress: W.HTPFee ? W.HTPFee.treasuryAddress() : null,
        createdAt:       Date.now(),
      };

      window.dispatchEvent(new CustomEvent('htp:event:create', { detail: payload }));
      if (typeof onSubmit === 'function') onSubmit(payload);
    });
  }

  W.HTPEventCreator = { render };
  console.log('[HTPEventCreator] loaded');
})(window);
