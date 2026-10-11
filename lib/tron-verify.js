// lib/tron-verify.js — التحقق من TX ID على شبكة Tron
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT TRC20
const TRON_API = 'https://api.trongrid.io';

export async function verifyTransaction(txId, expectedWallet, expectedAmountUSD) {
  if (!txId || txId.length !== 64) {
    return { ok: false, error: 'TX ID قصير جداً' };
  }

  try {
    // 1) جلب تفاصيل العملية
    const txRes = await fetch(`${TRON_API}/v1/transactions/${txId}`);
    if (!txRes.ok) {
      return { ok: false, error: 'TX ID غير موجود على الشبكة' };
    }
    
    const txData = await txRes.json();
    if (!txData.data || txData.data.length === 0) {
      return { ok: false, error: 'لا توجد بيانات لهذه العملية' };
    }

    const tx = txData.data[0];

    // 2) التحقق من نجاح العملية
    if (tx.ret?.[0]?.contractRet !== 'SUCCESS') {
      return { ok: false, error: 'العملية فشلت على الشبكة' };
    }

    // 3) جلب الأحداث (TRC20 Transfer)
    const eventsRes = await fetch(`${TRON_API}/v1/transactions/${txId}/events`);
    if (!eventsRes.ok) {
      return { ok: false, error: 'فشل جلب أحداث العملية' };
    }

    const eventsData = await eventsRes.json();
    const events = eventsData.data || [];

    // ابحث عن Transfer event لـ USDT
    const transferEvent = events.find(e => 
      e.event_name === 'Transfer' && 
      e.contract_address === USDT_CONTRACT
    );

    if (!transferEvent) {
      return { ok: false, error: 'لا توجد عملية تحويل USDT في هذه العملية' };
    }

    const { to, value } = transferEvent.result;
    // USDT TRC20 = 6 decimals
    const amount = Number(value) / 1_000_000;

    // 4) التحقق من المحفظة المستقبلة
    if (to !== expectedWallet) {
      return { 
        ok: false, 
        error: `المحفظة المستقبلة خاطئة (${to.substring(0, 10)}...)`,
        receivedWallet: to
      };
    }

    // 5) التحقق من المبلغ (مع هامش 5%)
    const minExpected = expectedAmountUSD * 0.95;
    if (amount < minExpected) {
      return { 
        ok: false, 
        error: `المبلغ أقل من المطلوب (${amount} USDT بدل ${expectedAmountUSD})`,
        receivedAmount: amount
      };
    }

    return {
      ok: true,
      amount,
      to,
      from: transferEvent.result.from,
      timestamp: tx.block_timestamp,
      confirmations: 'confirmed'
    };

  } catch (error) {
    console.error('Tron verify error:', error);
    return { ok: false, error: 'خطأ في الاتصال بشبكة Tron' };
  }
}