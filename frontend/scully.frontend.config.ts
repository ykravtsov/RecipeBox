import { ScullyConfig } from '@scullyio/scully';
import '@scullyio/scully-plugin-puppeteer';

export const config: ScullyConfig = {
    projectRoot: "./src",
    projectName: "frontend",
    outDir: './dist/static',
    routes: {
        '/': {
            type: 'default'
        }
    }
};