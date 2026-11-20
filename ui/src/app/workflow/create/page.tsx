'use client';

import Link from 'next/link';

import { AiAgentCreateForm } from '@/components/onboarding/AiAgentCreateForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreateWorkflowPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Create with AI</h1>
                        <p className="text-muted-foreground">
                            Full autonomy — describe your voice agent and we generate the workflow, prompts, and graph.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/overview">Guided setup</Link>
                    </Button>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Agent Builder</CardTitle>
                        <CardDescription>
                            Prefer a curated industry pack? Use the template catalog or getting started wizard on Home.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AiAgentCreateForm autoWebTest />
                    </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2 text-sm">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/workflow/catalog">Template catalog</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/workflow">All agents</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
