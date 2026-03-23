import { supabase } from './client';

export type Order = {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at?: string;
};

export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
};

export type Voucher = {
  id: string;
  order_id: string;
  code: string;
  is_redeemed: boolean;
  expires_at: string;
  created_at?: string;
};

/**
 * Creates a new order along with its items.
 */
export async function createOrder(orderData: Partial<Order>, items: Partial<OrderItem>[]) {
  // Insert order first
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError) throw orderError;

  // Insert items with the new order_id
  const itemsWithOrderId = items.map(item => ({
    ...item,
    order_id: order.id,
  }));

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsWithOrderId)
    .select();

  if (itemsError) throw itemsError;

  return { order, items: orderItems };
}

/**
 * Fetches all orders for a specific user.
 */
export async function getUserOrders(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetches all items for a specific order.
 */
export async function getOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw error;
  return data;
}

/**
 * Fetches a voucher by code or order_id.
 */
export async function getVoucher(identifier: { code?: string; orderId?: string }) {
  let query = supabase.from('vouchers').select('*');

  if (identifier.code) {
    query = query.eq('code', identifier.code);
  } else if (identifier.orderId) {
    query = query.eq('order_id', identifier.orderId);
  } else {
    throw new Error('You must provide either a code or an orderId');
  }

  const { data, error } = await query.single();

  if (error) throw error;
  return data;
}

/**
 * Fetches payment information for an order.
 */
export async function getPaymentInfo(orderId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marks an order as paid and automatically generates a voucher.
 */
export async function markOrderAsPaid(orderId: string) {
  // 1. Update order status
  const { error: updateError } = await (supabase
    .from('orders') as any)
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateError) throw updateError;

  // 2. Generate Voucher
  return await generateVoucher(orderId);
}

/**
 * Generates a unique voucher for an order.
 */
export async function generateVoucher(orderId: string) {
  const code = `BL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`;

  const { data, error } = await (supabase
    .from('vouchers') as any)
    .insert({
      order_id: orderId,
      code: code,
      qr_code_url: qrCodeUrl,
      status: 'active', // added status
      is_redeemed: false,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days expiry
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches all orders with their vouchers and items for Admin display.
 */
export async function getAdminOrders() {
  const { data, error } = await (supabase
    .from('orders') as any)
    .select(`
      *,
      order_items (*),
      vouchers (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Marks a voucher as redeemed (used on-site).
 */
export async function redeemVoucher(voucherId: string) {
  const { error } = await (supabase
    .from('vouchers') as any)
    .update({ 
      is_redeemed: true, 
      redeemed_at: new Date().toISOString() 
    })
    .eq('id', voucherId);

  if (error) throw error;
  return true;
}


