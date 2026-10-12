import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 2,
    timeout: 30000,
    reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
    use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: {
            ...devices['Desktop Firefox'],
            launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE
                ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE } : {},
        } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    ],
    webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 },
});
