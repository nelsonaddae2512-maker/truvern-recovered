# Truvern Final Combined Deploy Checklist

## Local verification
- [ ] npx tsc --noEmit
- [ ] node .\scripts\smoke\smoke-billing-deploy-readiness.cjs
- [ ] node .\scripts\smoke\smoke-billing-credits.cjs

## Billing routes
- [ ] /billing/credits
- [ ] /billing/plans
- [ ] /api/billing/credits/checkout
- [ ] /api/stripe/webhook

## Stripe production env
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] STRIPE_PRICE_TRUVERN_CREDITS_STARTER
- [ ] STRIPE_PRICE_TRUVERN_CREDITS_GROWTH
- [ ] STRIPE_PRICE_TRUVERN_CREDITS_SCALE

## Stripe Dashboard
- [ ] Production webhook endpoint: https://www.truvern.com/api/stripe/webhook
- [ ] Event enabled: checkout.session.completed
- [ ] Live price IDs confirmed

## Preview deploy
- [ ] vercel
- [ ] Test preview URL
- [ ] Confirm /billing/credits
- [ ] Confirm /billing/plans
- [ ] Confirm Review Desk
- [ ] Confirm Ops Funding

## Production deploy
- [ ] vercel deploy --prod
- [ ] Verify https://www.truvern.com/billing/credits
- [ ] Verify https://www.truvern.com/billing/plans
- [ ] Verify Stripe webhook 200
- [ ] Verify purchase ledger entry

