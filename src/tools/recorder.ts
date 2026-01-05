import { chromium } from 'playwright';
import * as yaml from 'js-yaml';

// Define action type
type ActionStep = {
    type: string;
    selector: string;
    value?: string;
    action?: string;
};

async function startRecorder(urlStr: string) {
    // Ensure URL has protocol
    let url = urlStr;
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const recordedSteps: ActionStep[] = [];

    // Expose function to be called from browser
    await page.exposeFunction('recordAction', (action: ActionStep) => {
        console.log('Recorded:', action);
        recordedSteps.push(action);
    });

    // Pipe browser logs to node console
    page.on('console', msg => {
        const text = msg.text();
        // Filter out irrelevant logs if needed, but for debugging keep all
        if (text.startsWith('[Recorder]')) {
            console.log(text);
        }
    });

    // Inject recording script
    await page.addInitScript(() => {
        function getSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            if (el.getAttribute('name')) return `[name="${el.getAttribute('name')}"]`;

            // Safety check for SVG or other elements where className is not a string
            if (el.className && typeof el.className === 'string') {
                const cls = el.className.split(' ')[0];
                if (cls) return `.${cls}`;
            }
            return el.tagName.toLowerCase();
        }

        // Helper to find interactive ancestor
        function findInteractiveAncestor(target: HTMLElement): HTMLElement | null {
            let el: HTMLElement | null = target;
            while (el) {
                if (['BUTTON', 'A'].includes(el.tagName) || el.onclick || el.getAttribute('role') === 'button') {
                    return el;
                }
                // Stop at body
                if (el.tagName === 'BODY') return null;
                el = el.parentElement;
            }
            return null;
        }

        document.addEventListener('click', (e) => {
            const rawTarget = e.target as HTMLElement;
            // Input clicks are handled by focus/change usually, but sticky checkboxes needing click?
            // Let's filter input clicks unless it's a checkbox/radio that doesn't fire change? (Usually they do)
            if (rawTarget.tagName === 'INPUT') return;

            const interactive = findInteractiveAncestor(rawTarget);
            if (interactive) {
                console.log('[Recorder] Click detected on', interactive);
                // @ts-ignore
                window.recordAction({
                    type: 'button',
                    selector: getSelector(interactive),
                    action: 'click'
                });
            }
        }, true);

        const inputHandler = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (!target.tagName) return; // Paranoia

            // Ignore password values for security? Optional. For now record.
            const selector = getSelector(target);
            console.log('[Recorder] Input change/blur on', target);

            if (target.type === 'checkbox' || target.type === 'radio') {
                if (e.type === 'change') { // Only record check/radio on change
                    // @ts-ignore
                    window.recordAction({
                        type: 'radio',
                        selector: selector,
                        action: target.checked ? 'check' : 'uncheck'
                    });
                }
            } else if (target.tagName === 'SELECT') {
                if (e.type === 'change') {
                    // @ts-ignore
                    window.recordAction({
                        type: 'select',
                        selector: selector,
                        value: target.value
                    });
                }
            } else if (['text', 'password', 'email', 'number', 'search', 'tel', 'url'].includes(target.type) || target.tagName === 'TEXTAREA') {
                // For text types, catch blur to be sure we get the final value
                if (e.type === 'change') {
                    // @ts-ignore
                    window.recordAction({
                        type: 'text_box',
                        selector: selector,
                        value: target.value
                    });
                }
            }
        };

        document.addEventListener('change', inputHandler, true);
        // document.addEventListener('blur', inputHandler, true); // change is usually sufficient and less duplicate
    });

    console.log(`Starting recorder on ${url}...`);
    console.log('Perform actions in the browser window.');
    console.log('Close the browser or press Ctrl+C in terminal to finish and save.');

    try {
        await page.goto(url);

        // Wait for browser close
        await new Promise((resolve) => {
            browser.on('disconnected', resolve);
            page.on('close', resolve);
        });

    } catch (e) {
        // Ignored
    }

    // Generate YAML
    const config = {
        target_url: url,
        steps: recordedSteps
    };

    const yamlStr = yaml.dump(config);
    console.log('\n--- Recorded YAML Configuration ---\n');
    console.log(yamlStr);
    console.log('-----------------------------------\n');
}

const targetUrl = process.argv[2];
if (!targetUrl) {
    console.log('Usage: npx tsx src/tools/recorder.ts <url>');
} else {
    startRecorder(targetUrl);
}
