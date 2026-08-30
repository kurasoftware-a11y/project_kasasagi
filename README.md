# project_kasasagi

## Discography data

Add an album to `js/discography-data.js` as a normal discography item with a
`tracks` array. Each track may be a title string or an object with optional
`duration` and `url` properties.

After editing the data, regenerate the crawlable HTML and structured data:

```powershell
node scripts/render-static.js
```

The canonical URL is currently set to the repository's expected GitHub Pages
URL. When a custom domain is selected, update `SITE_URL` in
`scripts/render-static.js`, the metadata in `index.html`, `robots.txt`, and
`sitemap.xml` together.

```js
{
  title: "Album title",
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
