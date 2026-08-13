const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe payment webhook.
 *
 * Payment status is intentionally NOT written to the Google Sheet — the sheet
 * records incoming orders, and payment is confirmed in the Stripe dashboard.
 * This endpoint simply acknowledges Stripe's events and logs each completed
 * payment, so there is a trace in the Netlify function logs.
 */

/**
 * Verify the request really came from Stripe. Falls back to unverified parsing
 * if no signing secret is configured yet.
 */
function parseStripeEvent(event) {
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  if (!signingSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET is not set — accepting webhook without signature verification');
    return JSON.parse(rawBody);
  }

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  return stripe.webhooks.constructEvent(rawBody, signature, signingSecret);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let stripeEvent;
  try {
    stripeEvent = parseStripeEvent(event);
  } catch (error) {
    console.error('Rejected webhook:', error.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const orderNumber = 'PD-' + String(session.id).slice(-8).toUpperCase();
    console.log('Payment received for order', orderNumber, '-', session.customer_email);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
