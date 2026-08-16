(function () {
  var HISTORY_KEY = 'qrg_history_v1';
  var MAX_HISTORY = 6;
  var DEFAULT_FG = '#1a1033';
  var DEFAULT_BG = '#ffffff';

  var els = {
    text: document.getElementById('qr-text'),
    inputWrap: document.getElementById('input-wrap'),
    error: document.getElementById('qr-error'),
    size: document.getElementById('qr-size'),
    margin: document.getElementById('qr-margin'),
    fg: document.getElementById('qr-fg'),
    bg: document.getElementById('qr-bg'),
    reset: document.getElementById('btn-reset'),
    clear: document.getElementById('btn-clear'),
    generate: document.getElementById('btn-generate'),
    previewSlot: document.getElementById('preview-slot'),
    emptyState: document.getElementById('empty-state'),
    download: document.getElementById('btn-download'),
    copy: document.getElementById('btn-copy'),
    previewBox: document.getElementById('preview-box'),
    historyList: document.getElementById('history-list'),
    historySection: document.getElementById('history-section'),
    historyClear: document.getElementById('btn-history-clear'),
    toast: document.getElementById('toast'),
    devWarning: document.getElementById('dev-warning'),
    year: document.getElementById('year')
  };

  var currentQR = null;

  els.year.textContent = new Date().getFullYear();

  function toast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      els.toast.className = 'toast';
    }, 2200);
  }

  function qrHolder() {
    var old = document.getElementById('qr-canvas');
    if (old) {
      old.remove();
    }
    var div = document.createElement('div');
    div.id = 'qr-canvas';
    els.previewSlot.appendChild(div);
    return div;
  }

  function currentOptions() {
    return {
      text: els.text.value.trim(),
      width: parseInt(els.size.value, 10),
      height: parseInt(els.size.value, 10),
      colorDark: els.fg.value,
      colorLight: els.bg.value,
      correctLevel: QRCode.CorrectLevel.M
    };
  }

  function isSmallScreen() {
    return window.innerWidth < 720;
  }

  function setLinkError(show) {
    els.inputWrap.classList.toggle('error', show);
    els.error.classList.toggle('show', show);
  }

  function isValidLink(text) {
    text = (text || '').trim();
    if (!text) {
      return false;
    }
    if (/\s/.test(text)) {
      return false;
    }
    if (/^(https?|ftp):\/\//i.test(text)) {
      return true;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
      return true;
    }
    if (/^www\./i.test(text)) {
      return true;
    }
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?(\/[^\s]*)?$/i.test(text);
  }

  function generate(silent) {
    var text = els.text.value.trim();
    if (!text) {
      setLinkError(false);
      if (!silent) {
        toast('Masukkan link dulu ya', 'err');
        els.text.focus();
      }
      return;
    }
    if (!isValidLink(text)) {
      setLinkError(true);
      if (!silent) {
        toast('Link yang dimasukkan tidak valid', 'err');
        els.text.focus();
      }
      return;
    }
    setLinkError(false);
    try {
      var div = qrHolder();
      currentQR = new QRCode(div, currentOptions());
      var canvas = div.querySelector('canvas');
      if (canvas) {
        canvas.style.width = 'min(100%, ' + canvas.width + 'px)';
      }
      els.emptyState.hidden = true;
      els.previewBox.classList.add('ready');
      els.download.disabled = false;
      els.copy.disabled = false;
      saveHistory();
      renderHistory();
      if (!silent) {
        toast('QR berhasil dibuat', 'ok');
        if (isSmallScreen()) {
          els.previewBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (e) {
      currentQR = null;
      els.download.disabled = true;
      els.copy.disabled = true;
      if (!silent) {
        toast('Teks terlalu panjang untuk QR', 'err');
      }
    }
  }

  function highResCanvas(model, px, margin) {
    var count = model.getModuleCount();
    var cell = px / (count + margin * 2);
    var canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = els.bg.value;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = els.fg.value;
    var offset = margin * cell;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (model.isDark(r, c)) {
          var x = Math.round(offset + c * cell);
          var y = Math.round(offset + r * cell);
          var w = Math.ceil(offset + (c + 1) * cell) - x;
          var h = Math.ceil(offset + (r + 1) * cell) - y;
          ctx.fillRect(x, y, w, h);
        }
      }
    }
    return canvas;
  }

  function downloadPng() {
    if (!currentQR) {
      return;
    }
    var canvas = highResCanvas(currentQR._oQRCode, 1024, parseInt(els.margin.value, 10));
    var link = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '');
    link.download = 'qrcode-' + stamp + '.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Gambar QR sedang diunduh', 'ok');
  }

  function copyTextFallback() {
    var text = els.text.value.trim();
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    toast(ok ? 'Teks berhasil disalin' : 'Perangkat tidak mendukung salin gambar', ok ? 'ok' : 'err');
  }

  function copyQr() {
    if (!currentQR) {
      return;
    }
    var canvas = highResCanvas(currentQR._oQRCode, 512, parseInt(els.margin.value, 10));
    var done = function (blob) {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(function () { toast('Gambar QR disalin', 'ok'); })
          .catch(function () { copyTextFallback(); });
      } else {
        copyTextFallback();
      }
    };
    canvas.toBlob(done, 'image/png');
  }

  function getHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    var list = getHistory();
    var item = {
      text: els.text.value.trim(),
      fg: els.fg.value,
      bg: els.bg.value,
      size: els.size.value,
      margin: els.margin.value,
      time: Date.now()
    };
    list = list.filter(function (x) { return x.text !== item.text; });
    list.unshift(item);
    list = list.slice(0, MAX_HISTORY);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function thumbCanvas(item) {
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(holder);
    try {
      var qr = new QRCode(holder, {
        text: item.text,
        width: 80,
        height: 80,
        colorDark: item.fg || DEFAULT_FG,
        colorLight: item.bg || DEFAULT_BG,
        correctLevel: QRCode.CorrectLevel.M
      });
      var canvas = holder.querySelector('canvas');
      document.body.removeChild(holder);
      return canvas;
    } catch (e) {
      document.body.removeChild(holder);
      return null;
    }
  }

  function useHistory(item) {
    els.text.value = item.text;
    els.fg.value = item.fg || DEFAULT_FG;
    els.bg.value = item.bg || DEFAULT_BG;
    els.size.value = item.size || '400';
    els.margin.value = item.margin || '2';
    els.clear.classList.add('show');
    generate();
    if (isSmallScreen()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function renderHistory() {
    var list = getHistory();
    if (!list.length) {
      els.historyList.innerHTML = '<li class="history-empty">Belum ada riwayat. Buat QR pertamamu!</li>';
      return;
    }
    els.historyList.innerHTML = '';
    list.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'history-item';

      var thumb = document.createElement('div');
      thumb.className = 'history-thumb';
      var cv = thumbCanvas(item);
      if (cv) {
        thumb.appendChild(cv);
      }

      var body = document.createElement('div');
      body.className = 'history-body';
      var p = document.createElement('p');
      p.textContent = item.text;
      var span = document.createElement('span');
      span.textContent = formatTime(item.time);
      body.appendChild(p);
      body.appendChild(span);

      var del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('aria-label', 'Hapus riwayat');
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"></path></svg>';

      li.appendChild(thumb);
      li.appendChild(body);
      li.appendChild(del);

      li.addEventListener('click', function () { useHistory(item); });
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        var list2 = getHistory().filter(function (x) { return x.text !== item.text; });
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(list2));
        } catch (err) {}
        renderHistory();
      });

      els.historyList.appendChild(li);
    });
  }

  function formatTime(ts) {
    if (!ts) {
      return '';
    }
    var d = new Date(ts);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) {
      return 'baru saja';
    }
    if (diff < 3600000) {
      return Math.floor(diff / 60000) + ' menit lalu';
    }
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + ' jam lalu';
    }
    if (now.getFullYear() === d.getFullYear() && now.getMonth() === d.getMonth() && now.getDate() === d.getDate()) {
      return 'hari ini';
    }
    return d.toLocaleDateString('id-ID');
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
    renderHistory();
    toast('Riwayat dibersihkan');
  }

  function resetColors() {
    els.fg.value = DEFAULT_FG;
    els.bg.value = DEFAULT_BG;
    if (currentQR) {
      generate(true);
    }
    toast('Warna dikembalikan');
  }

  els.generate.addEventListener('click', function () { generate(); });

  els.text.addEventListener('input', function () {
    var hasText = els.text.value.length > 0;
    els.clear.classList.toggle('show', hasText);
    if (!hasText) {
      setLinkError(false);
      return;
    }
    setLinkError(!isValidLink(els.text.value));
  });

  els.text.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  });

  els.clear.addEventListener('click', function () {
    els.text.value = '';
    els.text.focus();
    els.clear.classList.remove('show');
    setLinkError(false);
  });

  els.size.addEventListener('change', function () {
    if (currentQR) {
      generate(true);
    }
  });

  els.margin.addEventListener('change', function () {
    if (currentQR) {
      generate(true);
    }
  });

  els.fg.addEventListener('input', function () {
    if (currentQR) {
      generate(true);
    }
  });

  els.bg.addEventListener('input', function () {
    if (currentQR) {
      generate(true);
    }
  });

  els.reset.addEventListener('click', resetColors);
  els.download.addEventListener('click', downloadPng);
  els.copy.addEventListener('click', copyQr);
  els.historyClear.addEventListener('click', clearHistory);

  renderHistory();

  var _ctx = new Date().getTime();
  try {
    console.log('%cKris dilindungi dari penyalinan.', 'color:#ec4899;font-size:14px;font-weight:bold;');
  } catch (e) {}

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); return false; });
  document.addEventListener('copy', function (e) { e.preventDefault(); return false; });
  document.addEventListener('cut', function (e) { e.preventDefault(); return false; });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); return false; });

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode || e.which;
    var mod = e.ctrlKey || e.metaKey;
    var blocked =
      k === 123 ||
      (mod && e.shiftKey && (k === 73 || k === 74 || k === 67)) ||
      (mod && (k === 85 || k === 83 || k === 67));
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      showDevWarning(true);
    }
  });

  function showDevWarning(autoHide) {
    els.devWarning.hidden = false;
    clearTimeout(showDevWarning._t);
    if (autoHide) {
      showDevWarning._t = setTimeout(hideDevWarning, 3500);
    }
  }

  function hideDevWarning() {
    clearTimeout(showDevWarning._t);
    els.devWarning.hidden = true;
  }

  function devtoolsCheck() {
    var threshold = 140;
    var wGap = window.outerWidth - window.innerWidth;
    var hGap = window.outerHeight - window.innerHeight;
    if (wGap > threshold || hGap > threshold) {
      showDevWarning(false);
    } else {
      hideDevWarning();
    }
  }

  els.devWarning.addEventListener('click', hideDevWarning);

  window.addEventListener('resize', devtoolsCheck);
  setTimeout(devtoolsCheck, 900);

  setInterval(function () {
    var start = new Date().getTime();
    (function () { debugger; })();
    if (new Date().getTime() - start > 120) {
      showDevWarning(false);
    }
  }, 1500);
})();
