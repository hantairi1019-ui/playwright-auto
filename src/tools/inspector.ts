import { chromium } from 'playwright';
import * as yaml from 'js-yaml';

async function generateSkeleton(url: string) {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Analyze interactive elements
        const elements = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, select, button, textarea'));
            return inputs.map((el) => {
                const tag = el.tagName.toLowerCase();
                let type = 'unknown';
                let selector = '';

                // Generate a best-effort selector
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.getAttribute('name')) {
                    selector = `[name="${el.getAttribute('name')}"]`;
                } else if (el.className) {
                    // Take first class for simplicity, but ID/name is preferred
                    selector = `.${el.className.split(' ')[0]}`;
                } else {
                    selector = tag; // Fallback
                }

                // Determine type mapping
                if (tag === 'button' || (tag === 'input' && ['submit', 'button'].includes((el as HTMLInputElement).type))) {
                    type = 'button';
                } else if (tag === 'input' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) {
                    type = 'radio'; // or check
                } else if (tag === 'select') {
                    type = 'select';
                } else if (tag === 'textarea' || (tag === 'input' && ['text', 'password', 'email', 'number'].includes((el as HTMLInputElement).type))) {
                    type = 'text_box';
                }

                return {
                    type,
                    selector,
                    tag,
                    inputType: (el as HTMLInputElement).type || null,
                    placeholder: (el as HTMLInputElement).placeholder || null,
                    name: (el as HTMLInputElement).name || null,
                    id: el.id || null
                };
            });
        });

        // Filter relevant elements and build YAML structure
        const steps = elements
            .filter(e => e.type !== 'unknown')
            .map(e => {
                const step: any = {
                    type: e.type,
                    selector: e.selector,
                };
                if (e.type === 'text_box') step.value = 'TODO: Input value';
                if (e.type === 'button') step.action = 'click';
                if (e.type === 'select') step.value = 'TODO: Option value';
                return step;
            });

        const config = {
            target_url: url,
            steps: steps
        };

        const yamlStr = yaml.dump(config);
        console.log('\n--- Generated YAML Skeleton ---\n');
        console.log(yamlStr);
        console.log('-------------------------------\n');

    } catch (error) {
        console.error('Error generating skeleton:', error);
    } finally {
        await browser.close();
    }
}

const targetUrl = process.argv[2];
if (!targetUrl) {
    console.error('Usage: npx tsx src/tools/inspector.ts <url>');
    process.exit(1);
}

generateSkeleton(targetUrl);
