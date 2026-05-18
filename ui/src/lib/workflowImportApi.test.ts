import { describe, expect, it } from 'vitest';

import {
    parseImportJsonText,
    vendorAcceptsMarkdown,
    vendorFileAccept,
} from './workflowImportApi';

describe('workflowImportApi helpers', () => {
    it('parses valid JSON', () => {
        expect(parseImportJsonText('{"steps":[]}')).toEqual({ steps: [] });
    });

    it('throws on invalid JSON', () => {
        expect(() => parseImportJsonText('{')).toThrow(/Invalid JSON/);
    });

    it('skill accepts markdown files', () => {
        expect(vendorAcceptsMarkdown('skill')).toBe(true);
        expect(vendorAcceptsMarkdown('n8n')).toBe(false);
    });

    it('file accept patterns differ by vendor', () => {
        expect(vendorFileAccept('skill')).toContain('.md');
        expect(vendorFileAccept('zapier')).toContain('.json');
    });
});
