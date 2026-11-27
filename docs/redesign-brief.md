# Ismak Foods customer web — redesign brief

Status: draft for approval · 2026-11-27 · Scope: customer website only (not the Expo app)

## 1. Goal

A professional ordering website for Ismak Foods: a customer in Kampala should find a dish, customise it, pay by mobile money, card or cash, and track the order with no friction or confusion. It should look like an established restaurant business, not a template or a demo.

**Design principles**
1. **Menu first.** Food and prices are the content. Everything else gets out of the way.
2. **Plain and exact.** Short, factual copy in customer language. No marketing filler, no internal or technical wording.
3. **Honest data only.** Show ratings, timings and counts only when the backend provides them. Never invent them.
4. **Calm interface.** One accent colour, subtle borders, consistent spacing. No gradients, blobs, glass effects, decorative animation or emoji.
5. **Mobile first.** Most customers order on phones over mobile data, so pages must be light, fast and usable with one thumb.

## 2. Audit of the current site

| Area | Problem |
|---|---|
| Copy | Developer language shown to customers: "Laravel-backed rules", "customer Bearer token", "live API menu", "Checkout guarded", "Paytota ready", "Structured ingredient/allergen fields should be exposed by the API…", "Google client ID required". |
| Fake data | Every product shows "4.7 rated". The stat blocks ("40 live items", "24/7", "30 min prep") and timings ("10 Mins", "15 Mins"…) are generated, not real. |
| Filler sections | "How it works", "Tips & Picks" ("How to enjoy…"), "Kitchen rhythm" banner, "Super Delicious Deals" (these are not deals), and a 2-line hero headline over 4 lines on mobile. |
| Visual noise | Blurred blob shapes, pastel gradients, pill shapes everywhere, oversized type, fly-to-cart animation, heavy shadows. |
| Mobile layout | The header takes about 230 px (logo, location, tabs and icons stacked). The hero fills the whole first screen with no food visible. |
| Product page | Ingredient "chips" are guessed by splitting the description and include the product name itself. The "Live total" block repeats the price three times. |
| Navigation | Everything lives on one URL. No shareable product links, the browser back button doesn't work as expected, and search engines can't index the menu. |
| Footer | No contact details, opening hours, address or legal pages (terms, privacy, refunds). |
| Sign-in | Social buttons show configuration errors instead of being hidden when not configured. |

What works and is kept: real product photography, branch selection, variations and extras, phone OTP sign-in, and the payment status flow (waiting, delayed, failed with retry, paid).

## 3. Information architecture

Real URLs replace the current single-page sections:

| Route | Page |
|---|---|
| `/` | Menu: branch and fulfilment bar, sticky category navigation, product grid grouped by category |
| `/search?q=` | Search results |
| `/product/[id]` | Product detail (opens as a dialog over the menu and works as a full page when linked directly) |
| `/cart` | Cart (side drawer on desktop, full page on mobile) |
| `/checkout` | Checkout: fulfilment, address, payment, review |
| `/checkout/[orderId]/payment` | Payment status (waiting, delayed, failed with retry, paid) |
| `/sign-in` | Phone OTP first, then email and password; Google and Facebook only when configured |
| `/account/orders`, `/account/orders/[id]` | Order history and tracking |
| `/account` | Profile and saved addresses |
| `/about`, `/contact`, `/terms`, `/privacy`, `/refunds` | Static pages for the footer |

**Header:** logo · branch and delivery/pickup selector · search · account · cart with count. On mobile it's a 56 px bar with search on a second row that collapses on scroll.

**Footer:** branches with addresses, hours and phone numbers · links to the static pages · payment methods accepted.

## 4. Visual direction

- **Colour:** neutral base (white, plus a warm grey scale from 50 to 900). One brand accent taken from the logo's red-orange, used only for primary actions, prices and focus states. Semantic colours for success, warning and error. Every text pairing passes WCAG AA contrast.
- **Type:** one family, Plus Jakarta Sans (already in use). A restrained scale from 12 to 40 px, with page titles at 28–32 px rather than the current 80 px or more.
- **Layout:** 8-point spacing. A 12-column grid up to 1,280 px wide on desktop and 4 columns on mobile.
- **Shape:** 8 px corner radius on cards and inputs, 6 px on buttons. Hairline borders instead of shadows. Shadows only on overlays (dialogs, drawers).
- **Imagery:** product photos cropped to a consistent 4:3 ratio. No stock lifestyle photos, illustrations or decorative shapes.
- **Motion:** only functional transitions (dialog and drawer open, under 200 ms), with reduced-motion respected.
- **Icons:** one outline icon set at a single stroke weight.

## 5. Figma deliverables

1. **Foundations:** colour, type, spacing, radius and elevation as Figma variables.
2. **Components with all states:** button, input, select, checkbox and radio, quantity stepper, product card, category navigation, variation group, cart line, order summary, address card, payment option, status badge, alert, dialog, drawer, toast, skeleton, empty state, header, footer.
3. **Screens at mobile (375) and desktop (1440):** menu · search · product · cart · sign-in (phone OTP, email, OTP verification, social registration) · checkout · payment status (waiting, delayed, failed, paid) · orders list · order detail · account and addresses · static page template · error and maintenance pages.
4. **Prototype links** for the main flow: menu → product → cart → sign-in → checkout → payment → order.

## 6. Out of scope

Expo mobile app, backend/API changes (listed separately below), loyalty, wallet, referrals, chat.

## 7. Needed from Ismak Foods

- The logo as a vector file (SVG or AI) and any brand colour or font guidance.
- For each branch: address, opening hours, phone number, and whether it does delivery or pickup.
- How delivery fees are calculated. Orders currently send a fixed `distance: 2`.
- Texts for terms, privacy and refund policies (or approval for placeholders marked as drafts).
- Whether the API can provide real ratings, preparation times and allergens. If it can't, the design leaves them out.
