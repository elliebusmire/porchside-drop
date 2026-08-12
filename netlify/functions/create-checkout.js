const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { buildOrderPayload, sendToZapier } = require('./lib/order-payload');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Determine season from the page that submitted
    const season = data.package ? 'Winter' : 'Fall';

    // Build line items description
    let description;
    if (season === 'Winter') {
      description = [
        `${data.package} Package - ${data.colorPalette}`,
        data.addons && data.addons !== 'None' ? `Add-ons: ${data.addons}` : null,
        `Delivery: ${data.deliveryWindow}`,
        data.notes ? `Notes: ${data.notes}` : null
      ].filter(Boolean).join(' | ');
    } else {
      description = [
        `${data.pumpkinCount} Pumpkins - ${data.colorPalette}`,
        data.addons && data.addons !== 'None' ? `Add-ons: ${data.addons}` : null,
        `Delivery: ${data.deliveryWindow}`,
        data.notes ? `Notes: ${data.notes}` : null
      ].filter(Boolean).join(' | ');
    }

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
              name: `Porchside Drop - ${season} Porch Package`,
              description: description,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        season: season,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        colorPalette: data.colorPalette,
        package: data.package || '',
        pumpkinCount: data.pumpkinCount || '',
        addons: data.addons || '',
        deliveryWindow: data.deliveryWindow,
        notes: data.notes || '',
        submittedAt: data.submittedAt || new Date().toISOString(),
      },
      success_url: `${event.headers.origin || 'https://porchsidedrop.com'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${event.headers.origin || 'https://porchsidedrop.com'}/#signup`,
    });

    // Log the order in the Google Sheet. Awaited on purpose: a fire-and-forget
    // request can be cut off when the function returns, which drops rows.
    await sendToZapier(
      buildOrderPayload({
        ...data,
        season: season,
        stripeSessionId: session.id,
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      // sessionId lets the browser upload the porch photo against this order
      // before it redirects to Stripe.
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
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
