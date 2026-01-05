import { BaseComponent } from './base';

export class TextBoxComponent extends BaseComponent {
    async execute(value?: string, action?: string): Promise<void> {
        if (value === undefined) throw new Error(`TextBoxComponent requires a value for selector: ${this.selector}`);
        console.log(`Fill ${this.selector} with "${value}"`);
        await this.locator.fill(value);
    }
}
