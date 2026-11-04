import { Text } from "@astryxdesign/core/Text";

/** Heading for a wizard step: one title and one line, aligned to the page's content line. */
export function StepIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Text type="supporting">{description}</Text>
    </div>
  );
}
