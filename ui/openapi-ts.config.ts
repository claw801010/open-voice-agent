import { defineConfig } from '@hey-api/openapi-ts';

/** Live API default; set `OPENAPI_INPUT` to a snapshot path for offline/CI (see scripts/generate_ui_openapi_client.sh). */
const input =
    process.env.OPENAPI_INPUT?.trim() ||
    'http://127.0.0.1:8000/api/v1/openapi.json';

export default defineConfig({
    input,
    output: 'src/client',
    plugins: [{
        name: '@hey-api/client-fetch',
        runtimeConfigPath: '../lib/apiClient',
    }],
});
