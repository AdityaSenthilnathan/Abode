import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { getStripe } from "@/server/stripe";
import { handleStripeEvent } from "@/server/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !config.stripe.webhookSecret) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text(); // raw body required for signature verification

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, config.stripe.webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (e) {
    // log + 500 so Stripe retries
    console.error("stripe webhook handler error:", (e as Error).message);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
