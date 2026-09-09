(() => {
  'use strict';

  // ===== State =====
  // ===== Storage helpers =====
  const STORAGE = {
    favs: 'sp_favs_v2',
    history: 'sp_history',
    playlists: 'sp_playlists',
    theme: 'sp_theme',
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
    fileInput: $('#fileInput'),
    searchInput: $('#searchInput'),
    clearSearch: $('#clearSearch'),
    groupFilter: $('#groupFilter'),
    channelCount: $('#channelCount'),
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
    copyUrlBtn: $('#copyUrlBtn'),
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
  function parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        current = {
          name: '',
          logo: '',
          group: 'Sin grupo',
          url: '',
          tvgId: '',
        };

        // Duration and attributes
        const attrMatch = line.match(/#EXTINF:(-?\d+)\s*(.*)/);
        if (attrMatch) {
          const attrs = attrMatch[2] || '';
          // tvg-logo
          const logoM = attrs.match(/tvg-logo="([^"]*)"/i);
          if (logoM) current.logo = logoM[1];
          // group-title
          const groupM = attrs.match(/group-title="([^"]*)"/i);
          if (groupM) current.group = groupM[1] || 'Sin grupo';
          // tvg-id
          const idM = attrs.match(/tvg-id="([^"]*)"/i);
          if (idM) current.tvgId = idM[1];
          // name after last comma
          const commaIdx = attrs.lastIndexOf(',');
          if (commaIdx !== -1) {
            current.name = attrs.slice(commaIdx + 1).trim();
          } else {
            current.name = attrs.replace(/tvg-[^=]+="[^"]*"\s*/gi, '').replace(/group-title="[^"]*"\s*/gi, '').trim() || 'Canal sin nombre';
          }
        }
      } else if (line.startsWith('#EXTGRP:')) {
        if (current) current.group = line.slice(8).trim() || current.group;
      } else if (line.startsWith('#')) {
        // ignore other tags
      } else if (current) {
        current.url = line;
        if (current.name) {
          channels.push(current);
        }
        current = null;
      }
    }
    return channels;
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
        const res = await fetch(source, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
        state.lastPlaylistUrl = source;
        if (els.playlistUrl) els.playlistUrl.value = source;
      }

      if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
        throw new Error('El archivo no parece ser una lista M3U válida');
      }

      state.channels = parseM3U(text);
      if (state.channels.length === 0) {
        throw new Error('No se encontraron canales en la lista');
      }

      state.viewMode = 'all';
      setViewMode('all', true);
      populateGroups();
      filterChannels();
      showToast(`Cargados ${state.channels.length} canales`);
      if (window.innerWidth <= 900) openChannelsView();
    } catch (err) {
      console.error(err);
      showToast('Error al cargar la lista: ' + (err.message || 'desconocido'));
      state.channels = [];
      filterChannels();
    } finally {
      showLoading(false);
    }
  }

  function populateGroups() {
    const groups = [...new Set(state.channels.map(c => c.group))].sort((a, b) => a.localeCompare(b));
    els.groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      els.groupFilter.appendChild(opt);
    });
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
  }

  function filterChannels() {
    const q = els.searchInput.value.trim().toLowerCase();
    const group = els.groupFilter.value;

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
      return matchQ && matchG;
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
    updateFavBtn(ch);

    filterChannels();
    startPlayback(ch.url);
  }

  function startPlayback(url) {
    // Always reset UI state first
    hideError();
    showLoading(true);

    // Cleanup previous instance completely
    if (state.hls) {
      try {
        state.hls.destroy();
      } catch (_) {}
      state.hls = null;
    }
    els.video.pause();
    els.video.removeAttribute('src');
    els.video.load();

    // Remove any leftover listeners by cloning? Not needed if we use once carefully.
    const isHls = /\.m3u8|m3u8|\/hls\/|playlist/i.test(url);

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      state.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr) => {
          // Help with some CORS cases
          xhr.withCredentials = false;
        }
      });
      state.hls.loadSource(url);
      state.hls.attachMedia(els.video);

      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        showLoading(false);
        hideError();
        els.video.play().catch(() => {
          // Autoplay blocked — user must tap play
          showLoading(false);
        });
      });

      state.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          showLoading(false);
          let msg = 'No se pudo reproducir este canal';
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            msg = 'Error de red o CORS. El stream puede estar bloqueado o caído.';
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            msg = 'Error de medios. Prueba otro canal.';
            try { state.hls.recoverMediaError(); return; } catch (_) {}
          }
          showError(msg);
          console.error('HLS fatal error', data);
        }
      });
    } else if (els.video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Native HLS (Safari) or progressive download
      els.video.src = url;

      const onReady = () => {
        showLoading(false);
        hideError();
      };
      const onErr = () => {
        showLoading(false);
        showError('No se pudo reproducir este canal (enlace caído o bloqueado)');
      };

      els.video.addEventListener('loadeddata', onReady, { once: true });
      els.video.addEventListener('playing', onReady, { once: true });
      els.video.addEventListener('error', onErr, { once: true });

      els.video.play().catch(() => {
        showLoading(false);
      });
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
    // Group filter only makes sense for "all"
    if (els.groupFilter) {
      els.groupFilter.disabled = mode !== 'all';
      if (mode !== 'all') els.groupFilter.value = '';
    }
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
