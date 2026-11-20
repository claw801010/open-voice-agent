import { describe, expect, it } from 'vitest';

import { BUILDER_RECIPES, builderRecipeById } from './builderRecipes';

describe('builderRecipes', () => {
    it('lists three DX-01 builder recipes', () => {
        expect(BUILDER_RECIPES).toHaveLength(3);
        expect(BUILDER_RECIPES.map((r) => r.id)).toEqual([
            'embed-widget',
            'inbound-pstn',
            'outbound-campaign',
        ]);
    });

    it('builderRecipeById resolves known ids', () => {
        const embed = builderRecipeById('embed-widget');
        expect(embed?.title).toBe('Website voice widget');
        expect(embed?.primaryApi).toContain('embed-token');
    });

    it('builderRecipeById returns undefined for unknown id', () => {
        expect(builderRecipeById('missing' as 'embed-widget')).toBeUndefined();
    });
});
