'use client';

import { Cpu, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { fetchInferenceProfiles, type InferenceProfileSummary } from '@/lib/inferenceProfiles';
import type { WorkflowConfigurations } from '@/types/workflow-configurations';

const ORG_DEFAULT = '__org_default__';

type Props = {
    workflowConfigurations: WorkflowConfigurations;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
    workflowName: string;
};

export function WorkflowInferenceProfileSection({
    workflowConfigurations,
    onSave,
    workflowName,
}: Props) {
    const { getAccessToken } = useAuth();
    const [profiles, setProfiles] = useState<InferenceProfileSummary[]>([]);
    const [orgActiveId, setOrgActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileId, setProfileId] = useState(
        workflowConfigurations.inference_profile_id ?? ORG_DEFAULT,
    );

    useEffect(() => {
        void (async () => {
            setLoading(true);
            try {
                const data = await fetchInferenceProfiles(getAccessToken);
                setProfiles(data.profiles);
                setOrgActiveId(data.active_profile_id);
            } finally {
                setLoading(false);
            }
        })();
    }, [getAccessToken]);

    useEffect(() => {
        setProfileId(workflowConfigurations.inference_profile_id ?? ORG_DEFAULT);
    }, [workflowConfigurations.inference_profile_id]);

    const selected =
        profileId === ORG_DEFAULT
            ? profiles.find((p) => p.id === orgActiveId)
            : profiles.find((p) => p.id === profileId);

    const isDirty =
        (workflowConfigurations.inference_profile_id ?? ORG_DEFAULT) !== profileId;

    const handleSave = async () => {
        setSaving(true);
        try {
            const next: WorkflowConfigurations = { ...workflowConfigurations };
            if (profileId === ORG_DEFAULT) {
                delete next.inference_profile_id;
            } else {
                next.inference_profile_id = profileId;
            }
            await onSave(next, workflowName);
            toast.success('Inference profile saved');
        } catch {
            toast.error('Failed to save inference profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card id="inference-profile">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Cpu className="h-4 w-4" />
                    Inference profile
                </CardTitle>
                <CardDescription>
                    Override org model stack for this agent (cloud, local edge, or hybrid). Per-service tweaks still
                    apply under Model Overrides below.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                    <>
                        <div className="space-y-2 max-w-md">
                            <Label>Stack</Label>
                            <Select value={profileId} onValueChange={setProfileId}>
                                <SelectTrigger data-testid="workflow-inference-profile-select">
                                    <SelectValue placeholder="Organization default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ORG_DEFAULT}>
                                        Organization default
                                        {orgActiveId
                                            ? ` (${profiles.find((p) => p.id === orgActiveId)?.label ?? orgActiveId})`
                                            : ''}
                                    </SelectItem>
                                    {profiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.label} ({p.tier})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selected ? (
                            <p className="text-sm text-muted-foreground">{selected.summary}</p>
                        ) : profileId === ORG_DEFAULT ? (
                            <p className="text-sm text-muted-foreground">
                                Uses the stack from{' '}
                                <Link href="/model-configurations" className="underline inline-flex items-center gap-0.5">
                                    Model configurations
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                                .
                            </p>
                        ) : null}
                    </>
                )}
            </CardContent>
            <CardFooter>
                <Button
                    type="button"
                    disabled={!isDirty || saving}
                    onClick={() => void handleSave()}
                    data-testid="workflow-inference-profile-save"
                >
                    {saving ? 'Saving…' : 'Save inference profile'}
                </Button>
            </CardFooter>
        </Card>
    );
}
