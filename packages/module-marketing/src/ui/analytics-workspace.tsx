import { Activity, ArrowUpRight, BarChart3, MailCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  StatTile,
  StatValue,
} from "@brightweblabs/ui";
import type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
} from "../analytics";
import type {
  MarketingCampaign,
  MarketingUiDictionary,
} from "./types";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatRate(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value) + "%";
}

function deliveryRate(analytics: MarketingCampaignAnalytics) {
  return analytics.sent > 0
    ? Number(((analytics.delivered / analytics.sent) * 100).toFixed(2))
    : 0;
}

function queueLabel(
  analytics: MarketingCampaignAnalytics,
  dictionary: MarketingUiDictionary,
) {
  const outstanding = analytics.queue.queued + analytics.queue.sending;
  if (outstanding > 0) return dictionary.analytics.queueInProgress(outstanding);
  if (analytics.queue.failed > 0) {
    return dictionary.analytics.queueFailed(analytics.queue.failed);
  }
  if (analytics.queue.suppressed + analytics.queue.skipped > 0) {
    return dictionary.analytics.queueExcluded(
      analytics.queue.suppressed + analytics.queue.skipped,
    );
  }
  return dictionary.analytics.queueCompleted(analytics.queue.sent);
}

export function CampaignAnalyticsPanel({
  analytics,
  dictionary,
}: {
  analytics: MarketingCampaignAnalytics | null;
  dictionary: MarketingUiDictionary;
}) {
  if (!analytics) return null;
  const values = [
    [dictionary.analytics.sent, formatNumber(analytics.sent, dictionary.locale)],
    [dictionary.analytics.delivery, formatRate(deliveryRate(analytics), dictionary.locale)],
    [dictionary.analytics.opens, formatRate(analytics.openRate, dictionary.locale)],
    [dictionary.analytics.clicks, formatRate(analytics.clickRate, dictionary.locale)],
  ];

  return (
    <section className="space-y-4" aria-labelledby="campaign-analytics-title">
      <div>
        <p className="marketing-kicker" id="campaign-analytics-title">
          {dictionary.analytics.detailsTitle}
        </p>
        <p className="mt-1 text-body text-muted-foreground">
          {dictionary.analytics.detailsSubtitle}
        </p>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border md:grid-cols-4">
        {values.map(([label, value]) => (
          <StatTile className="border-b border-r p-4 last:border-r-0 md:border-b-0" key={label} label={label}>
            <StatValue className="text-data">{value}</StatValue>
          </StatTile>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{queueLabel(analytics, dictionary)}</Badge>
        {analytics.bounced > 0 ? (
          <Badge variant="outline" className="border-destructive/25 text-destructive">
            {analytics.bounced} {dictionary.analytics.bounced.toLocaleLowerCase(dictionary.locale)}
          </Badge>
        ) : null}
        {analytics.unsubscribed > 0 ? (
          <Badge variant="outline">
            {analytics.unsubscribed} {dictionary.analytics.unsubscribed.toLocaleLowerCase(dictionary.locale)}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}

export function AnalyticsWorkspace({
  overview,
  campaigns,
  campaignAnalytics,
  dictionary,
  onOpenCampaign,
}: {
  overview: MarketingOverviewMetrics;
  campaigns: MarketingCampaign[];
  campaignAnalytics: Record<string, MarketingCampaignAnalytics>;
  dictionary: MarketingUiDictionary;
  onOpenCampaign: (campaign: MarketingCampaign) => void;
}) {
  const stats = [
    {
      label: dictionary.analytics.sent,
      value: formatNumber(overview.sent, dictionary.locale),
      detail: `${formatNumber(overview.delivered, dictionary.locale)} ${dictionary.analytics.delivered.toLocaleLowerCase(dictionary.locale)}`,
    },
    {
      label: dictionary.analytics.delivered,
      value: formatNumber(overview.delivered, dictionary.locale),
      detail: overview.sent > 0
        ? formatRate((overview.delivered / overview.sent) * 100, dictionary.locale)
        : "0%",
    },
    {
      label: dictionary.analytics.openRate,
      value: formatRate(overview.openRate, dictionary.locale),
      detail: `${formatNumber(overview.opened, dictionary.locale)} ${dictionary.analytics.opens.toLocaleLowerCase(dictionary.locale)}`,
    },
    {
      label: dictionary.analytics.clickRate,
      value: formatRate(overview.clickRate, dictionary.locale),
      detail: `${formatNumber(overview.clicked, dictionary.locale)} ${dictionary.analytics.clicks.toLocaleLowerCase(dictionary.locale)}`,
    },
    {
      label: dictionary.analytics.bounced,
      value: formatNumber(overview.bounced, dictionary.locale),
      detail: formatRate(overview.bounceRate, dictionary.locale),
    },
    {
      label: dictionary.analytics.unsubscribed,
      value: formatNumber(overview.unsubscribed, dictionary.locale),
      detail: formatRate(overview.unsubRate, dictionary.locale),
    },
  ];
  const rows = campaigns
    .map((campaign) => ({ campaign, analytics: campaignAnalytics[campaign.id] }))
    .filter((row): row is {
      campaign: MarketingCampaign;
      analytics: MarketingCampaignAnalytics;
    } => Boolean(row.analytics));

  return (
    <section className="space-y-6" aria-labelledby="marketing-analytics-heading">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b p-6">
            <div>
              <p className="marketing-kicker">{dictionary.analytics.eyebrow}</p>
              <h2 className="mt-2 text-heading-2 font-semibold tracking-tight" id="marketing-analytics-heading">
                {dictionary.analytics.title}
              </h2>
              <p className="mt-2 max-w-[42rem] text-body text-muted-foreground">
                {dictionary.analytics.subtitle}
              </p>
            </div>
            <div className="rounded-xl border bg-muted p-3 text-muted-foreground">
              <BarChart3 aria-hidden="true" className="size-5" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <StatTile className="border-b border-r p-6" key={stat.label} label={stat.label}>
                <StatValue size="large">{stat.value}</StatValue>
                <p className="mt-2 text-meta text-muted-foreground">{stat.detail}</p>
              </StatTile>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-6">
            <div>
              <p className="marketing-kicker">{dictionary.analytics.campaignsTitle}</p>
              <p className="mt-1 text-body text-muted-foreground">
                {dictionary.analytics.campaignCount(rows.length)}
              </p>
            </div>
            <Activity className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-muted-foreground">
              <MailCheck className="size-7" aria-hidden="true" />
              <p className="text-body">{dictionary.analytics.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-body">
                <thead className="border-b bg-muted/50 text-meta text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{dictionary.analytics.campaign}</th>
                    <th className="px-4 py-3 font-semibold">{dictionary.analytics.delivery}</th>
                    <th className="px-4 py-3 font-semibold">{dictionary.analytics.opens}</th>
                    <th className="px-4 py-3 font-semibold">{dictionary.analytics.clicks}</th>
                    <th className="px-4 py-3 font-semibold">{dictionary.analytics.queue}</th>
                    <th className="px-6 py-3"><span className="sr-only">{dictionary.analytics.open}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(({ campaign, analytics }) => (
                    <tr className="transition-colors hover:bg-muted/40" key={campaign.id}>
                      <td className="px-6 py-4">
                        <p className="text-body font-semibold">{campaign.name}</p>
                        <p className="mt-0.5 max-w-64 truncate text-meta text-muted-foreground">
                          {campaign.subject}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-data">
                        {formatRate(deliveryRate(analytics), dictionary.locale)}
                      </td>
                      <td className="px-4 py-4 text-data">
                        {formatRate(analytics.openRate, dictionary.locale)}
                      </td>
                      <td className="px-4 py-4 text-data">
                        {formatRate(analytics.clickRate, dictionary.locale)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{queueLabel(analytics, dictionary)}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          aria-label={dictionary.analytics.openCampaign(campaign.name)}
                          onClick={() => onOpenCampaign(campaign)}
                          size="icon"
                          variant="ghost"
                        >
                          <ArrowUpRight aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
