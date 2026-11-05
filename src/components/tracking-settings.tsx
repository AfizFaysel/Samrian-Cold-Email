"use client";

import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as React from "react";
import { toast } from "sonner";

import { errorMessage, requestJson } from "@/lib/request";

type Tracking = { openTrackingEnabled: boolean; clickTrackingEnabled: boolean };

/** Open and click tracking switches; each change saves on its own. */
export function TrackingSettings() {
  const [tracking, setTracking] = React.useState<Tracking>();
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    requestJson<Partial<Tracking>>("/api/settings/compliance")
      .then((data) =>
        setTracking({
          openTrackingEnabled: data.openTrackingEnabled ?? false,
          clickTrackingEnabled: data.clickTrackingEnabled ?? false,
        })
      )
      .catch((loadError) => setError(errorMessage(loadError)));
  }, []);

  async function save(field: keyof Tracking, value: boolean) {
    const previous = tracking;
    setTracking((current) => current && { ...current, [field]: value });
    try {
      await requestJson("/api/settings/compliance", {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
    } catch (saveError) {
      setTracking(previous);
      toast.error(errorMessage(saveError));
    }
  }

  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Tracking</Heading>
          <Text type="supporting">
            Off by default: tracking pixels and rewritten links can hurt cold email delivery.
          </Text>
        </VStack>
        {error ? (
          <Text type="supporting">{error}</Text>
        ) : (
          <VStack gap={3}>
            <Switch
              label="Open tracking"
              description="Adds a tiny image to each email. Counts are estimates, since mail apps like Gmail load images through a proxy."
              value={tracking?.openTrackingEnabled ?? false}
              isDisabled={!tracking}
              changeAction={(checked) => save("openTrackingEnabled", checked)}
            />
            <Switch
              label="Click tracking"
              description="Routes links through Samrian to count clicks before sending people on."
              value={tracking?.clickTrackingEnabled ?? false}
              isDisabled={!tracking}
              changeAction={(checked) => save("clickTrackingEnabled", checked)}
            />
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
