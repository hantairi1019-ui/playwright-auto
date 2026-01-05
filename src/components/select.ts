import { BaseComponent } from './base';

export class SelectComponent extends BaseComponent {
    async execute(value?: string, action?: string): Promise<void> {
        if (value === undefined) throw new Error(`SelectComponent requires a value (option value or label) for selector: ${this.selector}`);
        console.log(`Select option "${value}" in ${this.selector}`);
        await this.locator.selectOption({ label: value }).catch(() => this.locator.selectOption({ value: value }));
    }
}
