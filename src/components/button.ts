import { BaseComponent } from './base';

export class ButtonComponent extends BaseComponent {
    async execute(value?: string, action?: string): Promise<void> {
        const act = action || 'click';
        if (act === 'click') {
            console.log(`Click ${this.selector}`);
            await this.locator.click();
        } else {
            throw new Error(`ButtonComponent unknown action: ${act}`);
        }
    }
}
