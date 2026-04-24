import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
    title: 'Voice agent templates by industry',
    description:
        'Browse voice AI workflow templates for healthcare screening, retail WISMO, and B2B SaaS trial nurture. Filter by industry, use case, language, and compliance tags.',
    openGraph: {
        title: 'Voice agent templates by industry',
        description:
            'Browse vertical voice workflow templates. Sign in to install a pack into your workspace.',
    },
};

export default function TemplatesLayout({ children }: { children: ReactNode }) {
    return children;
}
