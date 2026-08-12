# Zapier → Google Sheets order log

Every order placed on the site is sent to a Zapier catch hook, which appends one
row to a Google Sheet.

A row means **an order was placed**, not that it was paid for. Payment is
confirmed in the Stripe dashboard — each row carries a `stripeSessionId` so it
can be looked up there. Rows where the customer abandoned the payment screen
will appear too, which also makes them visible as leads to follow up on.

## 1. Create the spreadsheet

Make a Google Sheet named e.g. **Porchside Drop Orders** and paste this as
row 1, one column each, in this order:

```
orderNumber | submittedAt | customerName | email | phone | address | season | package | pumpkinCount | colorPalette | addons | deliveryWindow | notes | totalPrice | totalAmount | porchPhotoUrl | stripeSessionId
```

Header names must match the webhook field names exactly — that is how Zapier
maps values to columns. The header row must be filled in before you build the
Zap, or Zapier will not offer the columns.

## 2. Build the Zap

**Trigger — Webhooks by Zapier → Catch Hook**

- Copy the custom webhook URL Zapier gives you.
- In Netlify: **Site configuration → Environment variables**, set
  `ZAPIER_WEBHOOK_URL` to that URL, then redeploy.
- Pick the most recent caught sample when mapping — it has all 16 fields.

**Action — Google Sheets → Create Spreadsheet Row**

- Spreadsheet: your orders sheet. Worksheet: the tab with the headers.
- Map each column to the matching field from the trigger.

Turn the Zap on. That is the whole flow — one trigger, one action.

## Field reference

| Field | Notes |
|---|---|
| `orderNumber` | Short readable id, e.g. `PD-C3D4E5F6`. |
| `submittedAt` | ISO timestamp of when the order was placed. |
| `customerName` | First and last name combined. |
| `season` | `Fall` or `Winter`. |
| `package` | Winter orders only; blank for fall. |
| `pumpkinCount` | Fall orders only; blank for winter. |
| `addons` | Comma-separated, or `None`. |
| `totalPrice` | Formatted, e.g. `$174`. |
| `totalAmount` | Digits only, e.g. `174`, for summing in the sheet. |
| `porchPhotoUrl` | Link to the customer's porch photo. Always present; opens a short "no photo for this order" page if they never uploaded one. |
| `stripeSessionId` | Look this up in Stripe to confirm payment. |

Fields that do not apply are sent as empty strings rather than omitted, so the
columns stay aligned.

## Troubleshooting

- **No rows appear** — check `ZAPIER_WEBHOOK_URL` is set and the site has been
  redeployed since. The function logs `ZAPIER_WEBHOOK_URL is not set` or a
  failed request with the order number in the Netlify function logs.
- **Columns are blank or shifted** — the Zap was mapped from an older caught
  sample. Re-map using the newest one.

The columns are defined in `netlify/functions/lib/order-payload.js`. If you add
one there, add the matching header in the sheet and map it in the Zap.

## Note on porch photos

Customers can attach a photo of their porch in two places: on the fall order
form, and again on the confirmation page after paying. Both go to Netlify Blobs,
filed under the order number, and both are reachable at the `porchPhotoUrl` in
that order's row. A photo uploaded on the confirmation page replaces one sent
with the order — the link in the sheet always resolves to the latest.

Netlify Forms is no longer used for photos, so its storage allowance no longer
applies.
