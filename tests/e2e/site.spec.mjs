import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of ['/', '/galeria.html']) {
    for (const scenario of ['phone portrait', 'phone landscape', 'initial reduced motion']) {
        test(`${route}: ${scenario} never initializes the electric canvas`, async ({ browser, browserName }) => {
            const phone = scenario.startsWith('phone');
            const context = await browser.newContext({
                viewport: scenario === 'phone portrait' ? { width: 390, height: 844 }
                    : scenario === 'phone landscape' ? { width: 932, height: 430 } : { width: 1280, height: 800 },
                hasTouch: phone,
                isMobile: phone && browserName !== 'firefox',
                reducedMotion: phone ? 'no-preference' : 'reduce',
            });
            try {
                const page = await context.newPage();
                await page.addInitScript(() => {
                    window.electricMetrics = { contexts: 0, frames: 0, observers: 0 };
                    const originalContext = HTMLCanvasElement.prototype.getContext;
                    HTMLCanvasElement.prototype.getContext = function (...args) {
                        if (this.id === 'lightning-canvas') window.electricMetrics.contexts++;
                        return originalContext.apply(this, args);
                    };
                    const originalFrame = window.requestAnimationFrame;
                    window.requestAnimationFrame = callback => {
                        window.electricMetrics.frames++;
                        return originalFrame.call(window, callback);
                    };
                    const OriginalObserver = window.ResizeObserver;
                    window.ResizeObserver = class extends OriginalObserver {
                        constructor(callback) { super(callback); window.electricMetrics.observers++; }
                    };
                });
                await page.goto(`http://127.0.0.1:4173${route}`);
                await expect(page.locator('canvas')).toBeHidden();
                if (phone) {
                    await page.setViewportSize(scenario === 'phone portrait'
                        ? { width: 932, height: 430 } : { width: 390, height: 844 });
                }
                // Observe an idle interval after loading and rotating: no work is scheduled.
                await page.waitForTimeout(250);
                expect(await page.evaluate(() => window.electricMetrics)).toEqual({ contexts: 0, frames: 0, observers: 0 });
                await expect(page.locator('canvas')).toHaveJSProperty('width', 0);
                await expect(page.locator('canvas')).toHaveJSProperty('height', 0);
                await expect(page.locator('h1')).toBeVisible();
            } finally { await context.close(); }
        });
    }
}

for (const route of ['/', '/galeria.html']) {
    test.describe(route, () => {
        test('loads all images and resources without errors or external dependencies', async ({ page }) => {
            const errors = [];
            const requests = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            page.on('requestfailed', request => errors.push(request.url()));
            page.on('request', request => requests.push(request.url()));
            page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
            await page.goto(route);
            await expect(page.locator('h1')).toHaveCount(1);
            for (const image of await page.locator('img[src]').all()) {
                await image.scrollIntoViewIfNeeded();
                await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
            }
            await page.evaluate(() => document.fonts.ready);
            expect(errors).toEqual([]);
            expect(requests.filter(url => !url.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
            expect(await page.evaluate(() => document.fonts.check('400 16px Inter'))).toBe(true);
        });

        test('mobile menu maintains ARIA, focus, closes outside and resets on resize', async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(route);
            const button = page.locator('#hamburger');
            const nav = page.locator('#primary-nav');
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await expect(nav).toHaveJSProperty('inert', true);
            await button.click();
            await expect(button).toHaveAttribute('aria-expanded', 'true');
            await expect(nav).toHaveJSProperty('inert', false);
            await nav.locator('a').first().focus();
            await page.keyboard.press('Escape');
            await expect(button).toBeFocused();
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await button.click();
            await page.mouse.click(20, 400);
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await button.click();
            await page.setViewportSize({ width: 1280, height: 800 });
            await expect(nav).toHaveJSProperty('inert', false);
            await expect(button).toHaveAttribute('aria-expanded', 'false');
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(nav).toHaveJSProperty('inert', true);
            await button.click();
            const destination = route === '/' ? '#section-contact' : 'index.html#section-contact';
            await nav.locator(`a[href="${destination}"]`).click();
            await expect(page).toHaveURL(/#section-contact$/);
            await expect(button).toHaveAttribute('aria-expanded', 'false');
        });

        test('image viewer works with keyboard, traps focus, restores scrolling and focus', async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(route);
            const trigger = page.locator('.image-trigger').first();
            await trigger.focus();
            await page.keyboard.press('Enter');
            const dialog = page.getByRole('dialog');
            const close = page.getByRole('button', { name: 'Cerrar', exact: true });
            await expect(dialog).toBeVisible();
            await expect(close).toBeFocused();
            await expect(page.locator('#lightbox-img')).toHaveAttribute('src', await trigger.evaluate(link => link.href));
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            expect(await page.evaluate(() => document.activeElement.closest('dialog') !== null)).toBe(true);
            await page.locator('#lightbox-img').click();
            await expect(dialog).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(dialog).not.toBeVisible();
            await expect(trigger).toBeFocused();
            await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
            await trigger.click();
            await close.click();
            await expect(trigger).toBeFocused();
            await trigger.click();
            await dialog.click({ position: { x: 5, y: 5 } });
            await expect(dialog).not.toBeVisible();
        });

        test('meets automated WCAG 2.2 AA checks on page and image viewer', async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(route);
            await page.evaluate(() => document.fonts.ready);
            const audit = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            expect((await audit()).violations).toEqual([]);
            await page.locator('.image-trigger').first().click();
            expect((await audit()).violations).toEqual([]);
        });

        test('works without JavaScript, including mobile links and photo fallback', async ({ browser }) => {
            const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
            const page = await context.newPage();
            try {
                await page.goto(`http://127.0.0.1:4173${route}`);
                await expect(page.locator('#primary-nav a').first()).toBeVisible();
                await expect(page.locator('#hamburger')).not.toBeVisible();
                expect(await page.locator('.work-card, .gallery-card, .service-card, .cert-card, .about-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).opacity === '1'))).toBe(true);
                const trigger = page.locator('.image-trigger').first();
                const href = await trigger.getAttribute('href');
                await trigger.click();
                await expect(page).toHaveURL(new RegExp(href.replaceAll('.', '\\.')));
            } finally { await context.close(); }
        });

        test('content survives missing IntersectionObserver', async ({ page }) => {
            await page.addInitScript(() => { window.IntersectionObserver = undefined; });
            await page.goto(route);
            await expect(page.locator('.reveal-pending')).toHaveCount(0);
            expect(await page.locator('.work-card, .gallery-card, .service-card, .cert-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).opacity === '1'))).toBe(true);
        });

        test('fits narrow, tablet and desktop widths', async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(route);
            for (const width of [320, 390, 768, 820, 1024, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                await expect.poll(() => page.locator('#primary-nav').evaluate(nav => nav.inert)).toBe(width <= 768);
                const overflow = await page.locator('.hero-content, .hero-logo, .service-card, .about-card, .work-card, .gallery-card, .cert-card, #primary-nav a, .contact-item').evaluateAll(elements => elements.filter(el => {
                    if (el.closest('[inert]')) return false;
                    const box = el.getBoundingClientRect();
                    return box.width && (box.left < -1 || box.right > window.innerWidth + 1);
                }).map(el => el.className || el.textContent));
                expect(overflow, `overflow at ${width}px`).toEqual([]);
            }
        });

        test('skip link moves focus to content', async ({ page }) => {
            await page.goto(route);
            // Safari may skip links with its default system keyboard-navigation preference.
            await page.locator('.skip-link').focus();
            await expect(page.locator('.skip-link')).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(page.locator('main')).toBeFocused();
        });
    });
}

test('canvas respects reduced motion, mobile, viewport and missing context', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    try {
        await page.addInitScript(() => {
            window.drawCount = 0;
            const original = CanvasRenderingContext2D.prototype.clearRect;
            CanvasRenderingContext2D.prototype.clearRect = function (...args) { window.drawCount++; return original.apply(this, args); };
        });
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('http://127.0.0.1:4173/');
        await expect.poll(() => page.evaluate(() => window.drawCount)).toBeGreaterThan(0);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator('canvas')).toBeHidden();
        const before = await page.evaluate(() => window.drawCount);
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => window.drawCount)).toBe(before);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect.poll(() => page.evaluate(() => window.drawCount)).toBeGreaterThan(before);
        await page.locator('footer').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const offscreen = await page.evaluate(() => window.drawCount);
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => window.drawCount)).toBe(offscreen);
        await expect(page.locator('canvas')).toHaveJSProperty('width', 0);
        await page.locator('.hero, .gallery-hero').scrollIntoViewIfNeeded();
        await expect.poll(() => page.evaluate(() => window.drawCount)).toBeGreaterThan(offscreen);
        // Exercise the document visibility lifecycle without relying on headless tab focus.
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.testHidden === true });
            window.testHidden = true;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await expect(page.locator('canvas')).toHaveJSProperty('width', 0);
        const background = await page.evaluate(() => window.drawCount);
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => window.drawCount)).toBe(background);
        await page.evaluate(() => {
            window.testHidden = false;
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await expect.poll(() => page.evaluate(() => window.drawCount)).toBeGreaterThan(background);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('canvas')).toBeHidden();
        await expect(page.locator('canvas')).toHaveJSProperty('width', 0);
        await expect(page.locator('canvas')).toHaveJSProperty('height', 0);
    } finally { await context.close(); }
});

test('missing canvas context does not break navigation', async ({ page }) => {
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('canvas')).toBeHidden();
    await page.locator('.image-trigger').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(errors).toEqual([]);
});

test('404 page offers working recovery navigation', async ({ page }) => {
    const response = await page.goto('/missing/nested-page');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
});
