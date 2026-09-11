const fs = require('node:fs');
const path = require('node:path');
const { discography } = require('../js/discography-data.js');
const { siteUrl: SITE_URL, artist: ARTIST, artistJapanese, streamingLinks } = require('./site-config.js');
const english = require('./translations-en.js');

const ROOT = path.resolve(__dirname, '..');
const ALBUM = discography.find(item => item.slug === 'shunkashuto');
if (!ALBUM || !ALBUM.tracks?.length) throw new Error('春夏秋冬 and its track list are required.');
const ALBUM_PATH = `/releases/${ALBUM.slug}/`;
const ARTIST_ID = `${SITE_URL}#artist`;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const absolute = value => new URL(value, SITE_URL).href;
const rootAsset = value => '/' + value.replace(/^\.?\//, '');
const isoDate = date => date.split('.').map((part, index) => index ? part.padStart(2, '0') : part).join('-');
const trackObject = track => typeof track === 'string' ? { title: track } : track;
const routeFor = (item, lang = 'ja') => `${lang === 'en' ? '/en' : ''}${item ? `/releases/${item.slug}/` : '/'}`;
const releasePath = routeFor;
const entityId = item => `${absolute(releasePath(item))}#${item.type === 'Album' ? 'album' : 'recording'}`;
const SINGLES = discography.filter(item => item.type === 'Single');
const slugs = new Set();
for (const item of discography) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug || '') || slugs.has(item.slug)) throw new Error(`Missing, invalid or duplicate release slug: ${item.title}`);
  slugs.add(item.slug);
  if (item.type !== 'Single' && item !== ALBUM) throw new Error(`Add an album template before publishing: ${item.title}`);
  if (item.type === 'Single' && !item.youtubeUrl) throw new Error(`Missing direct single link: ${item.title}`);
}
for (const raw of ALBUM.tracks) {
  const track = trackObject(raw);
  if (track.singleSlug && (!SINGLES.some(item => item.slug === track.singleSlug) || !track.title.endsWith(' (Special Version)'))) throw new Error(`Invalid Special Version relationship: ${track.title}`);
}
const releaseText = (item, lang) => {
  if (lang === 'en' && !english.releases[item.title]) throw new Error(`Missing English release: ${item.title}`);
  return lang === 'en' ? english.releases[item.title] : { description: item.description };
};
const displayDate = (date, lang) => lang === 'en'
  ? new Intl.DateTimeFormat('en-US', { month: 'long', ...(date.split('.').length === 3 ? { day: 'numeric' } : {}), year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate(date)}${date.split('.').length === 2 ? '-01' : ''}T00:00:00Z`))
  : date;
const japaneseDate = date => date.split('.').map((part, index) => `${Number(part)}${['年', '月', '日'][index]}`).join('');

function safeUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`Expected HTTPS link: ${value}`);
  return esc(parsed.href);
}

function artwork(item, { eager = false, sizes = '(max-width: 700px) 44vw, 29vw', lang = 'ja' } = {}) {
  const png = rootAsset(item.artwork);
  const webp = png.replace(/\.png$/i, '.webp');
  const small = webp.replace(/\.webp$/i, '-640.webp');
  const available = [small, webp].filter(file => fs.existsSync(path.join(ROOT, file.slice(1))));
  const srcset = available.map(file => `${file} ${file === small ? 640 : 1254}w`).join(', ');
  const alt = lang === 'en' ? `${item.type} artwork for ${releaseText(item, lang).reading} (${item.title})` : `${item.type === 'Album' ? 'アルバム' : 'シングル'}『${item.title}』のジャケット`;
  return `<picture>${srcset ? `<source type="image/webp" srcset="${esc(srcset)}" sizes="${esc(sizes)}">` : ''}<img src="${esc(png)}" alt="${esc(alt)}" width="1254" height="1254" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

function releaseCard(item, { related = false, lang = 'ja' } = {}) {
  const album = item.type === 'Album';
  const translation = releaseText(item, lang);
  const destination = releasePath(item, lang);
  const label = lang === 'en' ? (album ? 'Explore the album' : 'Explore the single') : '作品詳細';
  const imageLabel = lang === 'en' ? 'Explore' : '作品詳細';
  const id = `work-${String(discography.indexOf(item) + 1).padStart(2, '0')}`;
  // The featured album already owns the legacy #work-01 anchor on the homepage.
  return `<article class="release-card"${!album || related ? ` id="${id}"` : ''}>
    <a class="release-image" href="${destination}" aria-label="${esc(item.title)} — ${label}">${artwork(item, { lang })}<span class="image-action">${imageLabel} <span aria-hidden="true">→</span></span></a>
    <p class="release-meta"><span>${esc(item.type)}</span><time datetime="${isoDate(item.releaseDate)}">${esc(displayDate(item.releaseDate, lang))}</time></p>
    <h3 lang="ja"><a href="${destination}">${esc(item.title)}</a></h3>
    ${lang === 'en' ? `<p class="release-reading">${esc(translation.reading)}<span>${esc(translation.meaning)}</span></p>` : ''}
    <p class="release-description">${esc(translation.description)}</p>
    <div class="release-card-actions"><a class="text-link" href="${destination}">${label}<span aria-hidden="true">→</span></a>
    ${album ? '' : `<a class="text-link" href="${safeUrl(item.youtubeUrl)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Listen on YouTube Music' : 'YouTube Musicで聴く'}<span aria-hidden="true">↗</span></a>`}</div>
  </article>`;
}

function linksMarkup(links, caption) {
  return links.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(link.name)}</span><small>${esc(caption)}</small></a>`).join('\n');
}

function releaseSchema(item, detailed = false, lang = 'ja') {
  const entity = {
    '@type': item.type === 'Album' ? 'MusicAlbum' : 'MusicRecording',
    '@id': entityId(item),
    name: item.title, inLanguage: 'ja', datePublished: isoDate(item.releaseDate),
    byArtist: { '@id': ARTIST_ID }, image: absolute(rootAsset(item.artwork.replace(/\.png$/i, '.webp'))),
    url: absolute(releasePath(item, lang)), description: releaseText(item, lang).description
  };
  if (item.type === 'Album') {
    entity.albumProductionType = 'https://schema.org/StudioAlbum';
    entity.numTracks = item.tracks.length;
    if (detailed) entity.track = {
      '@type': 'ItemList', numberOfItems: item.tracks.length,
      itemListElement: item.tracks.map((raw, index) => ({
        '@type': 'ListItem', position: index + 1,
        item: { '@type': 'MusicRecording', '@id': `${absolute(ALBUM_PATH)}#track-${index + 1}`,
          name: trackObject(raw).title, byArtist: { '@id': ARTIST_ID }, inAlbum: { '@id': `${absolute(ALBUM_PATH)}#album` } }
      }))
    };
  } else entity.sameAs = [item.youtubeUrl];
  return entity;
}

function structuredData(detail, title, description, lang) {
  const pageUrl = absolute(routeFor(detail, lang));
  const graph = [
    { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: ARTIST, inLanguage: ['ja', 'en'] },
    { '@type': 'MusicGroup', '@id': ARTIST_ID, name: ARTIST, alternateName: artistJapanese, url: SITE_URL,
      description: lang === 'en' ? 'An acoustic J-Pop music project where sound and words linger.' : 'アコースティックJ-Popを軸に、音と言葉の余韻を描く音楽プロジェクト。', genre: ['J-Pop', 'Acoustic J-Pop'], sameAs: streamingLinks.map(link => link.url) },
    { '@type': 'WebPage', '@id': `${pageUrl}#webpage`, url: pageUrl, name: title, description, inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}#website` }, about: { '@id': ARTIST_ID },
      ...(detail ? { mainEntity: { '@id': entityId(detail) }, breadcrumb: { '@id': `${pageUrl}#breadcrumb` } } : {}) }
  ];
  if (detail) graph.push(releaseSchema(detail, true, lang), {
    '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumb`, itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'ホーム', item: absolute(routeFor(false, lang)) },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Music' : '作品', item: `${absolute(routeFor(false, lang))}#discography` },
      { '@type': 'ListItem', position: 3, name: lang === 'en' ? releaseText(detail, lang).reading : detail.title, item: pageUrl }
    ]
  });
  else graph.push(...discography.map(item => releaseSchema(item, false, lang)));
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replaceAll('<', '\\u003c');
}

function head(detail, lang) {
  const single = detail?.type === 'Single';
  const title = single
    ? (lang === 'en' ? `${releaseText(detail, lang).reading} (${detail.title}) — Single & Streaming | SUPICA KASASAGI` : `${detail.title}｜シングル・作品紹介・配信情報｜SUPICA KASASAGI`)
    : lang === 'en'
    ? (detail ? 'Shunkashuto (春夏秋冬) — Album & Tracklist | SUPICA KASASAGI' : 'SUPICA KASASAGI — Official Website | Acoustic J-Pop')
    : (detail ? '春夏秋冬｜アルバム・収録曲・配信情報｜SUPICA KASASAGI' : 'SUPICA KASASAGI 公式サイト｜楽曲・アルバム');
  const description = single
    ? (lang === 'en' ? `${releaseText(detail, lang).reading} (${detail.title}), a single by SUPICA KASASAGI, released ${displayDate(detail.releaseDate, lang)}. ${releaseText(detail, lang).description} Credits and a direct YouTube Music link.` : `SUPICA KASASAGI（スピカ カササギ）のシングル『${detail.title}』。${japaneseDate(detail.releaseDate)}リリース。${detail.description} 作品情報とYouTube Musicの楽曲配信リンクを掲載。`)
    : lang === 'en'
    ? (detail ? `Explore Shunkashuto (春夏秋冬), the ${ALBUM.tracks.length}-track album by SUPICA KASASAGI, released July 24, 2026. Tracklist, English reading guides, credits, and a direct YouTube Music link.` : 'The official website of SUPICA KASASAGI. Discover acoustic J-Pop, explore Shunkashuto and other releases, and listen on YouTube Music, Spotify, Apple Music, and Amazon Music.')
    : detail
    ? `SUPICA KASASAGI（スピカ カササギ）のアルバム『春夏秋冬』。2026年7月24日発売、全${ALBUM.tracks.length}曲。収録曲、作品紹介、クレジット、YouTube Musicのアルバム配信リンクを掲載。`
    : 'SUPICA KASASAGI（スピカ カササギ）の公式サイト。音と言葉の余韻を描くアコースティックJ-Pop。アルバム『春夏秋冬』、楽曲・収録曲の紹介とYouTube Music、Spotifyなどの配信情報をお届けします。';
  const url = absolute(routeFor(detail, lang));
  const socialImage = detail ? '' : `
  <meta property="og:image" content="${absolute('/assets/og-supica-kasasagi.png')}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${lang === 'en' ? 'SUPICA KASASAGI official website' : 'SUPICA KASASAGI 公式サイト'}">
  <meta name="twitter:image" content="${absolute('/assets/og-supica-kasasagi.png')}">
  <meta name="twitter:image:alt" content="${lang === 'en' ? 'SUPICA KASASAGI official website' : 'SUPICA KASASAGI 公式サイト'}">`;
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="SUPICA KASASAGI / PROJECT KASASAGI / KURASOFTWARE">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#080d15"><meta name="color-scheme" content="dark light">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="ja" href="${absolute(routeFor(detail, 'ja'))}">
  <link rel="alternate" hreflang="en" href="${absolute(routeFor(detail, 'en'))}">
  <link rel="alternate" hreflang="x-default" href="${absolute(routeFor(detail, 'ja'))}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  ${detail ? '' : '<link rel="preload" as="image" href="/assets/supica-portrait.webp" type="image/webp" fetchpriority="high">'}
  <meta property="og:type" content="website"><meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}">
  <meta property="og:locale:alternate" content="${lang === 'en' ? 'ja_JP' : 'en_US'}">
  <meta property="og:site_name" content="SUPICA KASASAGI"><meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
  <meta name="twitter:card" content="${detail ? 'summary' : 'summary_large_image'}">
  <meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${socialImage}
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400&amp;family=Inter:wght@400&amp;family=Noto+Serif+JP:wght@300&amp;family=Noto+Sans+JP:wght@400&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/motion.css">
  <script src="/js/site.js" defer></script>
  <script type="application/ld+json">${structuredData(detail, title, description, lang)}</script>`;
}

function header(detail, lang) {
  const home = routeFor(false, lang);
  const en = lang === 'en';
  const languages = ['ja', 'en'].map(code => `<a href="${routeFor(detail, code)}" lang="${code}" hreflang="${code}" data-language-link${code === lang ? ' aria-current="page"' : ''}>${code === 'ja' ? '日本語' : 'English'}</a>`).join('<span aria-hidden="true">/</span>');
  return `<a class="skip-link" href="#main">${en ? 'Skip to content' : '本文へ進む'}</a>
<header class="site-header"><a href="${home}" class="brand" aria-label="SUPICA KASASAGI ${en ? 'home' : 'ホーム'}">SUPICA <span>KASASAGI</span></a>
  <div class="header-actions"><nav class="nav" aria-label="${en ? 'Main navigation' : 'メインナビゲーション'}"><a href="${home}#discography">${en ? 'Music' : '作品'}</a><a href="${home}#concept">${en ? 'About' : 'SUPICAについて'}</a><a href="#listen">${en ? 'Listen' : '音楽を聴く'} <span aria-hidden="true">↗</span></a></nav>
  <nav class="language-switch" aria-label="${en ? 'Language' : '表示言語'}">${languages}</nav></div>
</header>`;
}

function footer(lang) {
  const home = routeFor(false, lang);
  return `<footer class="footer"><div><a class="footer-brand" href="${home}">SUPICA KASASAGI</a><p>${lang === 'en' ? 'Music that stays. A little light.' : '音は、寄り添い。光を灯す。'}</p></div>
  <nav class="footer-nav" aria-label="${lang === 'en' ? 'Footer navigation' : 'フッターナビゲーション'}"><a href="${home}#discography">${lang === 'en' ? 'Music' : '作品'}</a><a href="${home}#concept">${lang === 'en' ? 'About' : 'SUPICAについて'}</a></nav>
  <div class="footer-bottom"><p>PROJECT KASASAGI / KURASOFTWARE</p><p>© SUPICA KASASAGI / PROJECT KASASAGI / KURASOFTWARE</p></div></footer>`;
}

function tracks(lang) {
  return ALBUM.tracks.map((raw, index) => {
    const track = trackObject(raw);
    const match = track.title.match(/^(.*) \((Special Version)\)$/);
    const base = match ? match[1] : track.title;
    const label = `<span lang="ja">${esc(base)}</span>${match ? `<span class="track-version" lang="en">(${esc(match[2])})</span>` : ''}`;
    if (lang === 'en' && !english.tracks[base]) throw new Error(`Missing English track: ${base}`);
    const reading = lang === 'en' ? `<span class="track-reading">${english.tracks[base].map(esc).join(' · ')}</span>` : '';
    const single = SINGLES.find(item => item.slug === track.singleSlug);
    const original = single ? `<a class="track-single-link" href="${releasePath(single, lang)}">${lang === 'en' ? 'Explore the original single' : 'シングル版の作品詳細'} <span aria-hidden="true">→</span></a>` : '';
    return `<li id="track-${index + 1}"><span class="track-title">${track.url ? `<a href="${safeUrl(track.url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}${reading}${original}</span>${track.duration ? `<span class="track-duration">${esc(track.duration)}</span>` : ''}</li>`;
  }).join('\n');
}

function albumConnection(single, lang) {
  const index = ALBUM.tracks.findIndex(raw => trackObject(raw).singleSlug === single.slug);
  if (index < 0) return '';
  const en = lang === 'en';
  const track = trackObject(ALBUM.tracks[index]);
  return `<aside class="single-album" aria-labelledby="version-title">
    <a class="single-album-art" href="${releasePath(ALBUM, lang)}" aria-label="${en ? 'Explore Shunkashuto' : 'アルバム『春夏秋冬』の作品詳細'}">${artwork(ALBUM, { sizes: '160px', lang })}</a>
    <div><p class="section-kicker">ANOTHER VERSION</p>
      <h2 id="version-title">${en ? 'On Shunkashuto' : '『春夏秋冬』では。'}</h2>
      <p>${en ? 'A Special Version of this song appears on the album Shunkashuto.' : 'この曲のSpecial Versionは、アルバム『春夏秋冬』に収録されています。'}</p>
      <p class="single-version-title"><span lang="en">TRACK ${String(index + 1).padStart(2, '0')}</span><br><span lang="ja">${esc(track.title)}</span></p>
      <a class="text-link" href="${releasePath(ALBUM, lang)}#track-${index + 1}">${en ? 'View the album tracklist' : 'アルバムの収録曲を見る'}<span aria-hidden="true">→</span></a>
    </div>
  </aside>`;
}

function relatedReleases(item) {
  if (item?.type !== 'Single') return SINGLES.slice(0, 3);
  const index = SINGLES.indexOf(item);
  return Array.from({ length: Math.min(3, SINGLES.length - 1) }, (_, offset) => SINGLES[(index + offset + 1) % SINGLES.length]);
}

function writeChanged(relative, contents) {
  const target = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) fs.writeFileSync(target, contents, 'utf8');
}

const routes = [];
for (const lang of ['ja', 'en']) for (const detail of [null, ...discography]) {
  const single = detail?.type === 'Single';
  const values = {
    HEAD: head(detail, lang), HEADER: header(detail, lang), FOOTER: footer(lang), ALBUM_TITLE: esc(ALBUM.title), ALBUM_PATH: routeFor(ALBUM, lang),
    ALBUM_ART: artwork(ALBUM, { eager: detail === ALBUM, sizes: '(max-width: 700px) calc(100vw - 44px), 44vw', lang }),
    ALBUM_DATE_ISO: isoDate(ALBUM.releaseDate), ALBUM_DATE: esc(displayDate(ALBUM.releaseDate, lang)),
    ALBUM_DATE_JA: ALBUM.releaseDate.replace(/^(\d+)\.(\d+)\.(\d+)$/, '$1年$2月$3日'),
    TRACK_COUNT: ALBUM.tracks.length, ALBUM_STREAM_URL: safeUrl(ALBUM.streamingUrl),
    ALBUM_LINKS: linksMarkup(ALBUM.streamingLinks, lang === 'en' ? 'Listen to the album Shunkashuto' : `アルバム『${ALBUM.title}』を聴く`),
    ARTIST_LINKS: linksMarkup(streamingLinks, lang === 'en' ? 'Artist page' : 'アーティストページ'),
    RELEASES: discography.map(item => releaseCard(item, { lang })).join('\n'), TRACKS: tracks(lang),
    RELATED_RELEASES: relatedReleases(detail).map(item => releaseCard(item, { related: true, lang })).join('\n'),
    ...(single ? {
      SINGLE_TITLE: esc(detail.title), SINGLE_READING: esc(english.releases[detail.title].reading), SINGLE_MEANING: esc(english.releases[detail.title].meaning),
      SINGLE_ART: artwork(detail, { eager: true, sizes: '(max-width: 700px) calc(100vw - 44px), 44vw', lang }),
      SINGLE_DATE_ISO: isoDate(detail.releaseDate), SINGLE_DATE: esc(lang === 'en' ? displayDate(detail.releaseDate, lang) : japaneseDate(detail.releaseDate)),
      SINGLE_DESCRIPTION: esc(releaseText(detail, lang).description), SINGLE_CREDIT: esc(detail.credit),
      SINGLE_STREAM_URL: safeUrl(detail.youtubeUrl), ALBUM_CONNECTION: albumConnection(detail, lang)
    } : {})
  };
  const template = fs.readFileSync(path.join(__dirname, 'templates', `${single ? 'single' : detail ? 'album' : 'home'}${lang === 'en' ? '.en' : ''}.html`), 'utf8');
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown template value: ${key}`);
    return values[key];
  }).replace(/[ \t]+$/gm, '');
  writeChanged(`${routeFor(detail, lang).slice(1)}index.html`, html);
  routes.push(routeFor(detail, lang));
}

writeChanged('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => {
  const modified = fs.statSync(path.join(ROOT, route.slice(1), 'index.html')).mtime.toISOString();
  return `  <url><loc>${esc(absolute(route))}</loc><lastmod>${modified}</lastmod></url>`;
}).join('\n')}\n</urlset>\n`);
writeChanged('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap.xml')}\n`);
console.log(`Generated ${routes.length} Japanese/English pages and sitemap (${discography.length} releases, ${ALBUM.tracks.length} album tracks).`);
