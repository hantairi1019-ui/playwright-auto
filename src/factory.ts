import { Page } from 'playwright';
import { BaseComponent } from './components/base';
import { TextBoxComponent } from './components/textBox';
import { ButtonComponent } from './components/button';
import { RadioComponent } from './components/radio';
import { SelectComponent } from './components/select';
import { LinkComponent } from './components/link';
import { SelectorDef } from './config';

export function createComponent(type: string, page: Page, selector: string | SelectorDef): BaseComponent {
    switch (type) {
        case 'text_box':
            return new TextBoxComponent(page, selector);
        case 'button':
            return new ButtonComponent(page, selector);
        case 'link':
            return new LinkComponent(page, selector);
        case 'radio':
        case 'check':
            return new RadioComponent(page, selector);
        case 'select':
            return new SelectComponent(page, selector);
        default:
            throw new Error(`Unknown component type: ${type}`);
    }
}
