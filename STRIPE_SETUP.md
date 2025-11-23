# Stripe Setup for LyricSync

## Overview
LyricSync uses Stripe for subscription billing with support for both monthly ($4.99) and yearly ($29.99, 50% off) pricing tiers.

## Required Secrets

The following environment variables must be configured in Replit Secrets:

### Backend Secrets
- `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with `sk_`)
- `STRIPE_PRICE_ID`: Monthly subscription price ID from Stripe (starts with `price_`)
- `STRIPE_YEARLY_PRICE_ID`: Yearly subscription price ID from Stripe (starts with `price_`)
  - **Note**: If not set, the system falls back to `STRIPE_PRICE_ID` for yearly subscriptions
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret (starts with `whsec_`)

### Frontend Secrets
- `VITE_STRIPE_PUBLIC_KEY`: Your Stripe publishable key (starts with `pk_`)

## Stripe Dashboard Setup

### 1. Create Products and Prices

In your Stripe Dashboard (https://dashboard.stripe.com):

1. Go to **Products** → **Create product**
2. Create a product named "LyricSync Premium"
3. Add two prices:
   - **Monthly**: $4.99 USD, recurring monthly
   - **Yearly**: $29.99 USD, recurring yearly

4. Copy the Price IDs:
   - Monthly price ID → `STRIPE_PRICE_ID`
   - Yearly price ID → `STRIPE_YEARLY_PRICE_ID`

### 2. Configure Webhooks

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Enter your endpoint URL:
   - Development: `https://your-replit-dev-url.replit.dev/api/stripe-webhook`
   - Production: `https://your-app.replit.app/api/stripe-webhook`

3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. Copy the **Webhook signing secret** → `STRIPE_WEBHOOK_SECRET`

### 3. Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** → `VITE_STRIPE_PUBLIC_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

**Important**: Use test keys (starting with `pk_test_` and `sk_test_`) for development!

## Implementation Details

### Backend (server/routes.ts)

The `/api/create-subscription` endpoint:
- Accepts `interval` parameter: `'month'` or `'year'`
- Creates Stripe customer if not exists
- Creates subscription with appropriate price ID
- Returns `clientSecret` for frontend payment confirmation

Key logic:
```typescript
const priceId = interval === 'year' 
  ? (process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_PRICE_ID) 
  : process.env.STRIPE_PRICE_ID;
```

### Frontend

**Pricing Page** (`client/src/pages/pricing.tsx`):
- Toggle between monthly and yearly billing
- Shows savings calculation for yearly (50% off)
- Passes `interval` to checkout via URL parameter

**Checkout Page** (`client/src/pages/checkout.tsx`):
- Reads `interval` from URL query params
- Sends interval to backend API
- Initializes Stripe Elements with client secret
- Displays appropriate pricing based on interval

## Testing

### Test Mode
1. Use Stripe test keys (starting with `pk_test_` and `sk_test_`)
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any 3-digit CVC
5. Any 5-digit ZIP code

### Webhooks Testing
- Use Stripe CLI for local webhook testing:
  ```bash
  stripe listen --forward-to localhost:5000/api/stripe-webhook
  ```

## Troubleshooting

### Checkout Page Shows "Preparing checkout..." Forever

**Possible causes**:
1. **Missing Stripe secrets** - Check all secrets are configured
2. **Invalid price IDs** - Verify price IDs exist in Stripe dashboard
3. **Webhook endpoint not accessible** - Ensure your URL is publicly accessible
4. **User not authenticated** - Checkout requires authentication

**Debug steps**:
1. Check server logs for Stripe API errors
2. Verify secrets with health endpoint: `/api/health`
3. Test subscription creation:
   ```bash
   curl -X POST http://localhost:5000/api/create-subscription \
     -H "Content-Type: application/json" \
     -d '{"interval":"month"}' \
     --cookie "connect.sid=YOUR_SESSION_COOKIE"
   ```

### Webhooks Not Working

1. **Verify webhook secret** is correct
2. **Check webhook URL** is publicly accessible
3. **Review Stripe Dashboard** → Webhooks → Event logs
4. **Check server logs** for webhook signature verification errors

### Payment Succeeds but Subscription Not Activated

1. **Webhook handler** - Ensure `customer.subscription.created` event updates user record
2. **Database** - Verify `stripeSubscriptionId` is stored in user table
3. **Cache** - Frontend may be showing cached user data (refresh page)

## Production Checklist

Before going live:

- [ ] Switch to **live API keys** (starting with `pk_live_` and `sk_live_`)
- [ ] Create **live products and prices** in Stripe dashboard
- [ ] Update **webhook endpoint** to production URL
- [ ] Configure **webhook signing secret** for production
- [ ] Test complete checkout flow with real card
- [ ] Verify webhook events are received and processed
- [ ] Enable **Stripe Billing Portal** for subscription management
- [ ] Set up **Stripe tax** if required by your jurisdiction
- [ ] Configure **email receipts** in Stripe settings

## Security Notes

1. **Never expose secret keys** in frontend code
2. **Validate webhook signatures** to prevent spoofing
3. **Use HTTPS** for all webhook endpoints
4. **Store minimal card data** - let Stripe handle PCI compliance
5. **Rate limit** subscription creation endpoints

## Customer Portal

Users can manage subscriptions via Stripe Customer Portal:
- Endpoint: `/api/create-portal-session`
- Accessible from account page
- Allows: Cancel, update payment method, view invoices

---

## Quick Reference

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `STRIPE_SECRET_KEY` | Secret | `sk_test_...` | Server-side API auth |
| `STRIPE_PRICE_ID` | Secret | `price_1ABC...` | Monthly subscription |
| `STRIPE_YEARLY_PRICE_ID` | Secret | `price_1XYZ...` | Yearly subscription |
| `STRIPE_WEBHOOK_SECRET` | Secret | `whsec_...` | Webhook verification |
| `VITE_STRIPE_PUBLIC_KEY` | Public | `pk_test_...` | Frontend Stripe.js |

---

For more information, see:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Elements React](https://stripe.com/docs/stripe-js/react)
- [Subscription Webhooks](https://stripe.com/docs/billing/subscriptions/webhooks)
