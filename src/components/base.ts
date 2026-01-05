import { Page, Locator } from 'playwright';
import { SelectorDef } from '../config';

export abstract class BaseComponent {
    protected page: Page;
    protected selector: string | SelectorDef;

    constructor(page: Page, selector: string | SelectorDef) {
        this.page = page;
        this.selector = selector;
    }

    protected get locator(): Locator {
        if (typeof this.selector === 'string') {
            const s = this.selector;
            return this.page.locator(s);
        } else {
            const { mode, value } = this.selector;
            switch (mode) {
                case 'css':
                    return this.page.locator(value);
                case 'xpath':
                    return this.page.locator(`xpath=${value}`);
                case 'text':
                    return this.page.getByText(value);
                case 'id':
                    return this.page.locator(`#${value}`);
                case 'testId':
                    return this.page.getByTestId(value);
                case 'role':
                    return this.page.getByRole(value as any);
                case 'label':
                    return this.page.getByLabel(value);
                case 'placeholder':
                    return this.page.getByPlaceholder(value);
                case 'name':
                    return this.page.locator(`[name="${value}"]`);
                default:
                    throw new Error(`Unknown selector mode: ${mode}`);
            }
        }
    }

    abstract execute(value?: string, action?: string): Promise<void>;
}
