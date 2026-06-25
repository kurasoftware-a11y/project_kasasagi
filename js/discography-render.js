document.addEventListener("DOMContentLoaded", () => {
  const discographyList = document.getElementById("discography-list");

  if (!discographyList) {
    console.error("discography-list が見つかりません。HTMLに id='discography-list' の要素があるか確認してください。");
    return;
  }

  if (typeof discography === "undefined") {
    console.error("discography が定義されていません。discography-data.js を discography-render.js より先に読み込んでください。");
    return;
  }

  if (!Array.isArray(discography)) {
    console.error("discography は配列で定義してください。");
    return;
  }

  discographyList.innerHTML = discography
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");

      const streamingLink = item.streamingUrl
        ? `<a href="${item.streamingUrl}" target="_blank" rel="noopener">Listen</a>`
        : `<span class="is-disabled">Coming Soon</span>`;

      const youtubeLink = item.youtubeUrl
        ? `<a href="${item.youtubeUrl}" target="_blank" rel="noopener">YouTube</a>`
        : "";

      return `
        <article class="work-card">
          <a
            class="work-art"
            href="${item.streamingUrl || "#"}"
            target="${item.streamingUrl ? "_blank" : "_self"}"
            rel="noopener"
            aria-label="${item.title}を聴く"
          >
            <img src="${item.artwork}" alt="${item.title}">
            <span class="work-number">${number}</span>
            <span class="work-glow"></span>
          </a>

          <div class="work-info">
            <p class="work-meta">${item.type} / ${item.releaseDate}</p>

            <h3>${item.title}</h3>

            <p class="work-description">
              ${item.description}
            </p>

            <p class="credit">
              ${item.credit}
            </p>

            <div class="work-links">
              ${streamingLink}
              ${youtubeLink}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
});