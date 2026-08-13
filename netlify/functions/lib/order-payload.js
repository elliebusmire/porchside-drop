/**
 * Shared order payload for the Zapier -> Google Sheets flow.
 *
 * One row is written per order, at the moment the order is placed. Payment is
 * NOT tracked here — it is confirmed in Stripe — so a row means "someone placed
 * this order", not "this order was paid for". `stripeSessionId` is included so
 * any row can be looked up in the Stripe dashboard.
 *
 * Zapier maps webhook fields to spreadsheet columns by field NAME, using a
 * caught sample as the template. Every payload must therefore contain the same
 * keys in the same order, even when a value is empty — otherwise columns shift
 * or silently stop filling in.
 */

// The single source of truth for the sheet's columns. Order matters: it is the
// left-to-right order of the header row in Google Sheets.
const ORDER_FIELDS = [
  'orderNumber',
  'submittedAt',
  'customerName',
  'email',
  'phone',
  'address',
  'season',
  'package',
  'pumpkinCount',
  'colorPalette',
  'addons',
  'deliveryWindow',
  'notes',
  'totalPrice',
  'totalAmount',
  'porchPhotoUrl',
  'stripeSessionId',
];

const str = (value) => (value === undefined || value === null ? '' : String(value).trim());

/**
 * Short, human-friendly order number derived from the Stripe session id, so a
 * row can be referred to without pasting a long id.
 */
function orderNumberFrom(sessionId) {
  const id = str(sessionId);
  return id ? 'PD-' + id.slice(-8).toUpperCase() : '';
}

/**
 * Build the flat, fixed-shape payload sent to Zapier.
 *
 * @param {object} order Order details from the submitted form.
 */
function buildOrderPayload(order = {}) {
  const sessionId = str(order.stripeSessionId);
  const totalPrice = str(order.totalPrice);
  const orderNumber = orderNumberFrom(sessionId);

  // Deterministic, so it can be written to the sheet before the customer has
  // finished uploading. Resolves to an explanatory page if they never do.
  const siteUrl = (process.env.URL || 'https://porchsidedrop.com').replace(/\/$/, '');

  const values = {
    orderNumber: orderNumber,
    submittedAt: str(order.submittedAt) || new Date().toISOString(),
    customerName: [str(order.firstName), str(order.lastName)].filter(Boolean).join(' '),
    email: str(order.email),
    phone: str(order.phone),
    address: str(order.address),
    season: str(order.season),
    package: str(order.package),
    pumpkinCount: str(order.pumpkinCount),
    colorPalette: str(order.colorPalette),
    addons: str(order.addons) || 'None',
    deliveryWindow: str(order.deliveryWindow),
    notes: str(order.notes),
    totalPrice: totalPrice,
    totalAmount: totalPrice.replace(/[^0-9.]/g, ''),
    porchPhotoUrl: orderNumber ? siteUrl + '/photo/' + orderNumber : '',
    stripeSessionId: sessionId,
  };

  // Re-key in the canonical column order, dropping anything unexpected.
  const payload = {};
  for (const field of ORDER_FIELDS) {
    payload[field] = str(values[field]);
  }
  return payload;
}

/**
 * POST an order payload to the Zapier catch hook.
 *
 * Never throws: a Zapier outage must not fail a customer's checkout. Failures
 * are logged with the order number so a missing sheet row can be traced.
 */
async function sendToZapier(payload) {
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!zapierUrl) {
    console.warn('ZAPIER_WEBHOOK_URL is not set — skipping Google Sheets sync for', payload.orderNumber);
    return false;
  }

  try {
    const response = await fetch(zapierUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('Zapier rejected order', payload.orderNumber, '- status', response.status);
      return false;
    }

    console.log('Sent order', payload.orderNumber, 'to Zapier');
    return true;
  } catch (error) {
    console.error('Zapier request failed for order', payload.orderNumber, '-', error.message);
    return false;
  }
}

module.exports = { ORDER_FIELDS, buildOrderPayload, sendToZapier };
