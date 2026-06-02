"use client";

import { Copy, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
    cloneVoiceProfile,
    createVoiceProfile,
    DEFAULT_SPEECH_SETTINGS,
    deleteVoiceProfile,
    fetchVoiceProfiles,
    setOrgDefaultVoiceProfile,
    updateVoiceProfile,
    DEFAULT_ONE_WORD_FILLERS,
    DEFAULT_THREE_WORD_FILLERS,
    DEFAULT_TWO_WORD_FILLERS,
    type AuthenticityLayerSettings,
    type FillerIntensity,
    type KeyProjectionIntensity,
    type SoftBreathIntensity,
    type SpeechDeliverySettings,
    type DeliveryBehavior,
    type DeliveryTone,
    type VoiceProfile,
} from "@/lib/voiceProfiles";

const CLONE_NONE = "__none__";

function linesToList(text: string, max: number): string[] {
    return text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max);
}

function listToLines(items: string[]): string {
    return items.join("\n");
}

function NaturalDeliveryEditor({
    layer,
    onChange,
    disabled,
}: {
    layer: AuthenticityLayerSettings;
    onChange: (layer: AuthenticityLayerSettings) => void;
    disabled?: boolean;
}) {
    const setLayer = (patch: Partial<AuthenticityLayerSettings>) => onChange({ ...layer, ...patch });

    return (
        <div
            className="space-y-4 rounded-md border border-dashed border-teal-500/30 bg-teal-500/5 p-3"
            data-testid="natural-delivery-editor"
        >
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Label>Natural delivery</Label>
                    <p className="text-xs text-muted-foreground">
                        Short 1–3 word fillers, soft breath cadence, and clear emphasis on key facts in spoken (▸)
                        replies.
                    </p>
                </div>
                <Switch
                    disabled={disabled}
                    checked={layer.enabled}
                    onCheckedChange={(c) =>
                        setLayer({
                            enabled: c,
                            fillerIntensity:
                                c && layer.fillerIntensity === "off" ? "low" : layer.fillerIntensity,
                        })
                    }
                />
            </div>
            {layer.enabled ? (
                <>
                    <div className="space-y-2">
                        <Label>Short filler intensity</Label>
                        <Select
                            disabled={disabled}
                            value={layer.fillerIntensity}
                            onValueChange={(v) => setLayer({ fillerIntensity: v as FillerIntensity })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="off">Off</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {layer.fillerIntensity !== "off" && (
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label>1-word fillers</Label>
                                <Textarea
                                    disabled={disabled}
                                    rows={4}
                                    placeholder={DEFAULT_ONE_WORD_FILLERS.join("\n")}
                                    value={listToLines(layer.oneWordFillers)}
                                    onChange={(e) =>
                                        setLayer({ oneWordFillers: linesToList(e.target.value, 12) })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>2-word fillers</Label>
                                <Textarea
                                    disabled={disabled}
                                    rows={4}
                                    placeholder={DEFAULT_TWO_WORD_FILLERS.join("\n")}
                                    value={listToLines(layer.twoWordFillers)}
                                    onChange={(e) =>
                                        setLayer({ twoWordFillers: linesToList(e.target.value, 12) })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>3-word fillers</Label>
                                <Textarea
                                    disabled={disabled}
                                    rows={4}
                                    placeholder={DEFAULT_THREE_WORD_FILLERS.join("\n")}
                                    value={listToLines(layer.threeWordFillers)}
                                    onChange={(e) =>
                                        setLayer({ threeWordFillers: linesToList(e.target.value, 12) })
                                    }
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <Label>Soft breath</Label>
                            <p className="text-xs text-muted-foreground">
                                Gentle in-breath micro-pauses between ideas — not audible gasps.
                            </p>
                        </div>
                        <Switch
                            disabled={disabled}
                            checked={layer.enableSoftBreath}
                            onCheckedChange={(c) => setLayer({ enableSoftBreath: c })}
                        />
                    </div>
                    {layer.enableSoftBreath && (
                        <div className="space-y-2">
                            <Label>Breath intensity</Label>
                            <Select
                                disabled={disabled}
                                value={layer.softBreathIntensity}
                                onValueChange={(v) =>
                                    setLayer({ softBreathIntensity: v as SoftBreathIntensity })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="subtle">Subtle micro-pauses</SelectItem>
                                    <SelectItem value="natural">Natural clause breaks</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <Label>Key projection</Label>
                            <p className="text-xs text-muted-foreground">
                                Clear vocal weight on dates, amounts, codes, and policy terms.
                            </p>
                        </div>
                        <Switch
                            disabled={disabled}
                            checked={layer.enableKeyProjection}
                            onCheckedChange={(c) => setLayer({ enableKeyProjection: c })}
                        />
                    </div>
                    {layer.enableKeyProjection && (
                        <>
                            <div className="space-y-2">
                                <Label>Projection intensity</Label>
                                <Select
                                    disabled={disabled}
                                    value={layer.keyProjectionIntensity}
                                    onValueChange={(v) =>
                                        setLayer({ keyProjectionIntensity: v as KeyProjectionIntensity })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light emphasis</SelectItem>
                                        <SelectItem value="moderate">Moderate + brief pause after key facts</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Key terms to emphasize (optional)</Label>
                                <Textarea
                                    disabled={disabled}
                                    rows={2}
                                    placeholder="confirmation code&#10;appointment"
                                    value={listToLines(layer.keyProjectionTerms)}
                                    onChange={(e) =>
                                        setLayer({ keyProjectionTerms: linesToList(e.target.value, 16) })
                                    }
                                />
                            </div>
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}

function SpeechSettingsEditor({
    value,
    onChange,
    disabled,
}: {
    value: SpeechDeliverySettings;
    onChange: (v: SpeechDeliverySettings) => void;
    disabled?: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Authenticity ({Math.round(value.authenticityLevel * 100)}%)</Label>
                <Input
                    disabled={disabled}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(value.authenticityLevel * 100)}
                    onChange={(e) =>
                        onChange({ ...value, authenticityLevel: Number(e.target.value) / 100 })
                    }
                    className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                    Lower = polished broadcast; higher = conversational and natural.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select
                        disabled={disabled}
                        value={value.tone}
                        onValueChange={(v) => onChange({ ...value, tone: v as DeliveryTone })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                            <SelectItem value="empathetic">Empathetic</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Behavior</Label>
                    <Select
                        disabled={disabled}
                        value={value.behavior}
                        onValueChange={(v) => onChange({ ...value, behavior: v as DeliveryBehavior })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="concise">Concise</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="consultative">Consultative</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Label>Professional fillers</Label>
                    <p className="text-xs text-muted-foreground">
                        Brief phrases like “Let me check” in spoken (▸) replies — separate from the TTS voice.
                    </p>
                </div>
                <Switch
                    disabled={disabled}
                    checked={value.enableProfessionalFillers}
                    onCheckedChange={(c) =>
                        onChange({
                            ...value,
                            enableProfessionalFillers: c,
                            fillerIntensity: c && value.fillerIntensity === "off" ? "low" : value.fillerIntensity,
                        })
                    }
                />
            </div>
            {value.enableProfessionalFillers && (
                <div className="space-y-2">
                    <Label>Filler intensity</Label>
                    <Select
                        disabled={disabled}
                        value={value.fillerIntensity}
                        onValueChange={(v) => onChange({ ...value, fillerIntensity: v as FillerIntensity })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Label>Extended fillers</Label>
                    <p className="text-xs text-muted-foreground">
                        Longer approved transition phrases (one per line) for vertical / brand scripts.
                    </p>
                </div>
                <Switch
                    disabled={disabled}
                    checked={value.enableExtendedFillers}
                    onCheckedChange={(c) => onChange({ ...value, enableExtendedFillers: c })}
                />
            </div>
            {value.enableExtendedFillers && (
                <div className="space-y-2">
                    <Label>Extended filler phrases</Label>
                    <Textarea
                        disabled={disabled}
                        rows={4}
                        placeholder="One moment while I check that for you"
                        value={value.extendedFillerPhrases.join("\n")}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                extendedFillerPhrases: e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                    .slice(0, 24),
                            })
                        }
                    />
                </div>
            )}
            <div className="space-y-2">
                <Label>Multilingual fillers (JSON)</Label>
                <p className="text-xs text-muted-foreground">
                    Locale → phrase list, e.g. {`{"en-US":["One moment"],"es-US":["Un momento"]}`}
                </p>
                <Textarea
                    disabled={disabled}
                    rows={3}
                    value={JSON.stringify(value.multilingualFillers, null, 2)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value || "{}") as Record<string, string[]>;
                            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                                onChange({ ...value, multilingualFillers: parsed });
                            }
                        } catch {
                            /* ignore invalid JSON while typing */
                        }
                    }}
                />
            </div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Label>Breath pauses</Label>
                    <p className="text-xs text-muted-foreground">Shorter clauses and natural cadence.</p>
                </div>
                <Switch
                    disabled={disabled}
                    checked={value.enableBreathPauses}
                    onCheckedChange={(c) => onChange({ ...value, enableBreathPauses: c })}
                />
            </div>
            <NaturalDeliveryEditor
                disabled={disabled}
                layer={value.authenticityLayer}
                onChange={(authenticityLayer) => onChange({ ...value, authenticityLayer })}
            />
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label>Stability</Label>
                    <Input
                        disabled={disabled}
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        placeholder="default"
                        value={value.stability ?? ""}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                stability: e.target.value === "" ? null : Number(e.target.value),
                            })
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label>Similarity</Label>
                    <Input
                        disabled={disabled}
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        placeholder="default"
                        value={value.similarityBoost ?? ""}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                similarityBoost: e.target.value === "" ? null : Number(e.target.value),
                            })
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label>Speed</Label>
                    <Input
                        disabled={disabled}
                        type="number"
                        min={0.5}
                        max={2}
                        step={0.01}
                        placeholder="default"
                        value={value.speed ?? ""}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                speed: e.target.value === "" ? null : Number(e.target.value),
                            })
                        }
                    />
                </div>
            </div>
        </div>
    );
}

export function VoiceProfilesManager() {
    const { getAccessToken, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
    const [defaultId, setDefaultId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draftSpeech, setDraftSpeech] = useState<SpeechDeliverySettings>(DEFAULT_SPEECH_SETTINGS);
    const [draftName, setDraftName] = useState("");
    const [draftDesc, setDraftDesc] = useState("");
    const [draftTags, setDraftTags] = useState("");
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [cloneSourceId, setCloneSourceId] = useState<string>("");

    const reload = useCallback(async () => {
        setLoading(true);
        const list = await fetchVoiceProfiles(getAccessToken);
        setLoading(false);
        if (!list) {
            toast.error("Could not load voice profiles");
            return;
        }
        setProfiles(list.profiles);
        setDefaultId(list.defaultProfileId);
        setSelectedId((cur) => cur ?? list.defaultProfileId ?? list.profiles[0]?.id ?? null);
    }, [getAccessToken]);

    useEffect(() => {
        if (authLoading) return;
        void reload();
    }, [reload, authLoading]);

    const selected = profiles.find((p) => p.id === selectedId) ?? null;

    useEffect(() => {
        if (selected) {
            setDraftSpeech(selected.speechSettings);
            setDraftName(selected.name);
            setDraftDesc(selected.description);
            setDraftTags(selected.tags.join(", "));
        }
    }, [selected?.id, selected?.speechSettings, selected?.name, selected?.description, selected?.tags]);

    const handleSetDefault = async (profileId: string) => {
        const res = await setOrgDefaultVoiceProfile(getAccessToken, profileId);
        if (!res.ok) {
            toast.error(res.error);
            return;
        }
        setProfiles(res.list.profiles);
        setDefaultId(res.list.defaultProfileId);
        toast.success("Org default updated");
    };

    const handleSaveCustom = async () => {
        if (!selected || selected.isBuiltin) return;
        setSaving(true);
        const tags = draftTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        const res = await updateVoiceProfile(getAccessToken, selected.id, {
            name: draftName.trim() || selected.name,
            description: draftDesc,
            speechSettings: draftSpeech,
            tags,
        });
        setSaving(false);
        if (!res.ok) {
            toast.error(res.error);
            return;
        }
        setProfiles((prev) => prev.map((p) => (p.id === res.profile.id ? res.profile : p)));
        toast.success("Profile saved");
    };

    const handleClone = async (sourceId: string) => {
        const source = profiles.find((p) => p.id === sourceId);
        if (!source) return;
        const name = `${source.name} (copy)`;
        const res = await cloneVoiceProfile(getAccessToken, sourceId, name);
        if (!res.ok) {
            toast.error(res.error);
            return;
        }
        setProfiles((prev) => [...prev, res.profile]);
        setSelectedId(res.profile.id);
        toast.success("Profile cloned — customize and save");
    };

    const handleDelete = async (profileId: string) => {
        const res = await deleteVoiceProfile(getAccessToken, profileId);
        if (!res.ok) {
            toast.error(res.error ?? "Delete failed");
            return;
        }
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        if (selectedId === profileId) {
            setSelectedId(defaultId);
        }
        toast.success("Profile deleted");
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        const res = await createVoiceProfile(getAccessToken, {
            name: newName.trim(),
            description: newDesc,
            cloneFromProfileId:
                cloneSourceId && cloneSourceId !== CLONE_NONE ? cloneSourceId : undefined,
        });
        if (!res.ok) {
            toast.error(res.error);
            return;
        }
        setProfiles((prev) => [...prev, res.profile]);
        setSelectedId(res.profile.id);
        setCreateOpen(false);
        setNewName("");
        setNewDesc("");
        setCloneSourceId("");
        toast.success("Profile created");
    };

    if (loading && !profiles.length) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground max-w-xl">
                    Built-in presets tune authenticity, professional fillers, breath pauses, natural delivery
                    (short fillers, soft breath, key projection), and ElevenLabs stability/similarity. Clone any preset to customize, or set an org default for new agents.
                </p>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New profile
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-2">
                    {profiles.map((p) => (
                        <Card
                            key={p.id}
                            data-testid={`voice-profile-card-${p.id}`}
                            className={`cursor-pointer transition-colors ${selectedId === p.id ? "border-primary" : ""}`}
                            onClick={() => setSelectedId(p.id)}
                        >
                            <CardHeader className="py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-sm font-medium">{p.name}</CardTitle>
                                        <CardDescription className="text-xs line-clamp-2">
                                            {p.description}
                                        </CardDescription>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        {defaultId === p.id && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                <Star className="mr-0.5 h-3 w-3" />
                                                default
                                            </Badge>
                                        )}
                                        {p.isBuiltin && (
                                            <Badge variant="outline" className="text-[10px]">
                                                built-in
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {p.tags.slice(0, 3).map((t) => (
                                        <Badge key={t} variant="outline" className="text-[10px]">
                                            {t}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="mt-2 flex gap-1">
                                    {defaultId !== p.id && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleSetDefault(p.id);
                                            }}
                                        >
                                            Set org default
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleClone(p.id);
                                        }}
                                    >
                                        <Copy className="mr-1 h-3 w-3" />
                                        Clone
                                    </Button>
                                    {!p.isBuiltin && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDelete(p.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {selected ? selected.name : "Select a profile"}
                        </CardTitle>
                        <CardDescription>
                            {selected?.isBuiltin
                                ? "Built-in presets cannot be edited. Clone to customize, then tune fillers and TTS separately."
                                : "Adjust delivery settings for this custom profile."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {selected ? (
                            <>
                                {!selected.isBuiltin && (
                                    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                                        <div className="space-y-2">
                                            <Label>Display name</Label>
                                            <Input
                                                value={draftName}
                                                onChange={(e) => setDraftName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                value={draftDesc}
                                                onChange={(e) => setDraftDesc(e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tags (comma-separated)</Label>
                                            <Input
                                                value={draftTags}
                                                onChange={(e) => setDraftTags(e.target.value)}
                                                placeholder="retail, support, demo"
                                            />
                                        </div>
                                        {selected.clonedFromId ? (
                                            <p className="text-xs text-muted-foreground">
                                                Cloned from profile {selected.clonedFromId}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                                <SpeechSettingsEditor
                                    value={draftSpeech}
                                    onChange={setDraftSpeech}
                                    disabled={selected.isBuiltin}
                                />
                                {!selected.isBuiltin && (
                                    <Button type="button" disabled={saving} onClick={() => void handleSaveCustom()}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save changes
                                    </Button>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Choose a profile from the list.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create voice profile</DialogTitle>
                        <DialogDescription>
                            Start blank or clone an existing built-in or custom profile.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="new-voice-profile-name">Name</Label>
                            <Input
                                id="new-voice-profile-name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-voice-profile-description">Description</Label>
                            <Textarea
                                id="new-voice-profile-description"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                rows={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Clone from (optional)</Label>
                            <Select
                                value={cloneSourceId || CLONE_NONE}
                                onValueChange={setCloneSourceId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Start from scratch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CLONE_NONE}>Start from scratch</SelectItem>
                                    {profiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleCreate()}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
