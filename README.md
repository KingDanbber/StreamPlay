# StreamPlay — Reproductor de listas M3U

Reproductor web profesional, moderno e intuitivo para listas M3U / IPTV. **Instalable como PWA**.

## Características

- **Carga de listas**: por URL o archivo local (`.m3u` / `.m3u8`)
- **Listas recomendadas** preconfiguradas (Free-TV, Noticias, Deportes, Música, Español, English)
- **Reproducción HLS** con hls.js
- **Tema claro / oscuro** con persistencia
- **Totalmente responsive** (móvil, tablet y escritorio)
- **Búsqueda y filtro** por grupo
- **Favoritos** con pestaña dedicada y contador
- **PWA instalable** (Añadir a pantalla de inicio / Instalar app)
- **Atajos de teclado**: Espacio/K (play-pause), F (pantalla completa), ↑↓ (cambiar canal)

## Cómo usar

1. Sirve la carpeta con un servidor local (o abre `index.html`; la PWA y el SW necesitan HTTPS o localhost).
2. Carga una lista (URL, archivo o recomendada).
3. Marca canales con el corazón → pestaña **Favoritos**.
4. En Chrome/Edge/Android: botón de instalar en la barra, o menú → Instalar app.

> **Nota**: Algunos streams fallan por CORS o enlaces caídos. Free-TV e iptv-org suelen ser más estables.

## Listas recomendadas

| Nombre   | URL |
|----------|-----|
| Free-TV  | https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8 |
| Noticias | https://iptv-org.github.io/iptv/categories/news.m3u |
| Deportes | https://iptv-org.github.io/iptv/categories/sports.m3u |
| Música   | https://iptv-org.github.io/iptv/categories/music.m3u |
| Español  | https://iptv-org.github.io/iptv/languages/spa.m3u |
| English  | https://iptv-org.github.io/iptv/languages/eng.m3u |

## Archivos

- `index.html`, `styles.css`, `app.js` — app
- `manifest.json`, `sw.js` — PWA
- `icon-*.png`, `favicon-32.png`, `apple-touch-icon.png` — iconos

## Requisitos

- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Para PWA: servir por `http://localhost` o HTTPS

---

HTML, CSS y JavaScript puro. Sin frameworks.
