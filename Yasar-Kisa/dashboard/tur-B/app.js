/* =========================================================================
   VALEO Üretim Dashboard — Uygulama Mantığı
   Veri katmanı: veri.csv (bu dosyaya gömülü değil, çalışma zamanında okunur)
   ========================================================================= */
(function () {
  "use strict";

  /* ----------------------------------------------------------------------
     YAPILANDIRMA
     CANLI Google E-Tablosu bağlantısı için:
     1) Google E-Tablosu'nda Dosya > Paylaş > Web'de yayınla > CSV seçin.
     2) Oluşan bağlantıyı (".../pub?output=csv") DATA_SOURCE_URL'e yazın.
     Yayınlanmadığı sürece tarayıcı güvenliği nedeniyle özel bir Drive
     dosyasına doğrudan istemci tarafından erişilemez; bu yüzden varsayılan
     kaynak, aynı klasördeki ayrık veri dosyası "veri.csv"dir.
  ---------------------------------------------------------------------- */
  const CONFIG = {
    DATA_SOURCE_URL: "./veri.csv",
    HEDEF: { oee: 85, avail: 90, perf: 95, qual: 99 },
    DIKKAT_MARJ: 10,
    DEFAULT_PERIOD_DAYS: 30,
    PAGE_SIZE: 12,
  };

  const TR_DURUS_NEDENI_ORDER = null; // sıralama veriden türetilir, sabit liste yok

  /* ----------------------------------------------------------------------
     DURUM (state)
  ---------------------------------------------------------------------- */
  const state = {
    allRows: [],
    minDate: null,
    maxDate: null,
    loadError: null,
    lastSync: null,
    filters: { hat: "all", vardiya: "all", start: null, end: null },
    filteredCurrent: [],
    filteredPrevious: [],
    previousRange: null,
    e2Metric: "oee",
    e3Dim: "hat",
    e4Sort: { key: "oee", dir: "asc" },
    e4Page: 1,
  };

  /* ----------------------------------------------------------------------
     BİÇİMLENDİRME YARDIMCILARI (Türkçe, kalıcı talimat kuralı 1 & 2 & 7)
  ---------------------------------------------------------------------- */
  const trInt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const trDec1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function fmtInt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return trInt.format(Math.round(n));
  }
  function fmtPct(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return "%" + trDec1.format(n);
  }
  function fmtDk(n) {
    return fmtInt(n) + " dk";
  }
  function pad2(n) { return String(n).padStart(2, "0"); }

  function parseDateTR(str) {
    const parts = str.trim().split(".");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
    if (!dd || !mm || !yyyy) return null;
    return new Date(yyyy, mm - 1, dd);
  }
  function formatDateTR(date) {
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
  }
  function isoFromDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
  function dateFromIso(iso) {
    const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function daysBetweenInclusive(a, b) {
    return Math.round((b - a) / 86400000) + 1;
  }
  function sameOrBefore(a, b) { return a.getTime() <= b.getTime(); }

  /* ----------------------------------------------------------------------
     CSV AYRIŞTIRMA (bağlı kaynaktan okunan ham veri; hiçbir şekilde
     bu dosyada veri sabitlenmez — kalıcı talimat kural 3)
  ---------------------------------------------------------------------- */
  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length !== headers.length) continue;
      const raw = {};
      headers.forEach((h, idx) => { raw[h] = cols[idx]; });
      const row = buildRow(raw);
      if (row) rows.push(row);
    }
    rows.sort((a, b) => a.tarihDate - b.tarihDate || a.hat.localeCompare(b.hat));
    return rows;
  }

  function splitCsvLine(line) {
    // Basit virgülle ayırma; alanlarda tırnaklı virgül olması durumuna karşı korumalı.
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  function buildRow(raw) {
    const tarihDate = parseDateTR(raw["Tarih"]);
    if (!tarihDate) return null;
    const planli = parseFloat(raw["Planli_Sure_dk"]);
    const durus = parseFloat(raw["Durus_Suresi_dk"]);
    const uretim = parseFloat(raw["Uretim_Adedi"]);
    const hatali = parseFloat(raw["Hatali_Adet"]);
    const cevrim = parseFloat(raw["Cevrim_Suresi_dk"]);
    if ([planli, durus, uretim, hatali, cevrim].some((v) => Number.isNaN(v))) return null;

    const calisma = planli - durus;
    const avail = calisma > 0 ? calisma / planli : 0;
    const perf = calisma > 0 ? (uretim * cevrim) / calisma : 0;
    const qual = uretim > 0 ? (uretim - hatali) / uretim : 0;
    const oee = avail * perf * qual;

    return {
      tarih: raw["Tarih"],
      tarihDate,
      hat: raw["Hat"],
      vardiya: raw["Vardiya"],
      planli, durus,
      durusNedeni: raw["Durus_Nedeni"],
      uretim, hatali, cevrim,
      calisma,
      avail: avail * 100,
      perf: perf * 100,
      qual: qual * 100,
      oee: oee * 100,
    };
  }

  function statusFromValue(val, hedef) {
    if (val === null || val === undefined || Number.isNaN(val)) return "bilinmiyor";
    if (val >= hedef) return "iyi";
    if (val >= hedef - CONFIG.DIKKAT_MARJ) return "dikkat";
    return "kotu";
  }
  function statusFromOee(oee) {
    return statusFromValue(oee, CONFIG.HEDEF.oee);
  }
  function statusLabel(s) {
    return { iyi: "İyi", dikkat: "Dikkat", kotu: "Kritik", bilinmiyor: "—" }[s] || "—";
  }
  function statusIcon(s) {
    return { iyi: "✓", dikkat: "!", kotu: "✕", bilinmiyor: "" }[s] || "";
  }
  function statusPillHtml(s) {
    return `<span class="status-pill ${s}"><span class="status-pill__icon" aria-hidden="true">${statusIcon(s)}</span>${statusLabel(s)}</span>`;
  }

  /* ----------------------------------------------------------------------
     AĞIRLIKLI TOPLULAŞTIRMA
     Tek tek satırların OEE yüzdelerinin ortalaması alınmaz; bunun yerine
     bileşenler (çalışma süresi, üretim, hata) toplanıp oran üzerinden
     hesaplanır — bu, gerçek OEE metodolojisiyle örtüşür.
  ---------------------------------------------------------------------- */
  function aggregate(rows) {
    if (!rows.length) {
      return { avail: null, perf: null, qual: null, oee: null, uretim: 0, hatali: 0, durus: 0, planli: 0, count: 0 };
    }
    let planli = 0, durus = 0, calisma = 0, uretim = 0, hatali = 0, idealSure = 0;
    rows.forEach((r) => {
      planli += r.planli;
      durus += r.durus;
      calisma += r.calisma;
      uretim += r.uretim;
      hatali += r.hatali;
      idealSure += r.uretim * r.cevrim;
    });
    const avail = planli > 0 ? (calisma / planli) * 100 : null;
    const perf = calisma > 0 ? (idealSure / calisma) * 100 : null;
    const qual = uretim > 0 ? ((uretim - hatali) / uretim) * 100 : null;
    const oee = avail !== null && perf !== null && qual !== null ? (avail / 100) * (perf / 100) * (qual / 100) * 100 : null;
    return { avail, perf, qual, oee, uretim, hatali, durus, planli, count: rows.length };
  }

  function groupBy(rows, key) {
    const map = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return Array.from(map.entries())
      .map(([label, rs]) => ({ label, rows: rs, agg: aggregate(rs) }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }

  function buildDailySeries(rows, rangeStart, rangeEnd) {
    const days = daysBetweenInclusive(rangeStart, rangeEnd);
    const series = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(rangeStart, i);
      const dayRows = rows.filter((r) => r.tarihDate.getTime() === d.getTime());
      series.push({ dayIndex: i + 1, date: d, agg: aggregate(dayRows) });
    }
    return series;
  }

  /* ----------------------------------------------------------------------
     EKRAN DURUMU (loading / error / empty / content)
  ---------------------------------------------------------------------- */
  function setScreenState(prefix, mode) {
    ["loading", "error", "empty", "content"].forEach((m) => {
      const el = document.getElementById(`${prefix}-${m}`);
      if (el) el.hidden = m !== mode;
    });
  }

  function setSyncStatus(mode, text) {
    const box = document.getElementById("syncStatus");
    const txt = document.getElementById("syncStatusText");
    box.classList.remove("is-loading", "is-error");
    if (mode === "loading" || mode === "error") box.classList.add(`is-${mode}`);
    txt.textContent = text;
  }
  function formatTimeTR(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  /* ----------------------------------------------------------------------
     VERİ YÜKLEME (bağlı kaynaktan — kalıcı talimat kural 3)
  ---------------------------------------------------------------------- */
  function loadData() {
    ["e1", "e2", "e3", "e4"].forEach((p) => setScreenState(p, "loading"));
    setSyncStatus("loading", "Veri kaynağına bağlanıyor…");
    fetch(CONFIG.DATA_SOURCE_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((text) => {
        const rows = parseCSV(text);
        if (!rows.length) throw new Error("Ayrıştırılan veri kümesi boş");
        state.allRows = rows;
        state.loadError = null;
        state.minDate = rows.reduce((m, r) => (r.tarihDate < m ? r.tarihDate : m), rows[0].tarihDate);
        state.maxDate = rows.reduce((m, r) => (r.tarihDate > m ? r.tarihDate : m), rows[0].tarihDate);
        state.lastSync = new Date();
        populateFilterOptions();
        computeFilteredSets();
        renderAll();
        setSyncStatus("ok", "Bağlı — son güncelleme " + formatTimeTR(state.lastSync));
      })
      .catch(() => {
        state.loadError = true;
        setSyncStatus("error", "Bağlantı hatası — veri kaynağına erişilemedi");
        ["e1", "e2", "e3", "e4"].forEach((p) => setScreenState(p, "error"));
      });
  }

  function populateFilterOptions() {
    const hats = Array.from(new Set(state.allRows.map((r) => r.hat))).sort((a, b) => a.localeCompare(b, "tr"));
    const vardiyalar = Array.from(new Set(state.allRows.map((r) => r.vardiya))).sort((a, b) => a.localeCompare(b, "tr"));
    const fHat = document.getElementById("fHat");
    const fVardiya = document.getElementById("fVardiya");
    hats.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h; opt.textContent = h;
      fHat.appendChild(opt);
    });
    vardiyalar.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      fVardiya.appendChild(opt);
    });

    const end = state.maxDate;
    const start = sameOrBefore(state.minDate, addDays(end, -(CONFIG.DEFAULT_PERIOD_DAYS - 1)))
      ? addDays(end, -(CONFIG.DEFAULT_PERIOD_DAYS - 1))
      : state.minDate;
    state.filters.start = start;
    state.filters.end = end;

    const fStart = document.getElementById("fBaslangic");
    const fEnd = document.getElementById("fBitis");
    fStart.value = isoFromDate(start);
    fEnd.value = isoFromDate(end);
    fStart.min = fEnd.min = isoFromDate(state.minDate);
    fStart.max = fEnd.max = isoFromDate(state.maxDate);
  }

  /* ----------------------------------------------------------------------
     FİLTRELEME
  ---------------------------------------------------------------------- */
  function computePreviousRange(start, end) {
    const len = daysBetweenInclusive(start, end);
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(len - 1));
    return { start: prevStart, end: prevEnd };
  }

  function computeFilteredSets() {
    const { hat, vardiya, start, end } = state.filters;
    const prevRange = computePreviousRange(start, end);
    state.previousRange = prevRange;

    function matches(r, s, e) {
      if (hat !== "all" && r.hat !== hat) return false;
      if (vardiya !== "all" && r.vardiya !== vardiya) return false;
      if (r.tarihDate < s || r.tarihDate > e) return false;
      return true;
    }

    state.filteredCurrent = state.allRows.filter((r) => matches(r, start, end));
    state.filteredPrevious = state.allRows.filter((r) => matches(r, prevRange.start, prevRange.end));
  }

  function onFiltersChanged() {
    if (!state.allRows.length) return;
    computeFilteredSets();
    state.e4Page = 1;
    renderAll();
  }

  function resetFilters() {
    state.filters.hat = "all";
    state.filters.vardiya = "all";
    document.getElementById("fHat").value = "all";
    document.getElementById("fVardiya").value = "all";
    const end = state.maxDate;
    const start = sameOrBefore(state.minDate, addDays(end, -(CONFIG.DEFAULT_PERIOD_DAYS - 1)))
      ? addDays(end, -(CONFIG.DEFAULT_PERIOD_DAYS - 1))
      : state.minDate;
    state.filters.start = start;
    state.filters.end = end;
    document.getElementById("fBaslangic").value = isoFromDate(start);
    document.getElementById("fBitis").value = isoFromDate(end);
    onFiltersChanged();
  }

  function updateFilterSummary() {
    const { hat, vardiya, start, end } = state.filters;
    const hatTxt = hat === "all" ? "Tüm hatlar" : hat;
    const vardiyaTxt = vardiya === "all" ? "tüm vardiyalar" : vardiya;
    const days = daysBetweenInclusive(start, end);
    document.getElementById("filterSummary").innerHTML =
      `<strong>${fmtInt(state.filteredCurrent.length)}</strong> kayıt · ${hatTxt}, ${vardiyaTxt} · ` +
      `${formatDateTR(start)}–${formatDateTR(end)} (${days} gün) · önceki dönem: ` +
      `${formatDateTR(state.previousRange.start)}–${formatDateTR(state.previousRange.end)}`;
  }

  /* ----------------------------------------------------------------------
     GENEL RENDER GİRİŞİ
  ---------------------------------------------------------------------- */
  function renderAll() {
    if (state.loadError) return;
    if (!state.filteredCurrent.length) {
      ["e1", "e2", "e3", "e4"].forEach((p) => setScreenState(p, "empty"));
      updateFilterSummary();
      return;
    }
    renderE1();
    renderE2();
    renderE3();
    renderE4();
    updateFilterSummary();
  }

  /* ----------------------------------------------------------------------
     E1 — ÖZET / KPI
  ---------------------------------------------------------------------- */
  const E1_METRICS = [
    { key: "oee", label: "OEE", hedef: CONFIG.HEDEF.oee, kind: "gauge", higherIsBetter: true },
    { key: "avail", label: "Kullanılabilirlik", hedef: CONFIG.HEDEF.avail, kind: "pct", higherIsBetter: true },
    { key: "perf", label: "Performans", hedef: CONFIG.HEDEF.perf, kind: "pct", higherIsBetter: true },
    { key: "qual", label: "Kalite", hedef: CONFIG.HEDEF.qual, kind: "pct", higherIsBetter: true },
    { key: "uretim", label: "Toplam Üretim Adedi", unit: "adet", kind: "count", higherIsBetter: true },
    { key: "durus", label: "Toplam Duruş Süresi", unit: "dk", kind: "count", higherIsBetter: false },
  ];

  function deltaPillHtml(curVal, prevVal, higherIsBetter, formatter) {
    if (curVal === null || prevVal === null || prevVal === undefined) {
      return `<span class="kpi-card__delta flat">→ Karşılaştırma yok</span>`;
    }
    const diff = curVal - prevVal;
    const isFlat = Math.abs(diff) < (formatter === fmtInt || formatter === fmtDk ? 0.5 : 0.05);
    let cls = "flat", arrow = "→";
    if (!isFlat) {
      const goingUp = diff > 0;
      cls = goingUp === higherIsBetter ? "up" : "down";
      arrow = goingUp ? "↑" : "↓";
    }
    return `<span class="kpi-card__delta ${cls}">${arrow} ${formatter(Math.abs(diff))}</span>`;
  }

  function gaugeCardHtml(m, cur, prev) {
    const val = cur[m.key];
    const status = statusFromValue(val, m.hedef);
    const r = 44, circ = 2 * Math.PI * r;
    const safeVal = val === null ? 0 : Math.max(0, Math.min(100, val));
    const offset = circ * (1 - safeVal / 100);
    return `
    <div class="kpi-card gauge-card">
      <div class="kpi-card__top">
        <span class="kpi-card__label">${m.label}</span>
        <span class="kpi-card__hedef">Hedef: ${fmtPct(m.hedef)}</span>
      </div>
      <div class="kpi-card__body gauge-wrap">
        <div class="gauge">
          <svg viewBox="0 0 104 104" role="img" aria-label="${m.label} göstergesi, değer ${fmtPct(val)}">
            <circle class="gauge__track" cx="52" cy="52" r="${r}"></circle>
            <circle class="gauge__value ${status}" cx="52" cy="52" r="${r}" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
          </svg>
          <div class="gauge__center">
            <span class="num">${val === null ? "—" : trDec1.format(val)}</span>
            <span class="pct">%</span>
          </div>
        </div>
        <div class="kpi-card__meta">
          ${statusPillHtml(status)}
          ${deltaPillHtml(val, prev[m.key], m.higherIsBetter, fmtPct)}
        </div>
      </div>
    </div>`;
  }

  function pctCardHtml(m, cur, prev) {
    const val = cur[m.key];
    const status = statusFromValue(val, m.hedef);
    return `
    <div class="kpi-card">
      <div class="kpi-card__top">
        <span class="kpi-card__label">${m.label}</span>
        <span class="kpi-card__hedef">Hedef: ${fmtPct(m.hedef)}</span>
      </div>
      <div class="kpi-card__body">
        <span class="kpi-card__value">${fmtPct(val)}</span>
      </div>
      <div class="kpi-card__meta">
        ${statusPillHtml(status)}
        ${deltaPillHtml(val, prev[m.key], m.higherIsBetter, fmtPct)}
      </div>
    </div>`;
  }

  function countCardHtml(m, cur, prev) {
    const val = cur[m.key];
    return `
    <div class="kpi-card">
      <div class="kpi-card__top">
        <span class="kpi-card__label">${m.label}</span>
      </div>
      <div class="kpi-card__body">
        <span class="kpi-card__value">${fmtInt(val)}</span><span class="kpi-card__value unit">${m.unit}</span>
      </div>
      <div class="kpi-card__meta">
        ${deltaPillHtml(val, prev[m.key], m.higherIsBetter, m.unit === "dk" ? fmtDk : fmtInt)}
        <span class="kpi-card__sub">Önceki dönem: ${fmtInt(prev[m.key])} ${m.unit}</span>
      </div>
    </div>`;
  }

  function kpiCardHtml(m, cur, prev) {
    if (m.kind === "gauge") return gaugeCardHtml(m, cur, prev);
    if (m.kind === "pct") return pctCardHtml(m, cur, prev);
    return countCardHtml(m, cur, prev);
  }

  function renderE1() {
    const cur = aggregate(state.filteredCurrent);
    const prev = aggregate(state.filteredPrevious);
    document.getElementById("e1-content").innerHTML = E1_METRICS.map((m) => kpiCardHtml(m, cur, prev)).join("");
    setScreenState("e1", "content");
  }

  /* ----------------------------------------------------------------------
     E2 — TREND (zaman serisi)
  ---------------------------------------------------------------------- */
  const E2_METRICS = [
    { key: "oee", label: "OEE", hedef: CONFIG.HEDEF.oee },
    { key: "avail", label: "Kullanılabilirlik", hedef: CONFIG.HEDEF.avail },
    { key: "perf", label: "Performans", hedef: CONFIG.HEDEF.perf },
    { key: "qual", label: "Kalite", hedef: CONFIG.HEDEF.qual },
  ];

  function renderE2MetricToggle() {
    document.getElementById("e2-metric-toggle").innerHTML = E2_METRICS.map((m) =>
      `<button type="button" data-metric="${m.key}" aria-pressed="${state.e2Metric === m.key}">${m.label}</button>`
    ).join("");
  }

  function lineChartSvg(curSeries, prevSeries, metric) {
    const w = 900, h = 360;
    const padL = 42, padR = 16, padT = 16, padB = 34;
    const innerW = w - padL - padR, innerH = h - padT - padB;
    const n = curSeries.length;

    function xAt(i) { return n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW; }
    function yAt(v) { return padT + (1 - v / 100) * innerH; }

    const gridLines = [0, 25, 50, 75, 100].map((g) => {
      const y = yAt(g);
      return `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}"></line>` +
        `<text class="tick-label" x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${g}</text>`;
    }).join("");

    const hedefY = yAt(metric.hedef);
    const hedefLine = `<line class="hedef-line" x1="${padL}" y1="${hedefY.toFixed(1)}" x2="${w - padR}" y2="${hedefY.toFixed(1)}"></line>` +
      `<text class="hedef-label" x="${w - padR}" y="${(hedefY - 4).toFixed(1)}" text-anchor="end">Hedef %${metric.hedef}</text>`;

    function pathFor(series) {
      let d = "", drawing = false;
      series.forEach((pt, i) => {
        const v = pt.agg[metric.key];
        if (v === null || v === undefined) { drawing = false; return; }
        d += `${drawing ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;
        drawing = true;
      });
      return d.trim();
    }
    function pointsFor(series, cls) {
      return series.map((pt, i) => {
        const v = pt.agg[metric.key];
        if (v === null || v === undefined) return "";
        return `<circle class="${cls}" cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="3"></circle>`;
      }).join("");
    }

    const hasFullCoverage = curSeries.every((pt) => pt.agg[metric.key] !== null);
    let areaPath = "";
    if (hasFullCoverage) {
      const baseline = yAt(0);
      const pts = curSeries.map((pt, i) => `${xAt(i).toFixed(1)},${yAt(pt.agg[metric.key]).toFixed(1)}`).join(" L");
      areaPath = `M${xAt(0).toFixed(1)},${baseline.toFixed(1)} L${pts} L${xAt(n - 1).toFixed(1)},${baseline.toFixed(1)} Z`;
    }

    const labelEvery = Math.max(1, Math.ceil(n / 9));
    const xLabels = curSeries.map((pt, i) => {
      if (i % labelEvery !== 0 && i !== n - 1) return "";
      return `<text class="tick-label" x="${xAt(i).toFixed(1)}" y="${h - padB + 18}" text-anchor="middle">${formatDateTR(pt.date).slice(0, 5)}</text>`;
    }).join("");

    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${metric.label} zaman serisi grafiği, mevcut dönem ve önceki dönem kıyaslaması">
      ${gridLines}
      <line class="axis-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}"></line>
      <line class="axis-line" x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}"></line>
      ${hedefLine}
      ${areaPath ? `<path class="area-mevcut" d="${areaPath}"></path>` : ""}
      <path class="line-onceki" d="${pathFor(prevSeries)}"></path>
      <path class="line-mevcut" d="${pathFor(curSeries)}"></path>
      ${pointsFor(prevSeries, "point-onceki")}
      ${pointsFor(curSeries, "point-mevcut")}
      ${xLabels}
    </svg>`;
  }

  function renderE2() {
    renderE2MetricToggle();
    const metric = E2_METRICS.find((m) => m.key === state.e2Metric);
    const curSeries = buildDailySeries(state.filteredCurrent, state.filters.start, state.filters.end);
    const prevSeries = buildDailySeries(state.filteredPrevious, state.previousRange.start, state.previousRange.end);
    document.getElementById("e2-chart").innerHTML = lineChartSvg(curSeries, prevSeries, metric);
    setScreenState("e2", "content");
  }

  /* ----------------------------------------------------------------------
     E3 — KIRILIM / PARETO
  ---------------------------------------------------------------------- */
  const E3_DIMS = [{ key: "hat", label: "Hat" }, { key: "vardiya", label: "Vardiya" }];

  function renderE3DimToggle() {
    document.getElementById("e3-dim-toggle").innerHTML = E3_DIMS.map((d) =>
      `<button type="button" data-dim="${d.key}" aria-pressed="${state.e3Dim === d.key}">${d.label}</button>`
    ).join("");
  }

  function barChartSvg(groups) {
    const w = 900, h = 320;
    const padL = 42, padR = 16, padT = 24, padB = 36;
    const innerW = w - padL - padR, innerH = h - padT - padB;
    const n = Math.max(1, groups.length);
    const slot = innerW / n;
    const barW = slot * 0.55;

    function yAt(v) { return padT + (1 - (v === null ? 0 : v) / 100) * innerH; }

    const gridLines = [0, 25, 50, 75, 100].map((g) => {
      const y = yAt(g);
      return `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}"></line>` +
        `<text class="tick-label" x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${g}</text>`;
    }).join("");

    const hedefY = yAt(CONFIG.HEDEF.oee);
    const hedefLine = `<line class="hedef-line" x1="${padL}" y1="${hedefY.toFixed(1)}" x2="${w - padR}" y2="${hedefY.toFixed(1)}"></line>` +
      `<text class="hedef-label" x="${w - padR}" y="${(hedefY - 4).toFixed(1)}" text-anchor="end">Hedef %${CONFIG.HEDEF.oee}</text>`;

    const bars = groups.map((g, i) => {
      const x = padL + i * slot + (slot - barW) / 2;
      const v = g.agg.oee;
      const y = yAt(v);
      const status = statusFromValue(v, CONFIG.HEDEF.oee);
      return `<rect class="bar-${status}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(h - padB - y).toFixed(1)}"></rect>` +
        `<text class="bar-label" x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${v === null ? "—" : fmtPct(v)}</text>` +
        `<text class="cat-label" x="${(x + barW / 2).toFixed(1)}" y="${h - padB + 18}" text-anchor="middle">${g.label}</text>`;
    }).join("");

    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Ortalama OEE karşılaştırma grafiği">
      ${gridLines}
      <line class="axis-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}"></line>
      <line class="axis-line" x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}"></line>
      ${hedefLine}
      ${bars}
    </svg>`;
  }

  function barWithCumSvg(groups) {
    const w = 900, h = 340;
    const padL = 46, padR = 46, padT = 24, padB = 64;
    const innerW = w - padL - padR, innerH = h - padT - padB;
    const n = Math.max(1, groups.length);
    const slot = innerW / n;
    const barW = slot * 0.6;
    const maxDurus = groups.reduce((m, g) => Math.max(m, g.agg.durus), 0) || 1;

    function yBar(v) { return padT + (1 - v / maxDurus) * innerH; }
    function yCum(p) { return padT + (1 - p / 100) * innerH; }
    function xCenter(i) { return padL + i * slot + slot / 2; }

    const bars = groups.map((g, i) => {
      const x = xCenter(i) - barW / 2;
      const y = yBar(g.agg.durus);
      return `<rect class="bar-pareto" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(h - padB - y).toFixed(1)}"></rect>` +
        `<text class="bar-label" x="${xCenter(i).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${fmtDk(g.agg.durus)}</text>` +
        `<text class="cat-label" x="${xCenter(i).toFixed(1)}" y="${h - padB + 18}" text-anchor="middle">${g.label}</text>`;
    }).join("");

    const cumPoints = groups.map((g, i) => ({ x: xCenter(i), y: yCum(g.cumPct) }));
    const cumPath = cumPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const cumDots = groups.map((g, i) =>
      `<circle class="point-cum" cx="${cumPoints[i].x.toFixed(1)}" cy="${cumPoints[i].y.toFixed(1)}" r="3"></circle>` +
      `<text class="bar-label" x="${cumPoints[i].x.toFixed(1)}" y="${(cumPoints[i].y - 10).toFixed(1)}" text-anchor="middle">${fmtPct(g.cumPct)}</text>`
    ).join("");

    const thresholdY = yCum(80);
    const thresholdLine = `<line class="hedef-line" x1="${padL}" y1="${thresholdY.toFixed(1)}" x2="${w - padR}" y2="${thresholdY.toFixed(1)}"></line>` +
      `<text class="hedef-label" x="${w - padR}" y="${(thresholdY - 4).toFixed(1)}" text-anchor="end">%80 eşiği</text>`;

    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Duruş nedenleri Pareto grafiği, çubuklar duruş süresini, çizgi kümülatif yüzdeyi gösterir">
      <line class="axis-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}"></line>
      <line class="axis-line" x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}"></line>
      ${thresholdLine}
      ${bars}
      <path class="line-cum" d="${cumPath}"></path>
      ${cumDots}
    </svg>`;
  }

  function renderE3() {
    renderE3DimToggle();
    const groups = groupBy(state.filteredCurrent, state.e3Dim);
    const statusLegend = `<div class="legend legend--chart">` +
      ["iyi", "dikkat", "kotu"].map((s) => `<span class="legend__item">${statusPillHtml(s)}</span>`).join("") +
      `</div>`;
    document.getElementById("e3-bar-chart").innerHTML = statusLegend + barChartSvg(groups);

    const causeGroups = groupBy(state.filteredCurrent, "durusNedeni");
    const sorted = [...causeGroups].sort((a, b) => b.agg.durus - a.agg.durus);
    const total = sorted.reduce((s, g) => s + g.agg.durus, 0);
    let cum = 0;
    const withCum = sorted.map((g) => {
      cum += g.agg.durus;
      return Object.assign({}, g, { cumPct: total > 0 ? (cum / total) * 100 : 0 });
    });
    const paretoLegend = `<div class="legend legend--chart">
      <span class="legend__item"><span class="legend__swatch mevcut" aria-hidden="true"></span>Duruş süresi (dk)</span>
      <span class="legend__item"><span class="legend__swatch cum" aria-hidden="true"></span>Kümülatif yüzde</span>
    </div>`;
    document.getElementById("e3-pareto-chart").innerHTML = paretoLegend + barWithCumSvg(withCum);

    setScreenState("e3", "content");
  }

  /* ----------------------------------------------------------------------
     E4 — DETAY / AKSİYON (sıralanabilir, sayfalanabilir tablo)
  ---------------------------------------------------------------------- */
  const E4_COLUMNS = [
    { key: "tarihDate", label: "Tarih", numeric: false },
    { key: "hat", label: "Hat", numeric: false },
    { key: "vardiya", label: "Vardiya", numeric: false },
    { key: "oee", label: "OEE", numeric: true },
    { key: "avail", label: "Kullanılabilirlik", numeric: true },
    { key: "perf", label: "Performans", numeric: true },
    { key: "qual", label: "Kalite", numeric: true },
    { key: "uretim", label: "Üretim", numeric: true },
    { key: "hatali", label: "Hatalı", numeric: true },
    { key: "durus", label: "Duruş", numeric: true },
    { key: "durusNedeni", label: "Duruş Nedeni", numeric: false },
  ];

  function renderE4TableHead() {
    const cells = E4_COLUMNS.map((c) => {
      const active = state.e4Sort.key === c.key;
      const arrow = active ? (state.e4Sort.dir === "asc" ? "↑" : "↓") : "";
      return `<th class="${c.numeric ? "num" : ""}"><button type="button" data-sort="${c.key}">${c.label}${arrow ? " " + arrow : ""}</button></th>`;
    }).join("") + `<th>Durum</th>`;
    document.getElementById("e4-table-head").innerHTML = cells;
  }

  function renderE4() {
    renderE4TableHead();
    const rows = [...state.filteredCurrent];
    const { key, dir } = state.e4Sort;
    rows.sort((a, b) => {
      let av = a[key], bv = b[key];
      if (key === "tarihDate") { av = av.getTime(); bv = bv.getTime(); }
      if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv, "tr") : bv.localeCompare(av, "tr");
      return dir === "asc" ? av - bv : bv - av;
    });

    const totalPages = Math.max(1, Math.ceil(rows.length / CONFIG.PAGE_SIZE));
    if (state.e4Page > totalPages) state.e4Page = totalPages;
    const startIdx = (state.e4Page - 1) * CONFIG.PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + CONFIG.PAGE_SIZE);

    document.getElementById("e4-table-body").innerHTML = pageRows.map((r) => {
      const status = statusFromValue(r.oee, CONFIG.HEDEF.oee);
      return `<tr>
        <td>${r.tarih}</td>
        <td>${r.hat}</td>
        <td>${r.vardiya}</td>
        <td class="num">${fmtPct(r.oee)}</td>
        <td class="num">${fmtPct(r.avail)}</td>
        <td class="num">${fmtPct(r.perf)}</td>
        <td class="num">${fmtPct(r.qual)}</td>
        <td class="num">${fmtInt(r.uretim)}</td>
        <td class="num">${fmtInt(r.hatali)}</td>
        <td class="num">${fmtDk(r.durus)}</td>
        <td>${r.durusNedeni}</td>
        <td>${statusPillHtml(status)}</td>
      </tr>`;
    }).join("");

    document.getElementById("e4-count").textContent =
      `${fmtInt(rows.length)} kayıttan ${fmtInt(pageRows.length)} gösteriliyor`;

    document.getElementById("e4-pagination").innerHTML = `
      <span>Sayfa ${state.e4Page} / ${totalPages}</span>
      <div class="pagination__btns">
        <button type="button" data-page="prev" ${state.e4Page <= 1 ? "disabled" : ""}>Önceki</button>
        <button type="button" data-page="next" ${state.e4Page >= totalPages ? "disabled" : ""}>Sonraki</button>
      </div>`;

    setScreenState("e4", "content");
  }

  /* ----------------------------------------------------------------------
     ALT BİLGİ (metodoloji şeffaflığı)
  ---------------------------------------------------------------------- */
  function renderFootnote() {
    document.getElementById("footnote").textContent =
      "Metodoloji: OEE = Kullanılabilirlik × Performans × Kalite. Kullanılabilirlik = Çalışma Süresi / Planlı Süre; " +
      "Performans = (Üretim Adedi × Çevrim Süresi) / Çalışma Süresi; Kalite = (Üretim Adedi − Hatalı Adet) / Üretim Adedi. " +
      "Çevrim süresi, standart/ideal çevrim süresi olarak kabul edilmiştir. Hedef değerler (OEE %85, Kullanılabilirlik %90, " +
      "Performans %95, Kalite %99) TPM/Nakajima dünya standardı kıyas değerleridir; veri setinden türetilmemiştir. Dönemsel " +
      "toplulaştırmalar, satır bazlı OEE yüzdelerinin ortalaması değil, bileşenlerin (süre, üretim, hata) toplamından " +
      "oranlanarak hesaplanır. Veri kaynağı: veri.csv (bağlı, koddan ayrık dosya). Canlı Google E-Tablosu bağlantısına " +
      "geçiş için app.js dosyasındaki CONFIG.DATA_SOURCE_URL notuna bakın.";
  }

  /* ----------------------------------------------------------------------
     OLAY BAĞLAMA
  ---------------------------------------------------------------------- */
  function wireEvents() {
    document.querySelectorAll(".tabbar__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tabbar__btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
        document.getElementById("screen-" + btn.dataset.screen).classList.add("is-active");
      });
    });

    document.getElementById("fHat").addEventListener("change", (e) => {
      state.filters.hat = e.target.value; onFiltersChanged();
    });
    document.getElementById("fVardiya").addEventListener("change", (e) => {
      state.filters.vardiya = e.target.value; onFiltersChanged();
    });
    document.getElementById("fBaslangic").addEventListener("change", (e) => {
      if (!e.target.value) return;
      state.filters.start = dateFromIso(e.target.value); onFiltersChanged();
    });
    document.getElementById("fBitis").addEventListener("change", (e) => {
      if (!e.target.value) return;
      state.filters.end = dateFromIso(e.target.value); onFiltersChanged();
    });
    document.getElementById("btnReset").addEventListener("click", resetFilters);

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="retry"]')) { loadData(); return; }
      if (e.target.closest('[data-action="reset-filters"]')) { resetFilters(); return; }

      const metricBtn = e.target.closest("#e2-metric-toggle button");
      if (metricBtn) { state.e2Metric = metricBtn.dataset.metric; renderE2(); return; }

      const dimBtn = e.target.closest("#e3-dim-toggle button");
      if (dimBtn) { state.e3Dim = dimBtn.dataset.dim; renderE3(); return; }

      const sortBtn = e.target.closest("#e4-table-head button");
      if (sortBtn) {
        const k = sortBtn.dataset.sort;
        if (state.e4Sort.key === k) state.e4Sort.dir = state.e4Sort.dir === "asc" ? "desc" : "asc";
        else { state.e4Sort.key = k; state.e4Sort.dir = "asc"; }
        state.e4Page = 1;
        renderE4();
        return;
      }

      const pageBtn = e.target.closest("#e4-pagination button");
      if (pageBtn) {
        if (pageBtn.dataset.page === "prev") state.e4Page = Math.max(1, state.e4Page - 1);
        else state.e4Page += 1;
        renderE4();
      }
    });
  }

  /* ----------------------------------------------------------------------
     BAŞLATMA
  ---------------------------------------------------------------------- */
  function init() {
    renderFootnote();
    wireEvents();
    loadData();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
