const fs = require("node:fs");
const path = require("node:path");
const { discography } = require("../js/discography-data.js");

const ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "index.html");
const SITE_URL = "https://kurasoftware-a11y.github.io/project_kasasagi/";
const ARTIST_ID = `${SITE_URL}#artist`;

const streamingLinks = [
  ["YouTube Music", "https://music.youtube.com/channel/UC92Hz8VSfMnLoW-1iq-6d2A"],
  ["Spotify", "https://open.spotify.com/artist/7L171VTCtymXjL0jFP9R0y"],
  ["Apple Music", "https://music.apple.com/us/artist/supica-kasasagi/6780665994"],
  ["Amazon Music", "https://music.amazon.co.jp/artists/B0H5HBNZ2N/supica-kasasagi"]
];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const toWebp = (artwork) => artwork.replace(/\.png$/i, ".webp");
const absoluteAssetUrl = (assetPath) => new URL(assetPath.replace(/^\.\//, ""), SITE_URL).href;

const normalizeReleaseDate = (releaseDate) => {
  const match = releaseDate.match(/^(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/);
  if (!match) return releaseDate;
  return [match[1], match[2].padStart(2, "0"), match[3]?.padStart(2, "0")]
    .filter(Boolean)
    .join("-");
};

const renderTrack = (track, index) => {
  const item = typeof track === "string" ? { title: track } : track;
  const number = String(index + 1).padStart(2, "0");
  const title = item.url
    ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
    : `<span>${escapeHtml(item.title)}</span>`;
  const duration = item.duration ? `<time>${escapeHtml(item.duration)}</time>` : "";

  return `              <li><span class="track-number">${number}</span>${title}${duration}</li>`;
};

const renderTrackList = (tracks) => {
  if (!Array.isArray(tracks) || tracks.length === 0) return "";

  return `
          <section class="track-list" aria-label="トラックリスト">
            <p class="track-list-title">Track list</p>
            <ol>
${tracks.map(renderTrack).join("\n")}
            </ol>
          </section>`;
};

const renderWorkCard = (item, index) => {
  const number = String(index + 1).padStart(2, "0");
  const tracks = renderTrackList(item.tracks);
  const artworkWebp = toWebp(item.artwork);
  const artworkWebpSmall = artworkWebp.replace(/\.webp$/i, "-640.webp");
  const links = [
    item.streamingUrl
      ? `<a href="${escapeHtml(item.streamingUrl)}" target="_blank" rel="noopener noreferrer">Listen</a>`
      : "",
    item.youtubeUrl
      ? `<a href="${escapeHtml(item.youtubeUrl)}" target="_blank" rel="noopener noreferrer">YouTube</a>`
      : ""
  ].filter(Boolean).join("\n            ");

  return `      <article class="work-card${tracks ? " work-card--album" : ""}" id="work-${number}">
        <a class="work-art" href="${escapeHtml(item.streamingUrl || "#discography")}" target="${item.streamingUrl ? "_blank" : "_self"}"${item.streamingUrl ? ' rel="noopener noreferrer"' : ""} aria-label="${escapeHtml(item.title)}を聴く">
          <picture>
            <source srcset="${escapeHtml(artworkWebpSmall)} 640w, ${escapeHtml(artworkWebp)} 1254w" sizes="(max-width: 980px) calc(100vw - 80px), min(420px, 35vw)" type="image/webp">
            <img src="${escapeHtml(item.artwork)}" alt="${escapeHtml(item.type === "Album" ? "アルバム" : "シングル")}『${escapeHtml(item.title)}』のジャケット" width="1254" height="1254" loading="lazy" decoding="async">
          </picture>
          <span class="work-number">${number}</span>
          <span class="work-glow"></span>
        </a>
        <div class="work-info">
          <p class="work-meta">${escapeHtml(item.type)} / <time datetime="${normalizeReleaseDate(item.releaseDate)}">${escapeHtml(item.releaseDate)}</time></p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="work-description">${escapeHtml(item.description)}</p>${tracks}
          <p class="credit">${escapeHtml(item.credit)}</p>
          <div class="work-links">
            ${links}
          </div>
        </div>
      </article>`;
};

const renderStreamingLinks = () => streamingLinks.map(([name, url]) =>
  `        <a href="${url}" target="_blank" rel="noopener noreferrer"><span>${name}</span><small>Open</small></a>`
).join("\n");

const renderStructuredData = () => {
  const releases = discography.map((item, index) => {
    const common = {
      "@id": `${SITE_URL}#release-${String(index + 1).padStart(2, "0")}`,
      name: item.title,
      inLanguage: "ja",
      datePublished: normalizeReleaseDate(item.releaseDate),
      byArtist: { "@id": ARTIST_ID },
      image: absoluteAssetUrl(toWebp(item.artwork)),
      url: `${SITE_URL}#work-${String(index + 1).padStart(2, "0")}`,
      description: item.description
    };

    if (item.type === "Album") {
      return {
        "@type": "MusicAlbum",
        ...common,
        albumProductionType: "https://schema.org/StudioAlbum",
        numTracks: item.tracks?.length || 0,
        track: (item.tracks || []).map((track, trackIndex) => ({
          "@type": "MusicRecording",
          position: trackIndex + 1,
          name: typeof track === "string" ? track : track.title,
          byArtist: { "@id": ARTIST_ID }
        }))
      };
    }

    return { "@type": "MusicRecording", ...common };
  });

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        url: SITE_URL,
        name: "SUPICA KASASAGI",
        alternateName: "PROJECT KASASAGI",
        inLanguage: "ja"
      },
      {
        "@type": "MusicGroup",
        "@id": ARTIST_ID,
        name: "SUPICA KASASAGI",
        url: SITE_URL,
        description: "アコースティックJ-Popを中心に、静かな感情と光の余韻を描く音楽プロジェクト。",
        genre: ["J-Pop", "Acoustic J-Pop"],
        sameAs: streamingLinks.map(([, url]) => url)
      },
      ...releases
    ]
  }, null, 2).replaceAll("</script>", "<\\/script>");
};

const replaceSection = (source, startMarker, endMarker, content) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing render markers: ${startMarker} / ${endMarker}`);
  }
  return `${source.slice(0, start + startMarker.length)}\n${content}\n${source.slice(end)}`;
};

let html = fs.readFileSync(INDEX_PATH, "utf8");
html = replaceSection(
  html,
  "<!-- STRUCTURED_DATA_START -->",
  "<!-- STRUCTURED_DATA_END -->",
  `  <script type="application/ld+json">\n${renderStructuredData()}\n  </script>`
);
html = replaceSection(
  html,
  "<!-- DISCOGRAPHY_START -->",
  "<!-- DISCOGRAPHY_END -->",
  discography.map(renderWorkCard).join("\n")
);
html = replaceSection(
  html,
  "<!-- STREAMING_LINKS_START -->",
  "<!-- STREAMING_LINKS_END -->",
  renderStreamingLinks()
);

fs.writeFileSync(INDEX_PATH, html, "utf8");
console.log(`Rendered ${discography.length} releases into index.html`);
