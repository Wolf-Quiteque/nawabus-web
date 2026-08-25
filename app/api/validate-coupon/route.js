import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ valid: false, message: 'Código é obrigatório' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_percentage, discount_amount_kz, is_active, kind')
      .eq('code', code)
      .eq('kind', 'standard')
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, message: 'Cupom inválido ou inexistente' });
    }

    if (!data.is_active) {
      return NextResponse.json({ valid: false, message: 'Este cupom está inactivo' });
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_type: data.discount_type || 'percentage',
      discount_percentage: data.discount_type === 'fixed_kz' ? null : Number(data.discount_percentage),
      discount_amount_kz: data.discount_type === 'fixed_kz' ? Number(data.discount_amount_kz) : null,
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json({ valid: false, message: 'Erro ao validar cupom' }, { status: 500 });
  }
}
