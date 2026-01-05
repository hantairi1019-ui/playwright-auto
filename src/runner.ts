import { chromium, Browser, Page } from 'playwright';
import { AutomationConfig } from './config';
import { createComponent } from './factory';

export class Runner {
    private config: AutomationConfig;
    private browser: Browser | null = null;
    private page: Page | null = null;

    constructor(config: AutomationConfig) {
        this.config = config;
    }

    async run() {
        const headless = process.env.HEADLESS === 'true' || process.env.HEADLESS === '1';
        this.browser = await chromium.launch({ headless }); // headful by default, unless HEADLESS=true
        const context = await this.browser.newContext();
        this.page = await context.newPage();

        console.log(`Navigating to ${this.config.target_url}`);
        await this.page.goto(this.config.target_url, { waitUntil: 'domcontentloaded' });
        // wait for load state is sometimes flaky if network persists, so domcontentloaded is safer for init

        // Execute steps
        for (const step of this.config.steps) {
            const component = createComponent(step.type, this.page, step.selector);
            // Explicitly wait for the element to be ready
            console.log(`Waiting for selector: ${JSON.stringify(step.selector)}`);
            // We need to access the public locator getter, but it's protected in BaseComponent abstract class definition?
            // Actually it is protected. We should cast or make it public.
            // But wait, BaseComponent doesn't expose locator publicly.
            // Ideally execute() handles the wait. Playwright actions (fill, click) auto-wait.

            // If the user says it's not starting, maybe it waits for something else.
            // Let's rely on Playwright's auto-wait but add a debug log.
            // Also, we can add a general wait for load state if needed.

            // User requested "wait for screen load". 
            // If the ID is generated dynamically, auto-wait works.

            // Let's try adding a small visibility check/wait inside the component or here.
            // Best is to let the component action do it, but ensure we don't time out too fast.
            // The issue with "doesn't start" might be `networkidle` hanging forever in the previous code.
            // Changing to `domcontentloaded` above effectively fixes the hang.

            await component.execute(step.value, step.action);
            await this.page.waitForTimeout(500);
        }

        // Scraping
        if (this.config.scraping) {
            await this.scrape(this.config.scraping);
        }

        console.log('Automation finished.');
        // Keep open? Or close? Configurable. Closing for now.
        await this.browser.close();
    }

    private async scrape(scrapingConfig: NonNullable<AutomationConfig['scraping']>) {
        console.log('Starting scraping...');
        let hasNext = true;
        let pageCount = 1;
        const allData: any[] = [];

        while (hasNext) {
            console.log(`Scraping page ${pageCount}...`);

            // Wait for list to be present
            await this.page!.waitForSelector(scrapingConfig.list_selector, { timeout: 10000 });

            // Extract data
            const pageData = await this.page!.$$eval(
                scrapingConfig.list_selector,
                (elements, fields) => {
                    return elements.map(el => {
                        const row: Record<string, string> = {};
                        for (const [key, fieldDef] of Object.entries(fields)) {
                            let selector = '';
                            let attr = 'textContent';

                            if (typeof fieldDef === 'string') {
                                selector = fieldDef;
                            } else {
                                selector = fieldDef.selector;
                                attr = fieldDef.attribute || 'textContent';
                            }

                            const target = el.querySelector(selector);
                            if (target) {
                                if (attr === 'textContent') {
                                    row[key] = target.textContent?.trim() || '';
                                } else {
                                    row[key] = target.getAttribute(attr) || '';
                                }
                            } else {
                                row[key] = '';
                            }
                        }
                        return row;
                    });
                },
                scrapingConfig.fields
            );

            console.log(`Extracted ${pageData.length} items from page ${pageCount}`);
            allData.push(...pageData);

            // Pagination
            if (scrapingConfig.pagination?.next_button_selector) {
                const nextBtn = this.page!.locator(scrapingConfig.pagination.next_button_selector);
                // Check if visible and enabled
                if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
                    console.log('Clicking next page...');
                    await nextBtn.click();
                    await this.page!.waitForLoadState('networkidle');
                    await this.page!.waitForTimeout(1000); // stable wait
                    pageCount++;
                } else {
                    console.log('Next button not visible/enabled. Stopping.');
                    hasNext = false;
                }
            } else {
                hasNext = false;
            }
        }

        console.log('Scraping completed. Total items:', allData.length);
        console.log(JSON.stringify(allData, null, 2));

        if (scrapingConfig.output_file && allData.length > 0) {
            try {
                // Dynamic import or require to avoid issues if not installed yet during dev? 
                // We installed it (hopefully).
                const XLSX = require('xlsx');
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(allData);
                XLSX.utils.book_append_sheet(wb, ws, "ScrapedData");
                XLSX.writeFile(wb, scrapingConfig.output_file);
                console.log(`Data saved to ${scrapingConfig.output_file}`);
            } catch (error: any) {
                console.error('Failed to save Excel file:', error.message);
            }
        }

        // Cloud Integrations
        if (this.config.google_sheet || this.config.chatwork) {
            await this.processCloudIntegrations(allData);
        }
    }

    private async processCloudIntegrations(data: any[]) {
        require('dotenv').config();

        // 1. Google Sheets
        if (this.config.google_sheet) {
            try {
                console.log('Sending data to Google Sheets...');
                const { GoogleSpreadsheet } = require('google-spreadsheet');
                const { JWT } = require('google-auth-library');

                const serviceAccountAuth = new JWT({
                    email: require('../' + process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email,
                    key: require('../' + process.env.GOOGLE_SERVICE_ACCOUNT_JSON).private_key.replace(/\\n/g, '\n'),
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });

                const docId = this.config.google_sheet.spread_sheet_id || process.env.GOOGLE_SHEET_ID;
                if (!docId) throw new Error('Google Sheet ID not configured');

                const doc = new GoogleSpreadsheet(docId, serviceAccountAuth);
                await doc.loadInfo();

                // Determine sheet to write to
                let sheet;
                if (this.config.google_sheet.kpis_sheet_name) {
                    sheet = doc.sheetsByTitle[this.config.google_sheet.kpis_sheet_name];
                    if (!sheet) {
                        // If not found, try to create it or default to first
                        console.warn(`Sheet '${this.config.google_sheet.kpis_sheet_name}' not found. Using first sheet.`);
                        sheet = doc.sheetsByIndex[0];
                    }
                } else {
                    sheet = doc.sheetsByIndex[0];
                }

                if (data.length > 0) {
                    let headersLoaded = false;
                    try {
                        await sheet.loadHeaderRow();
                        headersLoaded = true;
                    } catch (e) {
                        // Likely no header row exists (empty sheet)
                        console.log('Could not load header row (sheet might be empty). Initializing headers...');
                    }

                    if (!headersLoaded || sheet.headerValues.length === 0) {
                        const headers = Object.keys(data[0]);
                        await sheet.setHeaderRow(headers);
                    }

                    await sheet.addRows(data);
                    console.log('Successfully wrote to Google Sheets.');
                }
            } catch (e: any) {
                console.error('Google Sheets Error:', e.message);
            }
        }

        // 2. Chatwork
        if (this.config.chatwork) {
            try {
                console.log('Sending Chatwork notification...');
                const axios = require('axios');
                const token = process.env.CHATWORK_API_TOKEN;
                const roomId = this.config.chatwork.room_id || process.env.CHATWORK_ROOM_ID;

                if (!token || !roomId) throw new Error('Chatwork credentials missing');

                const count = data.length;
                let body = this.config.chatwork.message_template || `Scraping Completed.\nTotal Items: ${count}`;
                // Simple template substitution
                body = body.replace('{count}', count.toString());

                await axios.post(
                    `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
                    new URLSearchParams({ body: body }),
                    { headers: { 'X-ChatWorkToken': token } }
                );
                console.log('Chatwork notification sent.');

            } catch (e: any) {
                console.error('Chatwork Error:', e.message);
            }
        }
    }
}
