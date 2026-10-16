import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Dict = Dictionary["activitiesPage"];

type FollowUpResult = {
  outcome: string | null;
  prescriptionsGenerated: number | null;
  businessValueGenerated: string | null;
  productAvailable: boolean | null;
};

function Field({ label, value, dict }: { label: string; value: string | null; dict: Dict }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value || <span className="text-muted-foreground">{dict.notRecordedLabel}</span>}
      </dd>
    </div>
  );
}

function boolLabel(value: boolean | null, dict: Dict): string | null {
  if (value === null) return null;
  return value ? dict.yesLabel : dict.noLabel;
}

// Read-only counterpart to CompleteFollowUpForm, shown once the follow-up
// is DONE — same gap this had as the activity execution page before
// AssignmentResultsView: the completion fields were already stored and
// returned by getFollowUpDetail, just never displayed anywhere.
export function FollowUpResultsView({ result, dict }: { result: FollowUpResult; dict: Dict }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.recordedResultsHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field
            label={dict.prescriptionsGeneratedLabel}
            value={result.prescriptionsGenerated?.toString() ?? null}
            dict={dict}
          />
          <Field
            label={dict.businessValueGeneratedLabel}
            value={result.businessValueGenerated}
            dict={dict}
          />
          <Field
            label={dict.productAvailableLabel}
            value={boolLabel(result.productAvailable, dict)}
            dict={dict}
          />
        </dl>
        <div className="mt-4 flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{dict.outcomeLabel}</dt>
          <dd className="text-sm whitespace-pre-wrap">{result.outcome || dict.notRecordedLabel}</dd>
        </div>
      </CardContent>
    </Card>
  );
}
