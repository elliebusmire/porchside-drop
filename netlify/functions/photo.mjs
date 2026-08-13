import { getStore } from '@netlify/blobs';

/**
 * Serves the porch photo for an order, e.g. /photo/PD-C3D4E5F6.
 *
 * This URL goes in the order spreadsheet, one per row. It is deterministic, so
 * it can be written into the sheet the moment an order comes in — before the
 * customer has necessarily uploaded anything. When no photo exists it returns a
 * short explanatory page rather than a 404, so a link in the sheet never looks
 * broken.
 *
 * Order numbers are derived from Stripe session ids and are not practically
 * guessable, which is what keeps these images private.
 */

const ORDER_PATTERN = /^PD-[A-Z0-9]{1,16}$/;

function notice(title, message, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:20vh auto;padding:0 1.5rem;text-align:center;color:#3d3d3d">
  <h1 style="font-size:1.25rem;font-weight:600;margin-bottom:.5rem">${title}</h1>
  <p style="color:#6b6b6b;line-height:1.6">${message}</p>
</div>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export default async (req, context) => {
  const orderNumber = String(context.params.order || '').toUpperCase();

  if (!ORDER_PATTERN.test(orderNumber)) {
    return notice('Not a valid order number', 'Check the link from the order spreadsheet.', 400);
  }

  const store = getStore('porch-photos');
  const photo = await store.get(orderNumber, { type: 'arrayBuffer' });

  if (!photo) {
    return notice(
      'No photo for this order',
      `The customer for order ${orderNumber} did not upload a photo of their porch.`
    );
  }

  return new Response(photo, {
    headers: {
      'Content-Type': 'image/jpeg',
      // Private: these are customer photos, so keep them out of shared caches.
      'Cache-Control': 'private, max-age=300',
    },
  });
};

export const config = {
  path: '/photo/:order',
};
