# StreamPlay — Reproductor de listas M3U

Reproductor web profesional de listas M3U / IPTV. Responsive, tema claro/oscuro, **PWA instalable**.

## Características

- Carga por URL o archivo `.m3u` / `.m3u8`
- Listas recomendadas (Free-TV, Noticias, Deportes, Música, Español, English)
- **Mis listas**: guarda varias playlists con nombre y cárgalas al instante
- **Favoritos globales**: nombre, logo y URL persistentes entre listas
- **Historial (Recientes)**: últimos canales reproducidos
- Pestañas: Todos · Favoritos · Recientes
- Reproducción HLS (hls.js)
- Tema claro / oscuro
- Responsive móvil
- PWA instalable (manifest + service worker)
- Atajos: Espacio/K, F, ↑↓

## Uso rápido

1. Sirve la carpeta en `localhost` o HTTPS (necesario para PWA).
2. Carga una lista (recomendadas, URL o archivo).
3. Icono de guardar → nombra y guarda la lista en **Mis listas**.
4. Corazón → favoritos globales · pestaña **Recientes** → historial.

## Storage (localStorage)

| Clave | Contenido |
|-------|-----------|
| `sp_favs_v2` | Favoritos `[{url,name,logo,group}]` |
| `sp_history` | Historial (máx. 40) |
| `sp_playlists` | Listas guardadas `[{id,name,url}]` |
| `sp_theme` | `light` / `dark` |

---

HTML + CSS + JS puro.
