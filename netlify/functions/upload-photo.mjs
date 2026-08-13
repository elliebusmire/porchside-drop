import { getStore } from '@netlify/blobs';
import Stripe from 'stripe';

/**
 * Receives a porch photo and stores it in Netlify Blobs, keyed to the order it
 * belongs to. Used by both the order form (before payment) and the confirmation
 * page (after payment).
 *
 * The Stripe Checkout session id is verified against Stripe before anything is
 * stored, so the endpoint cannot be used to write images against arbitrary
 * order keys or as general-purpose file hosting.
 *
 * Photos are downscaled to JPEG in the browser before upload, so everything in
 * the store is image/jpeg.
 */

// Generous ceiling; the browser downscales to well under this.
const MAX_BYTES = 5 * 1024 * 1024;

export function orderNumberFrom(sessionId) {
  return 'PD-' + String(sessionId).slice(-8).toUpperCase();
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let sessionId;
  let photo;
  try {
    const form = await req.formData();
    sessionId = String(form.get('sessionId') || '');
    photo = form.get('photo');
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  if (!sessionId || !photo || typeof photo === 'string') {
    return Response.json({ error: 'Missing sessionId or photo' }, { status: 400 });
  }

  if (photo.size === 0 || photo.size > MAX_BYTES) {
    return Response.json({ error: 'Photo must be between 1 byte and 5 MB' }, { status: 413 });
  }

  // Confirm this is a real Checkout session before storing anything.
  const stripe = new Stripe(Netlify.env.get('STRIPE_SECRET_KEY'));
  try {
    await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return Response.json({ error: 'Unknown order' }, { status: 403 });
  }

  const orderNumber = orderNumberFrom(sessionId);

  try {
    const store = getStore('porch-photos');
    await store.set(orderNumber, await photo.arrayBuffer());
  } catch (error) {
    console.error('Failed to store photo for', orderNumber, '-', error.message);
    return Response.json({ error: 'Could not store photo' }, { status: 500 });
  }

  console.log('Stored porch photo for order', orderNumber, '(' + photo.size + ' bytes)');
  return Response.json({ ok: true, orderNumber });
};

export const config = {
  path: '/api/porch-photo',
};
