import { loadConfig } from './config';
import { Runner } from './runner';

const configFile = process.argv[2];

if (!configFile) {
    console.error('Usage: npx tsx src/index.ts <path/to/config.yaml>');
    process.exit(1);
}

try {
    const config = loadConfig(configFile);
    const runner = new Runner(config);
    runner.run().catch(err => {
        console.error('Runtime Error:', err);
        process.exit(1);
    });
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
