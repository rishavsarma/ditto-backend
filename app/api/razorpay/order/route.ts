import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { Orders } from 'razorpay/dist/types/orders';
import { safeParseBody, verifyDomain } from '@/lib/verifyDomain';

interface OrderBody {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  const domainError = verifyDomain(req);
  if (domainError) return domainError;

  try {
    const parsed = await safeParseBody<OrderBody>(req);
    if (parsed instanceof NextResponse) return parsed;
    const { amount, currency = 'INR', receipt, notes } = parsed.data;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'A valid amount is required' }, { status: 400 });
    }

    const options: Orders.RazorpayOrderBaseRequestBody = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt,
      notes,
    };
    const order = await razorpay.orders.create(options);
    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
