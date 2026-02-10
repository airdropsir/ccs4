import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // گزارش وضعیت متغیرها برای عیب‌یابی (بدون نمایش خود کلید برای امنیت)
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ 
      error: 'متغیرهای محیطی در این Deployment یافت نشدند.',
      details: {
        urlFound: !!supabaseUrl,
        keyFound: !!supabaseServiceKey,
        solution: 'لطفاً در پنل Vercel دکمه Redeploy را بزنید تا تنظیمات جدید اعمال شوند.'
      }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const RECORD_ID = 'main_records';

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('ccs_storage')
        .select('data')
        .eq('id', RECORD_ID)
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json(data?.data || []);
    }

    if (req.method === 'POST') {
      const newData = req.body;
      const { error } = await supabase
        .from('ccs_storage')
        .upsert({ 
          id: RECORD_ID, 
          data: newData, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'id' });

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Supabase Error:', error);
    return res.status(500).json({ 
      error: 'خطا در ارتباط با دیتابیس Supabase',
      message: error.message,
      hint: 'اگر کلیدها درست هستند، مطمئن شوید جدول ccs_storage را در SQL Editor ساخته‌اید.'
    });
  }
}