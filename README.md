# project_kasasagi

## Site structure

- `/`: artist homepage, latest album, all releases, profile, streaming services.
- `/releases/shunkashuto/`: the album **春夏秋冬**, its 12 tracks and direct album link.
- `/releases/{slug}/`: seven single detail pages with direct listening links and related releases.
- `/en/` and `/en/releases/{slug}/`: the corresponding English pages for the homepage and all releases.
- `scripts/templates/home.html` and `scripts/templates/album.html`: Japanese content and layout.
- `scripts/templates/home.en.html` and `scripts/templates/album.en.html`: English content and layout.
- `scripts/templates/single.html` and `scripts/templates/single.en.html`: shared single layouts.
- `scripts/translations-en.js`: English release descriptions, romanizations and title meanings.
- `css/site.css`: shared responsive styles. Navigation and content work without JavaScript.
- `css/motion.css`: scroll-linked hero photography and four seasonal light layers.
- `js/site.js`: one-time entry reveals and section-preserving language links.
- `scripts/site-config.js`: production origin and artist streaming links.
- `js/discography-data.js`: release metadata and track listings.

The HTML pages are generated and committed so Cloudflare Pages can continue serving
the repository as static files. Edit the templates or data, then regenerate:

```powershell
node scripts/render-static.js
python scripts/verify-site.py
node --test scripts/site.test.js
```

Preview from the repository root (opening the HTML as a file does not resolve the
site's absolute paths):

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/` or `http://127.0.0.1:4173/releases/shunkashuto/`.
The check covers internal links, static assets, metadata, structured data, release
and track preservation, and repeatable generation. Browser visual testing is separate.

## Languages and motion

All 18 routes are static HTML. Each has its own canonical URL, localized metadata,
and reciprocal `ja`, `en`, and `x-default` alternate links. The sitemap lists all 18.
The page language is English on `/en/`; the music remains Japanese in structured data.
Language links preserve the corresponding page, and JavaScript retains a valid
section fragment. There is no automatic language or location redirect.

Japanese titles are the official release names. Romanizations and English meanings
are reading aids. Add a corresponding translation when adding releases or tracks;
generation fails explicitly if an English translation is missing. Keep matching
section anchors in both language templates.

Scroll-linked effects use native CSS view timelines when supported. Hero photos
scale gently on desktop; the album background crossfades through spring, summer,
autumn, and winter. Other browsers retain the standard layout. Entry reveals use
IntersectionObserver and do not intercept scrolling. On mobile they use a smaller
movement and shorter transition; the hero zoom is disabled and seasonal light is
softer. Reduced-motion mode stops these effects, including when changed during a
visit. Content remains visible without JavaScript or if observer setup fails.

## Discography data

Every release in `js/discography-data.js` needs a unique, stable lowercase ASCII
`slug` (letters, numbers, and hyphens). Singles also need a direct `youtubeUrl`,
an existing artwork, description, release date, credit, and English translation.
New singles automatically receive Japanese and English detail routes.
Keep release dates at their confirmed precision: `2026.7` means July 2026,
not July 1. No day is invented in visible text or structured data.

The album's `tracks` entries may be title strings or objects with optional
`duration` and `url` properties. A Special Version's `singleSlug` explicitly
links to its original single, preserving title spelling differences such as
「僕ら」 and 「ぼくら」. This produces links in both directions without treating
the single recording as the album recording. Adding another album requires
its own album content/template; the generator rejects unsupported albums.

After editing the data, regenerate all crawlable pages, structured data and sitemap:

```powershell
node scripts/render-static.js
```

The production URL is `https://project-kasasagi.pages.dev/` (Cloudflare Pages).
When a custom domain is selected, update `siteUrl` in `scripts/site-config.js`
and regenerate. Metadata, canonical URLs, `robots.txt` and `sitemap.xml` will
use the same origin. Configure redirects from the former origin when deploying.

The confirmed YouTube Music album link is stored in `streamingUrl` and
`streamingLinks` on 春夏秋冬. Add only confirmed **album** URLs to `streamingLinks`.
Artist links remain explicitly labelled as artist pages on the homepage.
Singles prefer their existing direct `youtubeUrl` instead of the artist page.
Cards link to detail pages and retain a separate direct listening link for singles.
Detail routes cover 春夏秋冬 and these seven singles in both languages:

| Single | Slug |
| --- | --- |
| お家へ帰ろう | `ouchi-e-kaerou` |
| 花火の羽根 | `hanabi-no-hane` |
| サラリーマンへ | `salaryman-e` |
| 一瞬の永遠 | `isshun-no-eien` |
| 世界は鏡で僕らを映す | `sekai-wa-kagami-de-bokura-o-utsusu` |
| からっぽ | `karappo` |
| ネオンの涙 | `neon-no-namida` |

The release's supplied introduction is reused without inventing lyrics, production
history, exact release days, durations, or unconfirmed streaming destinations.
Each single has a stable MusicRecording entity shared by its two language pages;
the album's Special Versions retain separate track entities.
The site's existing social preview image is preserved. This implementation does not
add analytics, hosted audio files or an embedded player.

```js
{
  title: "Album title",
  slug: "album-title",
  releaseDate: "2026.08",
  type: "Album",
  artwork: "./assets/artworks/008.png",
  description: "Album description.",
  streamingUrl: "https://example.com/album",
  credit: "SUPICA KASASAGI / PROJECT KASASAGI / KURASOFTWARE",
  tracks: [
    { title: "First track", duration: "3:42", url: "https://example.com/track-1" },
    { title: "Second track", duration: "4:10" },
    "Interlude"
  ]
}
```
