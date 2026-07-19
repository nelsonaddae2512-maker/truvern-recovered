"use client";

import GovernanceKpiCards from "@/components/governance/governance-kpi-cards";
import WorkflowHealthCard from "@/components/governance/workflow-health-card";
import QuickActionsCard from "@/components/governance/quick-actions-card";
import RecentReviewsCard from "@/components/governance/recent-reviews-card";
import WorkloadCard from "@/components/governance/workload-card";

type Props = {
  kpis: any[];
  workflowHealth: {
    onTrack: number;
    warnings: number;
    critical: number;
  };
  quickActions: any[];
  recentReviews: any[];
  workload: any[];
};

export default function GovernanceDashboard({
  kpis,
  workflowHealth,
  quickActions,
  recentReviews,
  workload,
}: Props) {
  return (
    <div className="space-y-8">
      <GovernanceKpiCards items={kpis} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <WorkflowHealthCard
          onTrack={workflowHealth.onTrack}
          warnings={workflowHealth.warnings}
          critical={workflowHealth.critical}
        />
        <QuickActionsCard actions={quickActions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <RecentReviewsCard reviews={recentReviews} />
        <WorkloadCard items={workload} />
      </div>
    </div>
  );
}
