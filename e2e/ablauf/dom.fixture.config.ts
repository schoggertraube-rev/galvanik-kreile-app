import {defineConfig, mergeConfig} from 'vitest/config';
import base from '../../vitest.config';

const config = mergeConfig(base, defineConfig({test: {environment: 'node'}}));
// This is fixture preparation only; never run the already-blocking native
// acceptance suite a second time in the DOM job.
config.test = {...config.test, include: ['e2e/ablauf/dom.setup.ts']};
export default config;
