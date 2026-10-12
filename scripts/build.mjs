import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
// The fixed output path is deliberately inside this checkout.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'galeria.html', '404.html', 'robots.txt', 'sitemap.xml', 'css', 'js', 'img']) {
    await cp(resolve(root, name), resolve(output, name), { recursive: true });
}
await mkdir(resolve(output, 'vendor/inter'), { recursive: true });
await cp(resolve(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'), resolve(output, 'vendor/inter/inter-latin-wght-normal.woff2'));
await cp(resolve(root, 'node_modules/@fontsource-variable/inter/LICENSE'), resolve(output, 'vendor/inter/LICENSE'));
for (const name of ['css', 'webfonts', 'LICENSE.txt']) {
    await cp(resolve(root, 'node_modules/@fortawesome/fontawesome-free', name), resolve(output, 'vendor/fontawesome', name), { recursive: true });
}
// Fail the build if a page references a missing local resource.
for (const page of ['index.html', 'galeria.html', '404.html']) {
    const html = await readFile(resolve(output, page), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (/^(?:https?:|mailto:|tel:|data:)/.test(match[1])) continue;
        const resource = match[1].split('#')[0].replace(/^\//, '') || 'index.html';
        await readFile(resolve(output, resource));
    }
}
console.log('Built dist/: pages, assets and licensed local fonts/icons.');
