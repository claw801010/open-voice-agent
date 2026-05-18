import { defineConfig } from '@hey-api/openapi-ts';

const input =
    process.env.OPENAPI_INPUT?.trim() ||
    '../catalog/openapi/workflow-import.openapi.json';

export default defineConfig({
    input,
    output: 'src/client/workflowImport',
    plugins: [{
        name: '@hey-api/client-fetch',
        runtimeConfigPath: '../../lib/apiClient',
    }],
});
