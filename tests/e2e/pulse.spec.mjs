import { test, expect } from '@playwright/test';

for (const route of ['/', '/galeria.html']) {
    test(`${route}: electric effect stays within its drawing work budget`, async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            hasTouch: false, isMobile: false, reducedMotion: 'no-preference',
        });
        try {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                window.pulseWork = { frames: 0, strokes: 0, gradients: 0 };
                for (const [method, key] of [['clearRect', 'frames'], ['stroke', 'strokes'], ['createRadialGradient', 'gradients']]) {
                    const original = CanvasRenderingContext2D.prototype[method];
                    CanvasRenderingContext2D.prototype[method] = function (...args) {
                        if (this.canvas.id === 'lightning-canvas') window.pulseWork[key]++;
                        return original.apply(this, args);
                    };
                }
            });
            await page.goto(`http://127.0.0.1:4173${route}`);
            await expect.poll(() => page.evaluate(() => window.pulseWork.frames)).toBeGreaterThan(0);
            const start = await page.evaluate(() => ({ ...window.pulseWork, time: performance.now() }));
            await page.waitForTimeout(2200);
            const end = await page.evaluate(() => ({ ...window.pulseWork, time: performance.now() }));
            const frames = end.frames - start.frames;
            expect(frames).toBeGreaterThan(0);
            expect((end.strokes - start.strokes) / frames).toBeLessThanOrEqual(8);
            expect(end.gradients - start.gradients).toBe(0);
            expect(frames / ((end.time - start.time) / 1000)).toBeLessThanOrEqual(31);
            expect(errors).toEqual([]);
        } finally { await context.close(); }
    });
}
