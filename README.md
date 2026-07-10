# Ismak Foods Customer Web

Browser checkout for the Ismak Foods customer API.

## Setup

```powershell
copy .env.example .env.local
npm install
npm run dev
```

## Deployment

GitHub Actions builds a Next.js standalone server and uploads it to a cPanel Node.js app over SSH. See [DEPLOYMENT.md](DEPLOYMENT.md) for required repository secrets and cPanel notes.

Defaults point to:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.ismakfoods.com/api/v1
NEXT_PUBLIC_API_ORIGIN=https://api.ismakfoods.com
```

## Contract Rules Implemented

- App bootstraps `GET /api/v1/config` and uses it for branding, favicon, checkout policy, payment methods, branches, and social login visibility.
- API logo and favicon are preferred; local text branding is used only when the remote image is absent or fails to render.
- Browsing is public, but checkout and customer order routes require a customer Bearer token.
- Product options are read from API product payloads and support shared grouped variations, required groups, single or multi select, min/max limits, and both `option_price` and `optionPrice`.
- Digital payment display is bound to `payment_gateway_contract`: exactly one foreground checkout-enabled processor must be active.
- MTN MoMo and Airtel Money remain hidden while they are deferred in config.
- Payment initiation and status polling use backend routes only; provider APIs are never called directly from the browser.

Token storage currently uses `sessionStorage` so checkout survives browser navigation without persisting beyond the browser session.
