(() => {
  'use strict';

  // ===== State =====
  // ===== Storage helpers =====
  const STORAGE = {
    favs: 'sp_favs_v2',
    history: 'sp_history',
    playlists: 'sp_playlists',
    theme: 'sp_theme',
    cors: 'sp_cors_proxy',
    epg: 'sp_epg_url',
  };

  const COUNTRY_NAMES = {
    us: 'Estados Unidos', uk: 'Reino Unido', es: 'España', mx: 'México', ar: 'Argentina',
    co: 'Colombia', cl: 'Chile', pe: 'Perú', ve: 'Venezuela', br: 'Brasil',
    fr: 'Francia', de: 'Alemania', it: 'Italia', pt: 'Portugal', ca: 'Canadá',
    au: 'Australia', in: 'India', jp: 'Japón', cn: 'China', ru: 'Rusia',
    tr: 'Turquía', nl: 'Países Bajos', be: 'Bélgica', ch: 'Suiza', se: 'Suecia',
    no: 'Noruega', pl: 'Polonia', gr: 'Grecia', ie: 'Irlanda', nz: 'Nueva Zelanda',
    za: 'Sudáfrica', eg: 'Egipto', sa: 'Arabia Saudí', ae: 'EAU', kr: 'Corea del Sur',
    tw: 'Taiwán', hk: 'Hong Kong', ph: 'Filipinas', id: 'Indonesia', th: 'Tailandia',
    my: 'Malasia', sg: 'Singapur', vn: 'Vietnam', pk: 'Pakistán', bd: 'Bangladés',
    ng: 'Nigeria', ma: 'Marruecos', uy: 'Uruguay', ec: 'Ecuador', bo: 'Bolivia',
    py: 'Paraguay', cr: 'Costa Rica', pa: 'Panamá', do: 'Rep. Dominicana', cu: 'Cuba',
    gt: 'Guatemala', hn: 'Honduras', sv: 'El Salvador', ni: 'Nicaragua', int: 'Internacional',
  };

  const LANG_NAMES = {
    spa: 'Español', eng: 'English', por: 'Português', fre: 'Français', fra: 'Français',
    ger: 'Deutsch', deu: 'Deutsch', ita: 'Italiano', rus: 'Русский', ara: 'العربية',
    chi: '中文', zho: '中文', jpn: '日本語', kor: '한국어', hin: 'हिन्दी',
    tur: 'Türkçe', pol: 'Polski', dut: 'Nederlands', nld: 'Nederlands', swe: 'Svenska',
    cat: 'Català', glg: 'Galego', eus: 'Euskera',
  };

  function loadJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Migrate old favorites (array of URLs) → global objects
  function loadFavorites() {
    let favs = loadJSON(STORAGE.favs, null);
    if (!favs) {
      const old = loadJSON('sp_favs', []);
      if (Array.isArray(old) && old.length && typeof old[0] === 'string') {
        favs = old.map((url) => ({ url, name: url.split('/').pop() || 'Canal', logo: '', group: 'Favoritos' }));
        saveJSON(STORAGE.favs, favs);
      } else {
        favs = [];
      }
    }
    return Array.isArray(favs) ? favs : [];
  }

  const state = {
    channels: [],
    filtered: [],
    currentIndex: -1,
    currentChannel: null,
    hls: null,
    favorites: loadFavorites(), // [{url,name,logo,group}]
    history: loadJSON(STORAGE.history, []), // [{url,name,logo,group,ts}]
    playlists: loadJSON(STORAGE.playlists, []), // [{id,name,url}]
    theme: localStorage.getItem(STORAGE.theme) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    viewMode: 'all', // 'all' | 'favorites' | 'history'
    lastPlaylistUrl: '',
    corsProxy: localStorage.getItem('sp_cors_proxy') || '',
    epgUrl: localStorage.getItem('sp_epg_url') || '',
    epgData: null, // Map tvgId -> [{start, stop, title}]
    playlistEpgUrls: [],
  };

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    sidebar: $('#sidebar'),
    sidebarToggle: $('#sidebarToggle'),
    themeToggle: $('#themeToggle'),
    fullscreenBtn: $('#fullscreenBtn'),
    installBtn: $('#installBtn'),
    playlistUrl: $('#playlistUrl'),
    loadUrlBtn: $('#loadUrlBtn'),
    savePlaylistBtn: $('#savePlaylistBtn'),
    refreshPlaylistBtn: $('#refreshPlaylistBtn'),
    settingsBtn: $('#settingsBtn'),
    settingsPanel: $('#settingsPanel'),
    corsProxyInput: $('#corsProxyInput'),
    epgUrlInput: $('#epgUrlInput'),
    saveSettingsBtn: $('#saveSettingsBtn'),
    loadEpgBtn: $('#loadEpgBtn'),
    fileInput: $('#fileInput'),
    searchInput: $('#searchInput'),
    clearSearch: $('#clearSearch'),
    groupFilter: $('#groupFilter'),
    countryFilter: $('#countryFilter'),
    langFilter: $('#langFilter'),
    channelCount: $('#channelCount'),
    epgBar: $('#epgBar'),
    epgNowTitle: $('#epgNowTitle'),
    epgNextTitle: $('#epgNextTitle'),
    trackSelects: $('#trackSelects'),
    qualitySelect: $('#qualitySelect'),
    audioSelect: $('#audioSelect'),
    channelList: $('#channelList'),
    emptyState: $('#emptyState'),
    video: $('#videoPlayer'),
    videoContainer: $('#videoContainer'),
    playerOverlay: $('#playerOverlay'),
    currentLogo: $('#currentLogo'),
    currentTitle: $('#currentTitle'),
    currentGroup: $('#currentGroup'),
    loadingSpinner: $('#loadingSpinner'),
    errorMsg: $('#errorMsg'),
    errorText: $('#errorText'),
    retryBtn: $('#retryBtn'),
    infoTitle: $('#infoTitle'),
    infoMeta: $('#infoMeta'),
    favBtn: $('#favBtn'),
    pipBtn: $('#pipBtn'),
    copyUrlBtn: $('#copyUrlBtn'),
    exportFavsBtn: $('#exportFavsBtn'),
    toast: $('#toast'),
    mobileNav: $('#mobileNav'),
    nowPlaying: document.querySelector('.now-playing'),
    tabAll: $('#tabAll'),
    tabFavorites: $('#tabFavorites'),
    tabHistory: $('#tabHistory'),
    favBadge: $('#favBadge'),
    histBadge: $('#histBadge'),
    savedList: $('#savedList'),
    clearHistoryBtn: $('#clearHistoryBtn'),
  };

  // ===== Theme =====
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE.theme, theme);
    state.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = theme === 'dark' ? '#0f172a' : '#f8fafc';
    });
  }
  applyTheme(state.theme);

  els.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // ===== Toast =====
  let toastTimer;
  function showToast(msg, duration = 2500) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => { els.toast.hidden = true; }, 300);
    }, duration);
  }

  // ===== M3U Parser =====
  function guessCountry(tvgId, name, group) {
    if (tvgId) {
      const m = tvgId.match(/\.([a-z]{2})$/i) || tvgId.match(/@([a-z]{2})$/i);
      if (m && COUNTRY_NAMES[m[1].toLowerCase()]) return m[1].toLowerCase();
    }
    const blob = `${name || ''} ${group || ''}`.toLowerCase();
    for (const code of Object.keys(COUNTRY_NAMES)) {
      if (blob.includes(`(${code})`) || blob.includes(`[${code}]`)) return code;
    }
    return '';
  }

  function guessLang(tvgId, name, group) {
    if (tvgId) {
      // rare: lang in id
    }
    const blob = `${name || ''} ${group || ''}`.toLowerCase();
    if (/\b(español|spanish|castellano)\b/.test(blob)) return 'spa';
    if (/\b(english|inglés|ingles)\b/.test(blob)) return 'eng';
    if (/\b(portugu[eê]s|portuguese)\b/.test(blob)) return 'por';
    if (/\b(français|french|frances)\b/.test(blob)) return 'fra';
    if (/\b(deutsch|german|alemán)\b/.test(blob)) return 'deu';
    if (/\b(italiano|italian)\b/.test(blob)) return 'ita';
    if (/\b(arabic|árabe|arabe)\b/.test(blob)) return 'ara';
    return '';
  }

  function parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    const epgUrls = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTM3U')) {
        const tvg = line.match(/x-tvg-url="([^"]+)"/i) || line.match(/url-tvg="([^"]+)"/i);
        if (tvg) {
          tvg[1].split(/[,|]/).map((u) => u.trim()).filter(Boolean).forEach((u) => epgUrls.push(u));
        }
        continue;
      }

      if (line.startsWith('#EXTINF:')) {
        current = {
          name: '',
          logo: '',
          group: 'Sin grupo',
          url: '',
          tvgId: '',
          country: '',
          lang: '',
        };

        const attrMatch = line.match(/#EXTINF:(-?\d+)\s*(.*)/);
        if (attrMatch) {
          const attrs = attrMatch[2] || '';
          const logoM = attrs.match(/tvg-logo="([^"]*)"/i);
          if (logoM) current.logo = logoM[1];
          const groupM = attrs.match(/group-title="([^"]*)"/i);
          if (groupM) current.group = groupM[1] || 'Sin grupo';
          const idM = attrs.match(/tvg-id="([^"]*)"/i);
          if (idM) current.tvgId = idM[1];
          const langM = attrs.match(/tvg-language="([^"]*)"/i) || attrs.match(/language="([^"]*)"/i);
          if (langM) {
            const raw = langM[1].toLowerCase();
            current.lang = Object.keys(LANG_NAMES).find((k) => raw.includes(k) || LANG_NAMES[k].toLowerCase().includes(raw.slice(0, 4))) || raw.slice(0, 3);
          }
          const countryM = attrs.match(/tvg-country="([^"]*)"/i) || attrs.match(/country="([^"]*)"/i);
          if (countryM) current.country = countryM[1].toLowerCase().slice(0, 2);

          const commaIdx = attrs.lastIndexOf(',');
          if (commaIdx !== -1) {
            current.name = attrs.slice(commaIdx + 1).trim();
          } else {
            current.name = attrs.replace(/tvg-[^=]+="[^"]*"\s*/gi, '').replace(/group-title="[^"]*"\s*/gi, '').trim() || 'Canal sin nombre';
          }
          if (!current.country) current.country = guessCountry(current.tvgId, current.name, current.group);
          if (!current.lang) current.lang = guessLang(current.tvgId, current.name, current.group);
        }
      } else if (line.startsWith('#EXTGRP:')) {
        if (current) current.group = line.slice(8).trim() || current.group;
      } else if (line.startsWith('#')) {
        // ignore
      } else if (current) {
        current.url = line;
        if (current.name) {
          channels.push(current);
        }
        current = null;
      }
    }
    return { channels, epgUrls };
  }

  function proxiedFetchUrl(url) {
    if (!state.corsProxy) return url;
    const p = state.corsProxy;
    if (p.includes('?') && !p.endsWith('=') && !p.endsWith('?')) {
      return p + (p.endsWith('/') ? '' : '/') + encodeURIComponent(url);
    }
    return p + encodeURIComponent(url);
  }

  async function fetchText(url) {
    const target = proxiedFetchUrl(url);
    const res = await fetch(target, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  // ===== Load Playlist =====
  async function loadPlaylist(source, isFile = false) {
    showLoading(true);
    hideError();
    try {
      let text;
      if (isFile) {
        text = await source.text();
        state.lastPlaylistUrl = '';
      } else {
        text = await fetchText(source);
        state.lastPlaylistUrl = source;
        if (els.playlistUrl) els.playlistUrl.value = source;
      }

      if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
        throw new Error('El archivo no parece ser una lista M3U válida');
      }

      const parsed = parseM3U(text);
      state.channels = parsed.channels;
      state.playlistEpgUrls = parsed.epgUrls || [];
      if (state.channels.length === 0) {
        throw new Error('No se encontraron canales en la lista');
      }

      state.viewMode = 'all';
      setViewMode('all', true);
      populateFilters();
      filterChannels();
      showToast(`Cargados ${state.channels.length} canales`);
      if (window.innerWidth <= 900) openChannelsView();

      // Auto EPG if URL set or found in playlist
      if (state.epgUrl || state.playlistEpgUrls.length) {
        loadEpg().catch(() => {});
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar la lista: ' + (err.message || 'desconocido'));
      state.channels = [];
      filterChannels();
    } finally {
      showLoading(false);
    }
  }

  function populateFilters() {
    const groups = [...new Set(state.channels.map((c) => c.group))].sort((a, b) => a.localeCompare(b));
    els.groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      els.groupFilter.appendChild(opt);
    });

    const countries = [...new Set(state.channels.map((c) => c.country).filter(Boolean))].sort();
    if (els.countryFilter) {
      els.countryFilter.innerHTML = '<option value="">Todos los países</option>';
      countries.forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = COUNTRY_NAMES[code] || code.toUpperCase();
        els.countryFilter.appendChild(opt);
      });
      els.countryFilter.hidden = countries.length === 0;
    }

    const langs = [...new Set(state.channels.map((c) => c.lang).filter(Boolean))].sort();
    if (els.langFilter) {
      els.langFilter.innerHTML = '<option value="">Todos los idiomas</option>';
      langs.forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = LANG_NAMES[code] || code;
        els.langFilter.appendChild(opt);
      });
      els.langFilter.hidden = langs.length === 0;
    }
  }

  // ===== Filter & Render =====
  function isFavorite(url) {
    return state.favorites.some((f) => f.url === url);
  }

  function updateBadges() {
    const nFav = state.favorites.length;
    if (els.favBadge) {
      els.favBadge.textContent = nFav;
      els.favBadge.hidden = nFav === 0;
    }
    const nHist = state.history.length;
    if (els.histBadge) {
      els.histBadge.textContent = nHist;
      els.histBadge.hidden = nHist === 0;
    }
    if (els.clearHistoryBtn) {
      els.clearHistoryBtn.hidden = nHist === 0;
    }
    if (els.exportFavsBtn) {
      els.exportFavsBtn.hidden = nFav === 0;
    }
  }

  function filterChannels() {
    const q = els.searchInput.value.trim().toLowerCase();
    const group = els.groupFilter.value;
    const country = els.countryFilter?.value || '';
    const lang = els.langFilter?.value || '';

    let list;
    if (state.viewMode === 'favorites') {
      list = state.favorites.map((f) => ({ ...f, group: f.group || 'Favoritos' }));
    } else if (state.viewMode === 'history') {
      list = state.history.map((h) => ({ ...h, group: h.group || 'Recientes' }));
    } else {
      list = state.channels;
    }

    state.filtered = list.filter((c) => {
      const matchQ = !q || (c.name || '').toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q);
      const matchG = !group || c.group === group;
      const matchC = !country || c.country === country;
      const matchL = !lang || c.lang === lang;
      return matchQ && matchG && matchC && matchL;
    });

    if (state.viewMode === 'all' && !q && !group) {
      state.filtered.sort((a, b) => {
        const af = isFavorite(a.url) ? 0 : 1;
        const bf = isFavorite(b.url) ? 0 : 1;
        return af - bf;
      });
    }

    updateBadges();
    renderChannelList();
  }

  function renderChannelList() {
    const labels = { all: 'canal', favorites: 'favorito', history: 'reciente' };
    const label = labels[state.viewMode] || 'canal';
    els.channelCount.textContent = `${state.filtered.length} ${label}${state.filtered.length !== 1 ? 's' : ''}`;

    if (state.filtered.length === 0) {
      els.channelList.innerHTML = '';
      els.channelList.appendChild(els.emptyState);
      els.emptyState.hidden = false;
      if (state.viewMode === 'favorites') {
        els.emptyState.querySelector('p').textContent = 'No tienes favoritos';
        els.emptyState.querySelector('.hint').textContent = 'Marca canales con el corazón para verlos aquí';
      } else if (state.viewMode === 'history') {
        els.emptyState.querySelector('p').textContent = 'Sin historial';
        els.emptyState.querySelector('.hint').textContent = 'Los canales que reproduzcas aparecerán aquí';
      } else if (state.channels.length > 0) {
        els.emptyState.querySelector('p').textContent = 'No hay resultados';
        els.emptyState.querySelector('.hint').textContent = 'Prueba otro término o grupo';
      } else {
        els.emptyState.querySelector('p').textContent = 'Carga una lista M3U para empezar';
        els.emptyState.querySelector('.hint').textContent = 'Usa una URL, un archivo o las listas recomendadas';
      }
      return;
    }

    els.emptyState.hidden = true;
    const frag = document.createDocumentFragment();
    const currentUrl = state.currentChannel?.url;

    state.filtered.forEach((ch) => {
      const item = document.createElement('div');
      item.className = 'channel-item';
      if (currentUrl && ch.url === currentUrl) item.classList.add('active');
      if (isFavorite(ch.url)) item.classList.add('favorited');

      // Logo
      if (ch.logo) {
        const img = document.createElement('img');
        img.className = 'channel-logo';
        img.src = ch.logo;
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => {
          img.replaceWith(createPlaceholder(ch.name));
        };
        item.appendChild(img);
      } else {
        item.appendChild(createPlaceholder(ch.name));
      }

      const info = document.createElement('div');
      info.className = 'channel-info';
      const name = document.createElement('div');
      name.className = 'channel-name';
      name.textContent = ch.name;
      const grp = document.createElement('div');
      grp.className = 'channel-group';
      grp.textContent = ch.group;
      info.appendChild(name);
      info.appendChild(grp);
      item.appendChild(info);

      // Fav icon
      const favSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      favSvg.setAttribute('width', '16');
      favSvg.setAttribute('height', '16');
      favSvg.setAttribute('viewBox', '0 0 24 24');
      favSvg.setAttribute('fill', isFavorite(ch.url) ? 'currentColor' : 'none');
      favSvg.setAttribute('stroke', 'currentColor');
      favSvg.setAttribute('stroke-width', '2');
      favSvg.classList.add('channel-fav');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
      favSvg.appendChild(path);
      item.appendChild(favSvg);

      item.addEventListener('click', (e) => {
        if (e.target.closest('.channel-fav')) {
          toggleFavorite(ch);
          return;
        }
        playChannel(ch);
        if (window.innerWidth <= 900) {
          openPlayerView();
        }
      });

      frag.appendChild(item);
    });

    els.channelList.innerHTML = '';
    els.channelList.appendChild(frag);
  }

  function createPlaceholder(name) {
    const div = document.createElement('div');
    div.className = 'channel-logo-placeholder';
    const initials = name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
    div.textContent = initials.slice(0, 2);
    return div;
  }

  // ===== Playback =====
  function addToHistory(ch) {
    if (!ch?.url) return;
    const entry = {
      url: ch.url,
      name: ch.name || 'Canal',
      logo: ch.logo || '',
      group: ch.group || '',
      ts: Date.now(),
    };
    state.history = [entry, ...state.history.filter((h) => h.url !== ch.url)].slice(0, 40);
    saveJSON(STORAGE.history, state.history);
    updateBadges();
  }

  function playChannel(ch) {
    state.currentChannel = ch;
    const idx = state.channels.findIndex((c) => c.url === ch.url);
    state.currentIndex = idx;

    addToHistory(ch);

    els.currentTitle.textContent = ch.name;
    els.currentGroup.textContent = ch.group || '';
    els.infoTitle.textContent = ch.name;
    els.infoMeta.textContent = (ch.group || '') + (ch.tvgId ? ` · ${ch.tvgId}` : '');

    if (ch.logo) {
      els.currentLogo.src = ch.logo;
      els.currentLogo.hidden = false;
      els.currentLogo.onerror = () => { els.currentLogo.hidden = true; };
    } else {
      els.currentLogo.hidden = true;
    }

    els.nowPlaying.classList.add('visible');
    setTimeout(() => els.nowPlaying.classList.remove('visible'), 4000);

    els.favBtn.disabled = false;
    els.copyUrlBtn.disabled = false;
    if (els.pipBtn) {
      els.pipBtn.disabled = !(document.pictureInPictureEnabled && els.video);
    }
    updateFavBtn(ch);

    filterChannels();
    startPlayback(ch.url);
    updateEpgForChannel(ch);
  }

  // ===== EPG =====
  function parseXmltv(xmlText) {
    const map = new Map();
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      const programmes = doc.querySelectorAll('programme');
      programmes.forEach((p) => {
        const channel = p.getAttribute('channel') || '';
        const start = p.getAttribute('start') || '';
        const stop = p.getAttribute('stop') || '';
        const titleEl = p.querySelector('title');
        const title = titleEl ? titleEl.textContent.trim() : '';
        if (!channel || !start) return;
        if (!map.has(channel)) map.set(channel, []);
        map.get(channel).push({ start, stop, title });
      });
      map.forEach((arr) => arr.sort((a, b) => a.start.localeCompare(b.start)));
    } catch (e) {
      console.error('EPG parse error', e);
    }
    return map;
  }

  function xmltvTimeToDate(s) {
    // 20260101120000 +0000
    if (!s || s.length < 14) return null;
    const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
    const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
    return new Date(Date.UTC(y, mo, d, h, mi, se));
  }

  function updateEpgForChannel(ch) {
    if (!els.epgBar) return;
    if (!state.epgData || !ch?.tvgId) {
      els.epgBar.hidden = true;
      return;
    }
    const list = state.epgData.get(ch.tvgId) || state.epgData.get(ch.tvgId.toLowerCase());
    if (!list || !list.length) {
      els.epgBar.hidden = true;
      return;
    }
    const now = new Date();
    let current = null;
    let next = null;
    for (let i = 0; i < list.length; i++) {
      const start = xmltvTimeToDate(list[i].start);
      const stop = list[i].stop ? xmltvTimeToDate(list[i].stop) : null;
      if (!start) continue;
      if (start <= now && (!stop || stop > now)) {
        current = list[i];
        next = list[i + 1] || null;
        break;
      }
      if (start > now) {
        next = list[i];
        break;
      }
    }
    if (!current && !next) {
      els.epgBar.hidden = true;
      return;
    }
    els.epgNowTitle.textContent = current?.title || 'Sin información';
    els.epgNextTitle.textContent = next?.title || '—';
    els.epgBar.hidden = false;
  }

  async function loadEpg() {
    const urls = [];
    if (state.epgUrl) urls.push(state.epgUrl);
    state.playlistEpgUrls.forEach((u) => {
      if (!urls.includes(u)) urls.push(u);
    });
    if (!urls.length) {
      showToast('Configura una URL de EPG en Ajustes');
      return;
    }
    showToast('Cargando EPG…');
    // Only try first URL to avoid huge downloads
    const url = urls[0];
    try {
      const text = await fetchText(url);
      state.epgData = parseXmltv(text);
      const n = state.epgData.size;
      showToast(n ? `EPG listo (${n} canales)` : 'EPG vacío o no válido');
      if (state.currentChannel) updateEpgForChannel(state.currentChannel);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar el EPG (CORS o URL). Usa proxy o otra fuente.');
    }
  }

  function clearTrackSelects() {
    if (els.trackSelects) els.trackSelects.hidden = true;
    if (els.qualitySelect) els.qualitySelect.innerHTML = '';
    if (els.audioSelect) {
      els.audioSelect.innerHTML = '';
      els.audioSelect.hidden = true;
    }
  }

  function updateTrackSelects() {
    if (!state.hls || !els.qualitySelect) {
      clearTrackSelects();
      return;
    }
    const levels = state.hls.levels || [];
    if (levels.length > 1) {
      els.qualitySelect.innerHTML = '';
      const auto = document.createElement('option');
      auto.value = '-1';
      auto.textContent = 'Auto';
      els.qualitySelect.appendChild(auto);
      levels.forEach((lv, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        const h = lv.height || 0;
        const br = lv.bitrate ? Math.round(lv.bitrate / 1000) + 'k' : '';
        opt.textContent = h ? `${h}p${br ? ' · ' + br : ''}` : (br || `Nivel ${i + 1}`);
        els.qualitySelect.appendChild(opt);
      });
      els.qualitySelect.value = String(state.hls.currentLevel);
      if (els.trackSelects) els.trackSelects.hidden = false;
    } else {
      els.qualitySelect.innerHTML = '';
    }

    const audios = state.hls.audioTracks || [];
    if (audios.length > 1 && els.audioSelect) {
      els.audioSelect.innerHTML = '';
      audios.forEach((a, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = a.name || a.lang || `Audio ${i + 1}`;
        els.audioSelect.appendChild(opt);
      });
      els.audioSelect.value = String(state.hls.audioTrack);
      els.audioSelect.hidden = false;
      if (els.trackSelects) els.trackSelects.hidden = false;
    } else if (els.audioSelect) {
      els.audioSelect.hidden = true;
    }

    if (levels.length <= 1 && audios.length <= 1 && els.trackSelects) {
      els.trackSelects.hidden = true;
    }
  }

  function startPlayback(url) {
    hideError();
    showLoading(true);
    clearTrackSelects();

    if (state.hls) {
      try { state.hls.destroy(); } catch (_) {}
      state.hls = null;
    }
    els.video.pause();
    els.video.removeAttribute('src');
    els.video.load();

    const playUrl = state.corsProxy ? proxiedFetchUrl(url) : url;
    const isHls = /\.m3u8|m3u8|\/hls\/|playlist/i.test(url);

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      state.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr, reqUrl) => {
          xhr.withCredentials = false;
          if (state.corsProxy && reqUrl && !reqUrl.startsWith(state.corsProxy)) {
            try {
              xhr.open('GET', proxiedFetchUrl(reqUrl), true);
            } catch (_) {}
          }
        },
      });
      state.hls.loadSource(state.corsProxy ? playUrl : url);
      state.hls.attachMedia(els.video);

      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        showLoading(false);
        hideError();
        updateTrackSelects();
        els.video.play().catch(() => showLoading(false));
      });

      state.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          showLoading(false);
          let msg = 'No se pudo reproducir este canal';
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            msg = 'Error de red o CORS. Prueba activar un proxy en Ajustes.';
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            msg = 'Error de medios. Prueba otro canal.';
            try { state.hls.recoverMediaError(); return; } catch (_) {}
          }
          showError(msg);
          console.error('HLS fatal error', data);
        }
      });
    } else if (els.video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      els.video.src = playUrl;
      const onReady = () => { showLoading(false); hideError(); };
      const onErr = () => {
        showLoading(false);
        showError('No se pudo reproducir este canal (enlace caído, bloqueado o CORS)');
      };
      els.video.addEventListener('loadeddata', onReady, { once: true });
      els.video.addEventListener('playing', onReady, { once: true });
      els.video.addEventListener('error', onErr, { once: true });
      els.video.play().catch(() => showLoading(false));
    } else {
      showLoading(false);
      showError('Este navegador no soporta HLS. Usa Chrome, Firefox o Safari.');
    }
  }

  function showLoading(show) {
    if (els.loadingSpinner) {
      els.loadingSpinner.hidden = !show;
      els.loadingSpinner.style.display = show ? 'flex' : 'none';
    }
  }

  function showError(msg) {
    if (!els.errorMsg) return;
    els.errorText.textContent = msg || 'No se pudo reproducir este canal';
    els.errorMsg.hidden = false;
    els.errorMsg.style.display = 'flex';
    // Ensure loading is off
    showLoading(false);
  }

  function hideError() {
    if (!els.errorMsg) return;
    els.errorMsg.hidden = true;
    els.errorMsg.style.display = 'none';
  }

  // Global video events to keep UI in sync
  els.video.addEventListener('playing', () => {
    showLoading(false);
    hideError();
  });
  els.video.addEventListener('waiting', () => {
    // Only show spinner if we are not already in error state
    if (els.errorMsg.hidden) showLoading(true);
  });
  els.video.addEventListener('canplay', () => {
    showLoading(false);
  });

  els.retryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideError();
    if (state.currentChannel?.url) {
      startPlayback(state.currentChannel.url);
    }
  });

  // ===== Favorites =====
  function toggleFavorite(ch) {
    if (!ch?.url) return;
    const idx = state.favorites.findIndex((f) => f.url === ch.url);
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
      showToast('Eliminado de favoritos');
    } else {
      state.favorites.unshift({
        url: ch.url,
        name: ch.name || 'Canal',
        logo: ch.logo || '',
        group: ch.group || 'Favoritos',
      });
      showToast('Añadido a favoritos');
    }
    saveJSON(STORAGE.favs, state.favorites);
    updateFavBtn(ch);
    filterChannels();
  }

  function updateFavBtn(ch) {
    if (!ch) return;
    const isFav = isFavorite(ch.url);
    els.favBtn.classList.toggle('active', isFav);
    const svg = els.favBtn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
      svg.style.color = isFav ? '#f59e0b' : '';
    }
  }

  els.favBtn.addEventListener('click', () => {
    if (state.currentChannel) toggleFavorite(state.currentChannel);
  });

  els.copyUrlBtn.addEventListener('click', async () => {
    if (!state.currentChannel?.url) return;
    try {
      await navigator.clipboard.writeText(state.currentChannel.url);
      showToast('URL copiada al portapapeles');
    } catch {
      showToast('No se pudo copiar');
    }
  });

  // ===== Export favorites to M3U =====
  function exportFavoritesM3U() {
    if (!state.favorites.length) {
      showToast('No hay favoritos para exportar');
      return;
    }
    const lines = ['#EXTM3U'];
    state.favorites.forEach((f) => {
      const logo = f.logo ? ` tvg-logo="${f.logo.replace(/"/g, '')}"` : '';
      const group = f.group ? ` group-title="${(f.group || 'Favoritos').replace(/"/g, '')}"` : ' group-title="Favoritos"';
      const name = (f.name || 'Canal').replace(/,/g, ' ');
      lines.push(`#EXTINF:-1${logo}${group},${name}`);
      lines.push(f.url);
    });
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `streamplay-favoritos-${new Date().toISOString().slice(0, 10)}.m3u`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast(`Exportados ${state.favorites.length} favoritos`);
  }

  els.exportFavsBtn?.addEventListener('click', exportFavoritesM3U);

  // ===== Picture-in-Picture =====
  els.pipBtn?.addEventListener('click', async () => {
    try {
      if (!document.pictureInPictureEnabled) {
        showToast('Picture-in-Picture no está disponible en este navegador');
        return;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showToast('PiP cerrado');
      } else {
        if (els.video.readyState < 2) {
          showToast('Espera a que el vídeo esté listo');
          return;
        }
        await els.video.requestPictureInPicture();
        showToast('Picture-in-Picture activo');
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo activar PiP');
    }
  });

  // Hide PiP button if unsupported
  if (els.pipBtn && !document.pictureInPictureEnabled) {
    els.pipBtn.hidden = true;
  }

  // ===== Events =====
  els.loadUrlBtn.addEventListener('click', () => {
    const url = els.playlistUrl.value.trim();
    if (!url) {
      showToast('Introduce una URL de lista M3U');
      return;
    }
    loadPlaylist(url);
  });

  els.playlistUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.loadUrlBtn.click();
  });

  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadPlaylist(file, true);
    e.target.value = '';
  });

  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      els.playlistUrl.value = url;
      loadPlaylist(url);
    });
  });

  els.searchInput.addEventListener('input', () => {
    els.clearSearch.hidden = !els.searchInput.value;
    filterChannels();
  });

  els.clearSearch.addEventListener('click', () => {
    els.searchInput.value = '';
    els.clearSearch.hidden = true;
    filterChannels();
    els.searchInput.focus();
  });

  els.groupFilter.addEventListener('change', filterChannels);
  els.countryFilter?.addEventListener('change', filterChannels);
  els.langFilter?.addEventListener('change', filterChannels);

  els.qualitySelect?.addEventListener('change', () => {
    if (!state.hls) return;
    const v = parseInt(els.qualitySelect.value, 10);
    state.hls.currentLevel = v;
  });
  els.audioSelect?.addEventListener('change', () => {
    if (!state.hls) return;
    state.hls.audioTrack = parseInt(els.audioSelect.value, 10);
  });

  els.refreshPlaylistBtn?.addEventListener('click', () => {
    const url = (els.playlistUrl.value || state.lastPlaylistUrl || '').trim();
    if (!url) {
      showToast('No hay lista URL para actualizar');
      return;
    }
    loadPlaylist(url);
  });

  // Settings panel
  if (els.corsProxyInput) els.corsProxyInput.value = state.corsProxy;
  if (els.epgUrlInput) els.epgUrlInput.value = state.epgUrl;

  els.settingsBtn?.addEventListener('click', () => {
    if (!els.settingsPanel) return;
    els.settingsPanel.hidden = !els.settingsPanel.hidden;
  });

  els.saveSettingsBtn?.addEventListener('click', () => {
    state.corsProxy = (els.corsProxyInput?.value || '').trim();
    state.epgUrl = (els.epgUrlInput?.value || '').trim();
    localStorage.setItem(STORAGE.cors, state.corsProxy);
    localStorage.setItem(STORAGE.epg, state.epgUrl);
    showToast('Ajustes guardados');
    if (els.settingsPanel) els.settingsPanel.hidden = true;
  });

  els.loadEpgBtn?.addEventListener('click', () => {
    state.epgUrl = (els.epgUrlInput?.value || '').trim();
    localStorage.setItem(STORAGE.epg, state.epgUrl);
    loadEpg();
  });

  // Sidebar toggle (desktop/mobile)
  els.sidebarToggle.addEventListener('click', () => {
    els.sidebar.classList.toggle('open');
  });

  // Mobile nav
  function openPlayerView() {
    els.sidebar.classList.remove('open');
    $$('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.mobile-nav-btn[data-view="player"]').classList.add('active');
  }

  function openChannelsView() {
    els.sidebar.classList.add('open');
    $$('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.mobile-nav-btn[data-view="channels"]').classList.add('active');
  }

  $$('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'channels') openChannelsView();
      else openPlayerView();
    });
  });

  // Fullscreen
  els.fullscreenBtn.addEventListener('click', () => {
    const el = els.videoContainer;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      if (els.video.paused) els.video.play();
      else els.video.pause();
    }
    if (e.key === 'f') els.fullscreenBtn.click();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (state.filtered.length === 0) return;
      let next = state.filtered.findIndex((c) => c.url === state.currentChannel?.url);
      if (next < 0) next = 0;
      else next = e.key === 'ArrowDown' ? (next + 1) % state.filtered.length : (next - 1 + state.filtered.length) % state.filtered.length;
      playChannel(state.filtered[next]);
    }
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 900) return;
    if (els.sidebar.classList.contains('open') &&
        !els.sidebar.contains(e.target) &&
        !els.sidebarToggle.contains(e.target) &&
        !e.target.closest('.mobile-nav')) {
      openPlayerView();
    }
  });

  // ===== View tabs (Todos / Favoritos / Recientes) =====
  function setViewMode(mode, skipFilter) {
    state.viewMode = mode;
    els.tabAll?.classList.toggle('active', mode === 'all');
    els.tabFavorites?.classList.toggle('active', mode === 'favorites');
    els.tabHistory?.classList.toggle('active', mode === 'history');
    const onlyAll = mode === 'all';
    [els.groupFilter, els.countryFilter, els.langFilter].forEach((el) => {
      if (!el) return;
      el.disabled = !onlyAll;
      if (!onlyAll) el.value = '';
    });
    if (!skipFilter) filterChannels();
  }

  els.tabAll?.addEventListener('click', () => setViewMode('all'));
  els.tabFavorites?.addEventListener('click', () => setViewMode('favorites'));
  els.tabHistory?.addEventListener('click', () => setViewMode('history'));

  // ===== Saved playlists =====
  function renderSavedPlaylists() {
    if (!els.savedList) return;
    els.savedList.innerHTML = '';
    if (!state.playlists.length) {
      const empty = document.createElement('div');
      empty.className = 'saved-empty';
      empty.textContent = 'Ninguna lista guardada aún';
      els.savedList.appendChild(empty);
      return;
    }
    state.playlists.forEach((pl) => {
      const row = document.createElement('div');
      row.className = 'saved-item';
      row.title = pl.url;
      const name = document.createElement('span');
      name.className = 'saved-item-name';
      name.textContent = pl.name;
      const del = document.createElement('button');
      del.className = 'saved-item-del';
      del.type = 'button';
      del.title = 'Eliminar';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        state.playlists = state.playlists.filter((p) => p.id !== pl.id);
        saveJSON(STORAGE.playlists, state.playlists);
        renderSavedPlaylists();
        showToast('Lista eliminada');
      });
      row.appendChild(name);
      row.appendChild(del);
      row.addEventListener('click', () => {
        els.playlistUrl.value = pl.url;
        loadPlaylist(pl.url);
      });
      els.savedList.appendChild(row);
    });
  }

  els.savePlaylistBtn?.addEventListener('click', () => {
    const url = (els.playlistUrl.value || state.lastPlaylistUrl || '').trim();
    if (!url) {
      showToast('Carga o pega una URL de lista primero');
      return;
    }
    if (state.playlists.some((p) => p.url === url)) {
      showToast('Esta lista ya está guardada');
      return;
    }
    let name = prompt('Nombre para esta lista:', url.split('/').pop() || 'Mi lista');
    if (name === null) return;
    name = (name || '').trim() || 'Mi lista';
    state.playlists.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      url,
    });
    saveJSON(STORAGE.playlists, state.playlists);
    renderSavedPlaylists();
    showToast('Lista guardada');
  });

  els.clearHistoryBtn?.addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm('¿Borrar todo el historial de canales recientes?')) return;
    state.history = [];
    saveJSON(STORAGE.history, state.history);
    updateBadges();
    if (state.viewMode === 'history') filterChannels();
    showToast('Historial borrado');
  });

  // ===== PWA Install =====
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (els.installBtn) els.installBtn.hidden = false;
  });

  els.installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) {
      showToast('Abre el menú del navegador → “Instalar app” o “Añadir a pantalla de inicio”');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('¡App instalada!');
    deferredPrompt = null;
    if (els.installBtn) els.installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (els.installBtn) els.installBtn.hidden = true;
    showToast('StreamPlay instalada correctamente');
  });

  // Initial empty state — force clean UI
  els.emptyState.hidden = false;
  hideError();
  showLoading(false);
  updateBadges();
  renderSavedPlaylists();
})();
