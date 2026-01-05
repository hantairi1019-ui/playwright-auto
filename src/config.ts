import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface SelectorDef {
    mode: 'css' | 'xpath' | 'text' | 'id' | 'testId' | 'role' | 'label' | 'placeholder' | 'name';
    value: string;
}

export interface StepConfig {
    type: 'text_box' | 'button' | 'radio' | 'select' | 'check' | 'link'; // Expandable
    selector: string | SelectorDef;
    value?: string;
    action?: 'click' | 'check' | 'uncheck' | 'select'; // Explicit action override
}

export interface ScrapingField {
    selector: string;
    attribute?: string; // default textContent
}

export interface ScrapingConfig {
    list_selector: string;
    fields: Record<string, string | ScrapingField>;
    pagination?: {
        next_button_selector?: string;
        // max_pages?: number;
    };
    output_file?: string; // Optional path to save scraped data (e.g., 'output.xlsx')
}

export interface GoogleSheetConfig {
    spread_sheet_id?: string; // Can be overridden in config, otherwise use env
    kpis_sheet_name?: string; // Sheet name to append data to
}

export interface ChatworkConfig {
    room_id?: string; // Can be overridden
    message_template?: string; // Template for notification
}

export interface AutomationConfig {
    target_url: string;
    steps: StepConfig[];
    scraping?: ScrapingConfig;
    google_sheet?: GoogleSheetConfig;
    chatwork?: ChatworkConfig;
}

export function loadConfig(filePath: string): AutomationConfig {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(fileContent) as AutomationConfig;
        validateConfig(config);
        return config;
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Failed to load config file: ${filePath}. Error: ${e.message}`);
        }
        throw e;
    }
}

function validateConfig(config: AutomationConfig) {
    if (!config.target_url) {
        throw new Error('Config missing "target_url"');
    }
    // Further validation can be added
}
