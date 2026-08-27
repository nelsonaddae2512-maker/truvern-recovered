# R19 Production Semantic Certification

Certification time: 2026-08-26 23:31:38 -05:00

## Certified source

- Branch: main
- Local HEAD: 59f4845de7914f7e40358a5638de5728841786fe
- Remote HEAD: 59f4845de7914f7e40358a5638de5728841786fe
- Worktree before certification: CLEAN

## Certified production deployment

- Deployment: truvern-fd1z45n7x-nelson-ai-projects.vercel.app
- Vercel target: production
- Deployment status: Ready

## Production aliases

The following production aliases were observed on the certified deployment:

- truvern.com
- www.truvern.com
- truvern.io
- www.truvern.io
- truvern-nelson-ai-projects.vercel.app
- truvern-git-main-nelson-ai-projects.vercel.app

## R19 semantic repair

R19 established the following score boundaries:

### Vendor posture

Vendor.riskScore remains the assessment-derived posture score.

Direction:

- Higher score = stronger posture
- Higher posture = lower inferred vendor risk

### Risk exposure snapshots

VendorRiskSnapshot.score remains the exposure metric.

Direction:

- Higher snapshot score = greater exposure

Snapshot computation routes no longer overwrite Vendor.riskScore.

Certified routes:

- app/risk-snapshots/compute-score/route.ts
- app/risk-snapshots/compute-score/compute-scores-bulk/route.ts
- app/risk-snapshots/regenerate/route.ts

### Vendor presentation

Vendor list and vendor detail presentation now interpret Vendor.riskScore consistently:

- >= 75: Low risk
- >= 45: Medium risk
- < 45: High risk
- null: Unscored

### Governance draft inference

Review draft risk inference now treats higher assessment posture as lower residual risk while allowing vendor criticality to elevate governance risk.

## Validation

- TypeScript: PASS
- git diff --check before commit: PASS
- Exact six-file semantic repair committed
- Local / remote Git alignment: PASS
- Production deployment Ready: PASS
- Production aliases aligned: PASS

## Production mutation boundary

No production vendor or risk snapshot was intentionally mutated as part of final R19 deployment certification.

The regenerate route was not called solely for certification.

## R19 result

R19 PRODUCTION SEMANTIC REPAIR: CERTIFIED