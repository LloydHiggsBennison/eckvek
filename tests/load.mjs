/** Bounded load against an isolated loopback server; never targets production. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let origin;
try {
    origin = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Preview startup timeout')), 10000);
        server.stdout.on('data', chunk => {
            const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
            if (match) { clearTimeout(timeout); resolve(match[0]); }
        });
        server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
        server.stderr.on('data', chunk => process.stderr.write(chunk));
    });
    const hash = body => createHash('sha256').update(body).digest('hex');
    const plans = [];
    for (const page of ['index.html', 'galeria.html']) {
        const html = await readFile(resolve(root, 'dist', page), 'utf8');
        const paths = new Set([`/${page}`]);
        for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
            if (/^(?:https?:|mailto:|tel:)/.test(match[1]) || match[1].includes('.html')) continue;
            paths.add('/' + match[1]);
        }
        for (const font of ['inter/inter-latin-wght-normal.woff2', 'fontawesome/webfonts/fa-solid-900.woff2', 'fontawesome/webfonts/fa-brands-400.woff2']) paths.add('/vendor/' + font);
        plans.push([...paths].map(path => ({ path })));
    }
    for (const plan of plans) for (const resource of plan) {
        const body = await readFile(resolve(root, 'dist', resource.path.slice(1)));
        resource.digest = hash(body);
        resource.size = body.length;
    }
    // Check server behavior before timing: no repository/tool exposure, correct errors and HEAD.
    for (const path of ['/.git/config', '/package.json', '/scripts/server.mjs', '/node_modules/package.json', '/does-not-exist']) {
        assert.equal((await fetch(origin + path)).status, 404, path);
    }
    assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
    const head = await fetch(origin, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(Number(head.headers.get('content-length')), (await stat(resolve(root, 'dist/index.html'))).size);
    assert.equal(head.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(head.headers.get('content-security-policy').includes("script-src 'self'"));

    const results = [];
    for (const concurrency of [10, 50, 100]) {
        const started = performance.now();
        const deadline = started + 10000;
        const latencies = [];
        const errors = [];
        let bytes = 0;
        let journeys = 0;
        await Promise.all(Array.from({ length: concurrency }, async (_, index) => {
            const resources = plans[index % plans.length];
            while (performance.now() < deadline) {
                for (const resource of resources) {
                    const requestStart = performance.now();
                    try {
                        const response = await fetch(origin + resource.path, { signal: AbortSignal.timeout(5000) });
                        const body = Buffer.from(await response.arrayBuffer());
                        assert.equal(response.status, 200);
                        assert.equal(body.length, resource.size);
                        assert.equal(hash(body), resource.digest, 'content corrupted under load');
                        bytes += body.length;
                    } catch (error) { errors.push(`${resource.path}: ${error.message}`); }
                    latencies.push(performance.now() - requestStart);
                }
                journeys++;
            }
        }));
        const elapsed = (performance.now() - started) / 1000;
        latencies.sort((a, b) => a - b);
        const percentile = p => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
        const result = {
            concurrency, durationSeconds: Number(elapsed.toFixed(2)), journeys,
            requests: latencies.length, errors: errors.length,
            requestsPerSecond: Number((latencies.length / elapsed).toFixed(1)),
            p95Ms: Number(percentile(0.95).toFixed(1)), p99Ms: Number(percentile(0.99).toFixed(1)),
            megabytes: Number((bytes / 1e6).toFixed(1)),
            passed: errors.length === 0 && percentile(0.95) < 1500 && percentile(0.99) < 3000,
            firstErrors: errors.slice(0, 3),
        };
        console.log(JSON.stringify(result));
        results.push(result);
    }
    await mkdir(resolve(root, 'reports'), { recursive: true });
    await writeFile(resolve(root, 'reports/load.json'), JSON.stringify({
        scope: 'Local loopback preview, uncompressed assets; not a production/CDN capacity guarantee',
        node: process.version, platform: process.platform, date: new Date().toISOString(),
        thresholds: { maxErrors: 0, p95Ms: 1500, p99Ms: 3000 }, results,
    }, null, 2));
    assert.ok(results.every(result => result.passed), 'Load thresholds failed; see reports/load.json');
} finally { server.kill(); }
