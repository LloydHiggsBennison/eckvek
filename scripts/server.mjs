/** Local preview/test server. Production is served by the hosting CDN. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const security = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (request, response) => {
    for (const [key, value] of Object.entries(security)) response.setHeader(key, value);
    if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const segments = pathname.split('/');
        if (pathname.includes('\\') || segments.some(part => part.startsWith('.')) || pathname.includes('\0')) {
            response.writeHead(404); response.end(); return;
        }
        const file = resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
        if (!file.startsWith(resolve(root) + sep)) { response.writeHead(404); response.end(); return; }
        const info = await stat(file);
        if (!info.isFile()) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, {
            'Content-Type': types[extname(file)] || 'application/octet-stream',
            'Content-Length': info.size,
            // Unversioned assets must revalidate after a deployment.
            'Cache-Control': 'public, max-age=0, must-revalidate',
        });
        if (request.method === 'HEAD') response.end();
        else await pipeline(createReadStream(file), response);
    } catch (error) {
        if (response.headersSent) { response.destroy(); return; }
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) {
            const body = await readFile(resolve(root, '404.html'));
            response.writeHead(404, { 'Content-Type': types['.html'] });
            response.end(request.method === 'HEAD' ? undefined : body);
        } else { response.writeHead(400); response.end(); }
    }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
    console.log(`Local preview: http://127.0.0.1:${server.address().port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()));
