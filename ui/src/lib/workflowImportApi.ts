/**
 * MK-01 external workflow import — typed SDK from catalog/openapi/workflow-import.openapi.json.
 * Regenerate: `npm run generate-client:workflow-import` (see scripts/gen_workflow_import_openapi.py).
 */
import {
    makeAndCreateApiV1WorkflowImportMakeAndCreatePost,
    n8nAndCreateApiV1WorkflowImportN8nAndCreatePost,
    skillAndCreateApiV1WorkflowImportSkillAndCreatePost,
    zapierAndCreateApiV1WorkflowImportZapierAndCreatePost,
} from '@/client/workflowImport/sdk.gen';
import type {
    MakeImportAndCreateResponse,
    N8nImportAndCreateResponse,
    SkillImportAndCreateResponse,
    ZapierImportAndCreateResponse,
} from '@/client/workflowImport/types.gen';

export type WorkflowImportVendor = 'n8n' | 'make' | 'zapier' | 'skill';

export type WorkflowImportAndCreateResult = {
    id: number;
    name: string;
    warnings: string[];
    suggestedTemplateVariables?: string[];
};

export type WorkflowImportOptions = {
    strictHttpOnly?: boolean;
    emitBranchSubflows?: boolean;
};

type ImportAndCreateResponse =
    | N8nImportAndCreateResponse
    | MakeImportAndCreateResponse
    | ZapierImportAndCreateResponse
    | SkillImportAndCreateResponse;

function parseApiErrorDetail(error: unknown, status?: number): string {
    if (error && typeof error === 'object' && 'detail' in error) {
        const d = (error as { detail: unknown }).detail;
        if (typeof d === 'string') {
            return d;
        }
        if (Array.isArray(d) && d.length > 0) {
            return String(d[0]);
        }
    }
    if (typeof error === 'string') {
        return error;
    }
    return status ? `Import failed (${status})` : 'Import failed';
}

function toResult(
    row: ImportAndCreateResponse,
    fallbackName: string,
): WorkflowImportAndCreateResult {
    if (typeof row.id !== 'number') {
        throw new Error('Import succeeded but response missing workflow id');
    }
    const suggested =
        'suggested_template_variables' in row && Array.isArray(row.suggested_template_variables)
            ? row.suggested_template_variables.map(String)
            : undefined;

    return {
        id: row.id,
        name: row.name ?? fallbackName,
        warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
        suggestedTemplateVariables: suggested,
    };
}

export async function importWorkflowFromVendor(
    vendor: WorkflowImportVendor,
    params: {
        name: string;
        payload: unknown | string;
        options?: WorkflowImportOptions;
    },
): Promise<WorkflowImportAndCreateResult> {
    const strict = params.options?.strictHttpOnly ?? false;
    const branches = params.options?.emitBranchSubflows ?? true;

    if (vendor === 'n8n') {
        const res = await n8nAndCreateApiV1WorkflowImportN8nAndCreatePost({
            body: {
                name: params.name,
                n8n_export: params.payload as Record<string, unknown> | unknown[],
                strict_http_only: strict,
                emit_branch_subflows: branches,
            },
        });
        if (res.error) {
            throw new Error(parseApiErrorDetail(res.error, res.response?.status));
        }
        if (!res.data) {
            throw new Error('Import failed — empty response');
        }
        return toResult(res.data, params.name);
    }

    if (vendor === 'make') {
        const res = await makeAndCreateApiV1WorkflowImportMakeAndCreatePost({
            body: {
                name: params.name,
                make_blueprint: params.payload as Record<string, unknown>,
                strict_http_only: strict,
                emit_route_subflows: branches,
            },
        });
        if (res.error) {
            throw new Error(parseApiErrorDetail(res.error, res.response?.status));
        }
        if (!res.data) {
            throw new Error('Import failed — empty response');
        }
        return toResult(res.data, params.name);
    }

    if (vendor === 'zapier') {
        const res = await zapierAndCreateApiV1WorkflowImportZapierAndCreatePost({
            body: {
                name: params.name,
                zapier_export: params.payload as Record<string, unknown>,
                strict_http_only: strict,
                emit_paths_subflows: branches,
            },
        });
        if (res.error) {
            throw new Error(parseApiErrorDetail(res.error, res.response?.status));
        }
        if (!res.data) {
            throw new Error('Import failed — empty response');
        }
        return toResult(res.data, params.name);
    }

    const res = await skillAndCreateApiV1WorkflowImportSkillAndCreatePost({
        body: {
            name: params.name,
            skill_markdown:
                typeof params.payload === 'string' ? params.payload : String(params.payload),
        },
    });
    if (res.error) {
        throw new Error(parseApiErrorDetail(res.error, res.response?.status));
    }
    if (!res.data) {
        throw new Error('Import failed — empty response');
    }
    return toResult(res.data, params.name);
}

export function parseImportJsonText(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new Error('Invalid JSON — check the export file or pasted content.');
    }
}

export function vendorAcceptsMarkdown(vendor: WorkflowImportVendor): boolean {
    return vendor === 'skill';
}

export function vendorFileAccept(vendor: WorkflowImportVendor): string {
    return vendor === 'skill' ? '.md,.markdown,.txt' : '.json,application/json';
}
