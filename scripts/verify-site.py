"""Check generated routes, local links/assets and structured metadata without a browser."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
data = json.loads(subprocess.check_output(
    ["node", "-e", "process.stdout.write(JSON.stringify(require('./js/discography-data.js').discography))"],
    cwd=ROOT, text=True, encoding="utf-8"
))
ROUTES = {route: ROOT / route.lstrip('/') / 'index.html'
          for prefix in ('', '/en')
          for route in [f'{prefix}/', *[f"{prefix}/releases/{item['slug']}/" for item in data]]}


class Page(HTMLParser):
    def __init__(self, filename):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.assets = []
        self.h1 = 0
        self.canonical = []
        self.lang = None
        self.alternates = {}
        self.language_links = {}
        self.descriptions = []
        self.titles = []
        self.in_title = False
        self.meta = {}
        self.visible_text = []
        self.in_body = False
        self.json_blocks = []
        self.in_json = False
        self.text = filename.read_text(encoding="utf-8")
        self.feed(self.text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate id: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'body':
            self.in_body = True
        if tag == "html":
            self.lang = attrs.get('lang')
        if tag == "a":
            self.links.append(attrs.get("href", ""))
            if 'data-language-link' in attrs:
                self.language_links[attrs['hreflang']] = attrs['href']
            if attrs.get("target") == "_blank":
                assert "noopener" in attrs.get("rel", "")
        if tag == "img":
            assert attrs.get("alt"), "Missing descriptive image alt"
            assert attrs.get("width") and attrs.get("height"), "Missing reserved image size"
        if "src" in attrs:
            self.assets.append(attrs["src"])
        if tag == "source" and "srcset" in attrs:
            self.assets.extend(item.strip().split()[0] for item in attrs["srcset"].split(","))
        if tag == "link":
            if attrs.get("rel") == "canonical":
                self.canonical.append(attrs["href"])
            elif attrs.get('rel') == 'alternate' and 'hreflang' in attrs:
                assert attrs['hreflang'] not in self.alternates
                self.alternates[attrs['hreflang']] = attrs['href']
            elif attrs.get("rel") in ("stylesheet", "icon", "apple-touch-icon", "preload"):
                self.assets.append(attrs["href"])
        if tag == "meta" and attrs.get("name") == "description":
            self.descriptions.append(attrs["content"])
        if tag == 'meta' and ('property' in attrs or 'name' in attrs):
            self.meta[attrs.get('property') or attrs['name']] = attrs.get('content')
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json = False
        if tag == 'title':
            self.in_title = False
        if tag == 'body':
            self.in_body = False

    def handle_data(self, data):
        if self.in_json:
            self.json_blocks.append(json.loads(data))
        if self.in_title:
            self.titles.append(data)
        if self.in_body:
            self.visible_text.append(data)


pages = {route: Page(filename) for route, filename in ROUTES.items()}
for route, page in pages.items():
    language = 'en' if route.startswith('/en/') else 'ja'
    counterpart = route.removeprefix('/en') if language == 'en' else '/en' + route
    assert page.lang == language
    assert page.ids == pages[counterpart].ids, 'Language counterparts must retain section anchors'
    japanese = route.removeprefix('/en') if language == 'en' else route
    expected_alternates = {
        'ja': f'https://project-kasasagi.pages.dev{japanese}',
        'en': f'https://project-kasasagi.pages.dev/en{japanese}',
        'x-default': f'https://project-kasasagi.pages.dev{japanese}'
    }
    assert page.alternates == expected_alternates == pages[counterpart].alternates
    assert page.language_links == {'ja': japanese, 'en': '/en' + japanese}
    assert page.h1 == 1, f"{route}: expected one H1"
    assert len(page.canonical) == 1 and page.canonical[0] == f"https://project-kasasagi.pages.dev{route}"
    assert len(page.descriptions) == 1 and page.descriptions[0]
    assert len(page.titles) == 1 and page.titles[0]
    assert page.meta['og:title'] == page.meta['twitter:title'] == page.titles[0]
    assert page.meta['og:description'] == page.meta['twitter:description'] == page.descriptions[0]
    assert page.meta['og:url'] == page.canonical[0]
    assert len(page.json_blocks) == 1
    webpage = next(node for node in page.json_blocks[0]['@graph'] if node['@type'] == 'WebPage')
    assert webpage['inLanguage'] == language
    assert webpage['url'] == page.canonical[0]
    assert '<script src="/js/site.js" defer>' in page.text
    assert "{{" not in page.text, "Unresolved template token"
    for asset in page.assets:
        url = urlsplit(asset)
        if not url.scheme:
            assert (ROOT / unquote(url.path).lstrip("/")).is_file(), f"Missing asset: {asset}"
    for href in page.links:
        assert href, f"{route}: empty link"
        url = urlsplit(href)
        if url.scheme:
            assert url.scheme == "https", f"Unexpected external protocol: {href}"
            continue
        destination = url.path or route
        assert destination in pages, f"Missing local route: {href}"
        if url.fragment:
            assert url.fragment in pages[destination].ids, f"Missing anchor: {href} on {route}"

album = next(item for item in data if item.get("slug") == "shunkashuto")
for detail_route in ['/releases/shunkashuto/', '/en/releases/shunkashuto/']:
    album_page = pages[detail_route]
    entity = next(item for item in album_page.json_blocks[0]["@graph"] if item["@type"] == "MusicAlbum")
    assert entity['inLanguage'] == 'ja', 'The music remains Japanese in the English edition'
    assert entity["numTracks"] == len(album["tracks"]) == 12
    assert len(entity["track"]["itemListElement"]) == 12
    for index, track in enumerate(album["tracks"], start=1):
        title = track if isinstance(track, str) else track["title"]
        assert entity["track"]["itemListElement"][index - 1]["item"]["name"] == title
        assert f"track-{index}" in album_page.ids
        assert title.replace(" (Special Version)", "") in album_page.text
        if isinstance(track, dict) and track.get('singleSlug'):
            prefix = '/en' if detail_route.startswith('/en/') else ''
            assert f"{prefix}/releases/{track['singleSlug']}/" in album_page.links
    assert album_page.text.count('class="season-light ') == 4
    assert album['streamingUrl'] in album_page.links
for home_route in ['/', '/en/']:
    for item in data:
        assert item["title"] in pages[home_route].text, f"Lost work: {item['title']}"
        if item.get("youtubeUrl"):
            assert item["youtubeUrl"] in pages[home_route].links, f"Lost direct song link: {item['title']}"
        assert f"{home_route}releases/{item['slug']}/" in pages[home_route].links
    assert album['streamingUrl'] in pages[home_route].links

singles = [item for item in data if item['type'] == 'Single']
assert len(singles) == 7
for item in singles:
    recording_id = f"https://project-kasasagi.pages.dev/releases/{item['slug']}/#recording"
    matching_tracks = [(index, track) for index, track in enumerate(album['tracks'], start=1)
                       if isinstance(track, dict) and track.get('singleSlug') == item['slug']]
    for prefix in ('', '/en'):
        route = f"{prefix}/releases/{item['slug']}/"
        page = pages[route]
        visible = ''.join(page.visible_text)
        graph = page.json_blocks[0]['@graph']
        entity = next(node for node in graph if node['@type'] == 'MusicRecording')
        webpage = next(node for node in graph if node['@type'] == 'WebPage')
        breadcrumb = next(node for node in graph if node['@type'] == 'BreadcrumbList')
        assert entity['@id'] == recording_id == webpage['mainEntity']['@id']
        assert entity['name'] == item['title']
        assert entity['url'] == page.canonical[0]
        assert entity['inLanguage'] == 'ja'
        assert entity['description'] in visible, 'Metadata must describe visible content'
        assert entity['datePublished'] == '-'.join(part if index == 0 else part.zfill(2)
                                                  for index, part in enumerate(item['releaseDate'].split('.')))
        assert entity['sameAs'] == [item['youtubeUrl']]
        assert 'inAlbum' not in entity, 'The original single must not be identified as the album Special Version'
        assert not any(node['@type'] == 'MusicAlbum' for node in graph)
        assert item['title'] in visible and item['credit'] in visible
        assert item['youtubeUrl'] in page.links
        assert page.text.count('class="release-card"') == 3
        assert route not in [link for link in page.links if link not in page.language_links.values()]
        assert breadcrumb['itemListElement'][-1]['item'] == page.canonical[0]
        assert all(urlsplit(crumb['item']).path in pages for crumb in breadcrumb['itemListElement'])
        assert ('version-title' in page.ids) == bool(matching_tracks)
        for index, track in matching_tracks:
            assert f"{prefix}/releases/shunkashuto/#track-{index}" in page.links
            assert track['title'] in visible
        for home in ('/', '/en/'):
            home_entity = next(node for node in pages[home].json_blocks[0]['@graph'] if node.get('@id') == recording_id)
            assert home_entity['@type'] == 'MusicRecording'
assert len(pages["/"].ids.intersection({f"work-{i:02d}" for i in range(1, 9)})) == 8

sitemap = ElementTree.parse(ROOT / "sitemap.xml")
namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
locations = {node.text for node in sitemap.findall("s:url/s:loc", namespace)}
assert locations == {page.canonical[0] for page in pages.values()}
assert len(pages) == 18
assert len({page.descriptions[0] for page in pages.values()}) == len(pages)
assert len({page.titles[0] for page in pages.values()}) == len(pages)
assert pages['/en/'].text.count('class="release-reading"') == 8
assert pages['/en/releases/shunkashuto/'].text.count('class="track-reading"') == 12
for source in [ROOT / file for file in ('scripts/render-static.js', 'scripts/site-config.js', 'scripts/translations-en.js', 'js/discography-data.js', 'js/site.js')]:
    subprocess.run(["node", "--check", str(source)], check=True, capture_output=True)

# Rendering twice must not alter HTML, sitemap timestamps or robots.txt.
generated = [*ROUTES.values(), ROOT / "sitemap.xml", ROOT / "robots.txt"]
before = {file: (file.read_bytes(), file.stat().st_mtime_ns) for file in generated}
subprocess.run(["node", "scripts/render-static.js"], cwd=ROOT, check=True, capture_output=True)
assert before == {file: (file.read_bytes(), file.stat().st_mtime_ns) for file in generated}
print("PASS: 18 localized routes; 7 singles; reciprocal language links/hreflang; local assets; direct streaming; distinct single/album versions; 12 tracks; unique metadata; canonical/sitemap; JS syntax; stable regeneration.")
