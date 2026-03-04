const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripeEvent = JSON.parse(event.body);

    // Only handle successful checkout completions
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;

      // Send payment confirmation to Zapier
      const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
      if (zapierUrl) {
        await fetch(zapierUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: session.metadata.firstName,
            lastName: session.metadata.lastName,
            email: session.customer_email,
            phone: session.metadata.phone,
            address: session.metadata.address,
            colorPalette: session.metadata.colorPalette,
            pumpkinCount: session.metadata.pumpkinCount,
            addons: session.metadata.addons,
            totalPrice: '$' + (session.amount_total / 100),
            deliveryWindow: session.metadata.deliveryWindow,
            notes: session.metadata.notes,
            stripeSessionId: session.id,
            stripePaymentId: session.payment_intent,
            paymentStatus: 'PAID',
            paidAt: new Date().toISOString(),
          }),
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
