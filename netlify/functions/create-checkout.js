const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Build line items description
    const description = [
      `${data.pumpkinCount} Pumpkins - ${data.colorPalette}`,
      data.addons && data.addons !== 'None' ? `Add-ons: ${data.addons}` : null,
      `Delivery: ${data.deliveryWindow}`,
      data.notes ? `Notes: ${data.notes}` : null
    ].filter(Boolean).join(' | ');

    // Calculate total in cents
    const totalCents = parseInt(data.totalPrice.replace('$', '')) * 100;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: data.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Porchside Drop - Fall Porch Package',
              description: description,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        colorPalette: data.colorPalette,
        pumpkinCount: data.pumpkinCount,
        addons: data.addons,
        deliveryWindow: data.deliveryWindow,
        notes: data.notes || '',
      },
      success_url: `${event.headers.origin || 'https://porchsidedrop.com'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${event.headers.origin || 'https://porchsidedrop.com'}/#signup`,
    });

    // Also send to Zapier webhook in the background
    const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (zapierUrl) {
      fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          stripeSessionId: session.id,
          paymentStatus: 'pending',
        }),
      }).catch(err => console.error('Zapier webhook error:', err));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
