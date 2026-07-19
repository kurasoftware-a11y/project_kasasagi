document.addEventListener("DOMContentLoaded", () => {
  const discographyList = document.getElementById("discography-list");
  const streamingContainer = document.getElementById("streaming-links");

  if (!discographyList || !streamingContainer || !Array.isArray(discography)) {
    console.error("Unable to load discography content.");
    return;
  }

  const renderTrack = (track, index) => {
    const item = typeof track === "string" ? { title: track } : track;
    const number = String(index + 1).padStart(2, "0");
    const title = item.url
      ? `<a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>`
      : `<span>${item.title}</span>`;
    const duration = item.duration ? `<time>${item.duration}</time>` : "";

    return `<li><span class="track-number">${number}</span>${title}${duration}</li>`;
  };

  const renderTrackList = (tracks) => {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return "";
    }

    return `
      <section class="track-list" aria-label="Track list">
        <p class="track-list-title">Track list</p>
        <ol>${tracks.map(renderTrack).join("")}</ol>
      </section>
    `;
  };

  discographyList.innerHTML = discography.map((item, index) => {
    const number = String(index + 1).padStart(2, "0");
    const tracks = renderTrackList(item.tracks);
    const links = [
      item.streamingUrl
        ? `<a href="${item.streamingUrl}" target="_blank" rel="noopener">Listen</a>`
        : "",
      item.youtubeUrl
        ? `<a href="${item.youtubeUrl}" target="_blank" rel="noopener">YouTube</a>`
        : ""
    ].join("");

    return `
      <article class="work-card${tracks ? " work-card--album" : ""}">
        <a class="work-art" href="${item.streamingUrl || "#"}" target="${item.streamingUrl ? "_blank" : "_self"}" rel="noopener" aria-label="${item.title} - Listen">
          <img src="${item.artwork}" alt="${item.title}" loading="lazy">
          <span class="work-number">${number}</span>
          <span class="work-glow"></span>
        </a>
        <div class="work-info">
          <p class="work-meta">${item.type} / ${item.releaseDate}</p>
          <h3>${item.title}</h3>
          <p class="work-description">${item.description}</p>
          ${tracks}
          <p class="credit">${item.credit}</p>
          <div class="work-links">${links}</div>
        </div>
      </article>
    `;
  }).join("");

  const streamingLinks = [
    ["YouTube Music", "https://music.youtube.com/channel/UC92Hz8VSfMnLoW-1iq-6d2A"],
    ["Spotify", "https://open.spotify.com/intl-ja/artist/7L171VTCtymXjL0jFP9R0y?si=HktooHL3T6GmoRBkdG75Pg"],
    ["Apple Music", "https://music.apple.com/us/artist/supica-kasasagi/6780665994"],
    ["Amazon Music", "https://music.amazon.co.jp/artists/B0H5HBNZ2N/supica-kasasagi?marketplaceId=A1VC38T7YXB528&musicTerritory=JP&ref=dm_sh_BUI30nfJxCUxiFoMTJ53X91Oi"]
  ];

  streamingContainer.innerHTML = streamingLinks.map(([name, url]) => `
    <a href="${url}" target="_blank" rel="noopener"><span>${name}</span><small>Open</small></a>
  `).join("");
});
