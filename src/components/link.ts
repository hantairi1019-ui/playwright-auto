import { BaseComponent } from './base';

export class LinkComponent extends BaseComponent {
    async execute(value?: string, action?: string): Promise<void> {
        console.log(`Click link ${JSON.stringify(this.selector)}`);
        // Links are usually clicked.
        // If we want to check href, we could validat it against 'value' if provided, but for now just click.
        await this.locator.click();
    }
}
