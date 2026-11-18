import {defineConfig} from 'vitest/config';
import base from '../../../vitest.config';
export default defineConfig({...base,test:{...base.test,include:['e2e/fixtures/e-rechnung/s54o*.integration.test.ts','src/test/acceptance/ablauf_quote_terms.integration.test.ts'],maxWorkers:1,fileParallelism:false}});
