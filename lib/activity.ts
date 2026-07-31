import { supabase } from './supabase';
import { SystemUser } from './types';

export async function logActivity(
  user: SystemUser | null,
  action: string,
  description: string,
  entityType?: string,
  entityId?: string
): Promise<void> {
  if (!user) return;
  try {
    await supabase.from('activity_log').insert({
      user_id: user.id,
      user_name: user.full_name,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      description,
    });
  } catch {
    // silent — activity log is non-critical
  }
}
