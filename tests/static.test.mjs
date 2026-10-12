import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const pages = ['index.html', 'galeria.html', '404.html'];
for (const page of pages) {
    test(`${page}: assets, links, anchors, unique IDs and image dimensions`, async () => {
        const html = await readFile(resolve(root, page), 'utf8');
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        assert.equal(ids.length, new Set(ids).size, 'duplicate IDs');
        assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
        assert.match(html, /<html lang="es">/);
        for (const match of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
            const reference = match[1];
            assert.ok(reference, 'empty src/href');
            if (/^(?:https?:|mailto:|tel:)/.test(reference)) continue;
            const [path, hash] = reference.split('#');
            const target = path ? path.replace(/^\//, '') || 'index.html' : page;
            const file = resolve(root, target);
            if (reference === '/') continue;
            assert.ok((await stat(file)).isFile(), `missing ${reference}`);
            if (hash) assert.ok((await readFile(file, 'utf8')).includes(`id="${hash}"`), `missing anchor ${reference}`);
        }
        for (const match of html.matchAll(/<img\b[^>]*src=[^>]*>/g)) {
            assert.match(match[0], /alt="[^"]+"/);
            assert.match(match[0], /width="\d+"/);
            assert.match(match[0], /height="\d+"/);
        }
        for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(match[0], /rel="noopener noreferrer"/);
        assert.doesNotMatch(html, /wa\.me\/\+/);
    });
}

test('SEO preview images and sitemap point to real pages and resources', async () => {
    const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
    const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
    for (const page of pages.slice(0, 2)) {
        const html = await readFile(resolve(root, page), 'utf8');
        const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
        assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
        const image = new URL(html.match(/property="og:image" content="([^"]+)"/)[1]);
        assert.ok((await stat(resolve(root, image.pathname.slice(1)))).isFile());
        assert.match(html, /name="description" content="[^"]+"/);
    }
    assert.match(robots, /Sitemap: https:\/\/eckvek\.vercel\.app\/sitemap.xml/);
});

test('stylesheet resources exist locally; scripts parse correctly', async () => {
    for (const name of ['css/shared.css', 'css/index.css', 'css/galeria.css', 'vendor/fontawesome/css/all.min.css']) {
        const css = await readFile(resolve(root, name), 'utf8');
        assert.doesNotMatch(css, /@import/);
        for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
            if (match[1].startsWith('data:')) continue;
            const resource = match[1].split(/[?#]/)[0];
            assert.ok((await stat(resolve(root, dirname(name), resource))).isFile(), `missing ${resource}`);
        }
    }
    for (const file of await readdir(resolve(root, 'js'))) new Script(await readFile(resolve(root, 'js', file), 'utf8'), { filename: file });
});

test('deploy output excludes tools, dependencies and private configuration', async () => {
    assert.deepEqual((await readdir(root)).sort(), ['404.html', 'css', 'galeria.html', 'img', 'index.html', 'js', 'robots.txt', 'sitemap.xml', 'vendor']);
    assert.ok((await stat(resolve(root, 'vendor/inter/LICENSE'))).isFile());
    assert.ok((await stat(resolve(root, 'vendor/fontawesome/LICENSE.txt'))).isFile());
});

test('page image transfer budgets stay below 1 MB each', async () => {
    for (const page of pages.slice(0, 2)) {
        const html = await readFile(resolve(root, page), 'utf8');
        const images = new Set([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]));
        const sizes = await Promise.all([...images].map(async image => (await stat(resolve(root, image))).size));
        assert.ok(sizes.reduce((sum, size) => sum + size, 0) < 1_000_000, `${page}: image budget exceeded`);
    }
});
