import { BaseComponent } from './base';

export class RadioComponent extends BaseComponent {
    async execute(value?: string, action?: string): Promise<void> {
        // action can be 'check', 'uncheck'
        // value can be used if selector is a group name? For now assume selector targets the specific input
        if (action === 'uncheck') {
            console.log(`Uncheck ${this.selector}`);
            await this.locator.uncheck();
        } else {
            console.log(`Check ${this.selector}`);
            await this.locator.check();
        }
    }
}
