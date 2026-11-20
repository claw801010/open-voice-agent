"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import { HttpIntegrationCachePolicySection } from "@/components/HttpIntegrationCachePolicySection";
import { DismissibleHintBanner } from "@/components/onboarding/DismissibleHintBanner";
import { BuilderRecipesPanel } from "@/components/recipes/BuilderRecipesPanel";
import { LocalEhrSection } from "@/components/settings/LocalEhrSection";
import { LocalIntegrationsSection } from "@/components/settings/LocalIntegrationsSection";
import { LocalMessagingSection } from "@/components/settings/LocalMessagingSection";
import { LocalPaymentsSection } from "@/components/settings/LocalPaymentsSection";
import { LocalSchedulingSection } from "@/components/settings/LocalSchedulingSection";
import { MCPSection } from "@/components/MCPSection";
import { TelemetrySection } from "@/components/TelemetrySection";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DISMISSIBLE_HINT_KEYS, resetDismissibleHints } from "@/lib/onboarding/dismissibleHints";
import { resetGettingStarted } from "@/lib/onboarding/gettingStarted";

export default function SettingsPage() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash) return;
    const el = document.querySelector(`[data-settings-section="${hash}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex justify-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">
            Manage your platform configuration and integrations.
          </p>
        </div>

        <Card data-settings-section="recipes">
          <CardHeader>
            <CardTitle>Integration recipes</CardTitle>
            <CardDescription>
              Builder-tier checklists for embed widgets, inbound PSTN, and outbound campaigns. Tier 3: see READMEADK
              and MCP below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DismissibleHintBanner
              hintKey={DISMISSIBLE_HINT_KEYS.settingsRecipes}
              title="Go live safely"
              data-testid="settings-recipes-hint"
            >
              <p>
                Publish a workflow first. Use Simulation → Web test before pointing carriers or embed domains at your
                API.
              </p>
            </DismissibleHintBanner>
            <BuilderRecipesPanel variant="compact" showTitle={false} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/recipes">Full recipe page</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MCP Server</CardTitle>
            <CardDescription>
              Let AI agents access your Dograh workspace and documentation via
              the Model Context Protocol.{" "}
              <a
                href="https://docs.dograh.com/integrations/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MCPSection />
          </CardContent>
        </Card>

        <Card data-settings-section="local-calendar">
          <CardHeader>
            <CardTitle>Local demo calendar</CardTitle>
            <CardDescription>
              Create and manage appointments in-process for booking GTM demos — no Google Calendar required.
              Wire the generated <strong className="font-medium text-foreground">book_slot</strong> HTTP tool on
              catalog agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalSchedulingSection />
          </CardContent>
        </Card>

        <Card data-settings-section="local-payments">
          <CardHeader>
            <CardTitle>Local demo payments</CardTitle>
            <CardDescription>
              Record payment promises and redirect confirms in-process for retail collections and telecom billing demos — no payment processor required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalPaymentsSection />
          </CardContent>
        </Card>

        <Card data-settings-section="local-ehr">
          <CardHeader>
            <CardTitle>Local demo EHR</CardTitle>
            <CardDescription>
              Compliant local chart storage per org — local-only mode or local + sync to athenaHealth, Epic,
              Cerner, or eCW. Wire <strong className="font-medium text-foreground">lookup_patient_context</strong>{' '}
              and <strong className="font-medium text-foreground">sync_chart_to_ehr</strong> on catalog agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalEhrSection />
          </CardContent>
        </Card>

        <Card data-settings-section="local-messaging">
          <CardHeader>
            <CardTitle>Local demo messaging</CardTitle>
            <CardDescription>
              SMS and email outreach log for confirm/remind flows — no Twilio or SendGrid required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalMessagingSection />
          </CardContent>
        </Card>

        <Card data-settings-section="local-integrations">
          <CardHeader>
            <CardTitle>Local demo integrations</CardTitle>
            <CardDescription>
              Record CRM, OSS, ATS, banking, and civic lookup actions in-process for vertical complex variants — no external buyer APIs required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocalIntegrationsSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HTTP integration cache (draft)</CardTitle>
            <CardDescription>
              Org-wide draft for HTTP tool response caching after rollout. Runtime caching stays off until the
              deferral date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HttpIntegrationCachePolicySection />
          </CardContent>
        </Card>

        <Card data-settings-section="help">
          <CardHeader>
            <CardTitle>Help & onboarding</CardTitle>
            <CardDescription>
              Reset guided setup and in-product tips if you dismissed them or want to walk through again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="settings-reset-onboarding"
              onClick={() => {
                resetGettingStarted();
                resetDismissibleHints();
                toast.success("Onboarding and tips reset — open Home to restart");
              }}
            >
              Reset guided setup & tips
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/overview">Open Home</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telemetry</CardTitle>
            <CardDescription>
              Configure Langfuse tracing for your voice agent calls.{" "}
              <a
                href="https://docs.dograh.com/configurations/tracing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelemetrySection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
