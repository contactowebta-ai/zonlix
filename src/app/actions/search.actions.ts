'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteSearchHistoryItem(searchId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Usuario no autenticado.');

    const { error } = await supabase
      .from('searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/buscar');
    revalidatePath('/resultados');
    revalidatePath('/prospectos');

    return { success: true };
  } catch (error: any) {
    console.error('[deleteSearchHistoryItem] Error:', error.message);
    return { success: false, error: error.message };
  }
}
