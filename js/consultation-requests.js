/* ==========================================================================
   consultation-requests.js
   Fetches consultation data from the Apps Script web app, marks dates that
   have submitted requests with a blue dot on the calendar (Flatpickr), and
   lets the user browse requests for any selected date.
   ========================================================================== */

// -----------------------------------------------------------------------
// Paste the Web App URL from your Apps Script deployment here.
// Example: https://script.google.com/macros/s/AKfycb.../exec
// -----------------------------------------------------------------------
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxK6fQRMeeyx1OUF7ht2uJFfaYoecEAYeTOUbXbEggqBZ7-Nr_DERUZBCffd-26LIwAyQ/exec';

(function () {
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const resultsTitleEl = document.getElementById('resultsTitle');
  const countBadgeEl = document.getElementById('countBadge');
  const datePickerInput = document.getElementById('datePicker');

  let allRows = [];
  let groupedByDate = {};   // { 'yyyy-mm-dd': [row, row, ...] }
  let datesWithData = [];   // ['yyyy-mm-dd', ...]
  let flatpickrInstance = null;

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function groupByDate(rows) {
    const groups = {};
    rows.forEach(row => {
      const key = row.dateKey || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }

  /**
   * Derives the sorted list of distinct dates that have at least one
   * submitted request, from the already-fetched dataset. This is the
   * function that feeds the calendar's blue-dot indicators.
   */
  function fetchSubmittedDates(rows) {
    const unique = new Set(
      rows.map(r => r.dateKey).filter(d => d && d !== 'unknown')
    );
    return Array.from(unique).sort();
  }

  function renderResultsForDate(dateStr) {
    const rows = groupedByDate[dateStr] || [];
    resultsEl.innerHTML = '';
    resultsTitleEl.textContent = dateStr ? `Requests for ${formatDisplayDate(dateStr)}` : 'Requests';
    countBadgeEl.textContent = rows.length;

    if (rows.length === 0) {
      resultsEl.innerHTML = `<div class="cr-empty">No consultation requests found for ${formatDisplayDate(dateStr)}.</div>`;
      return;
    }

    rows.forEach(row => {
      const entry = document.createElement('div');
      entry.className = 'cr-entry';
      entry.innerHTML = `
        <h6>${escapeHtml(row.name || 'Unnamed')}</h6>
        <div class="cr-row"><span class="cr-label">Place:</span><span>${escapeHtml(row.placeAndDistrict || '-')}</span></div>
        <div class="cr-row"><span class="cr-label">Phone:</span><span>${escapeHtml(row.phoneNumber || '-')}</span></div>
        <div class="cr-row"><span class="cr-label">Message:</span><span>${escapeHtml(row.message || '-')}</span></div>
        <div class="cr-row"><span class="cr-label">Submitted:</span><span>${escapeHtml(row.timestamp || '-')}</span></div>
      `;
      resultsEl.appendChild(entry);
    });
  }

  function initCalendar(selectedDate) {
    if (typeof flatpickr === 'undefined') {
      statusEl.textContent = 'Calendar library failed to load.';
      return;
    }

    if (flatpickrInstance) {
      flatpickrInstance.destroy();
    }

    flatpickrInstance = flatpickr(datePickerInput, {
      dateFormat: 'Y-m-d',
      defaultDate: selectedDate,
      disableMobile: true,
      onDayCreate: function (dObj, dStr, fp, dayElem) {
        const iso = fp.formatDate(dayElem.dateObj, 'Y-m-d');
        if (datesWithData.includes(iso)) {
          dayElem.classList.add('cr-has-data');
        }
      },
      onChange: function (selectedDates, dateStr) {
        if (dateStr) renderResultsForDate(dateStr);
      }
    });
  }

  async function loadData() {
    statusEl.textContent = 'Loading data…';
    resultsEl.innerHTML = '<div class="cr-empty">Loading…</div>';

    try {
      const res = await fetch(WEB_APP_URL);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error from web app');

      allRows = json.data || [];
      groupedByDate = groupByDate(allRows);
      datesWithData = fetchSubmittedDates(allRows);

      statusEl.textContent = `${allRows.length} total request${allRows.length === 1 ? '' : 's'} across ${datesWithData.length} date${datesWithData.length === 1 ? '' : 's'}.`;

      const currentSelection = (datePickerInput.value || todayIso());
      initCalendar(currentSelection);
      renderResultsForDate(currentSelection);
    } catch (err) {
      statusEl.textContent = '';
      resultsEl.innerHTML = `<div class="cr-empty">Couldn't load data: ${escapeHtml(err.message)}.<br>
        Make sure WEB_APP_URL in js/consultation-requests.js points to your deployed Apps Script web app.</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('todayBtn').addEventListener('click', function () {
      const today = todayIso();
      if (flatpickrInstance) flatpickrInstance.setDate(today, true);
      renderResultsForDate(today);
    });

    document.getElementById('refreshBtn').addEventListener('click', loadData);

    loadData();
  });
})();
