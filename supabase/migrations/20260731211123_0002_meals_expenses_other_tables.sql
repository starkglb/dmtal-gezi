/*
# GEZİYÖNET — Yemek, Masraf, Yoklama, WhatsApp ve Diğer Tablolar

1. Yeni Tablolar
- `meal_organizations` — Yemek organizasyonları (her geziye birden fazla).
- `meal_menus` — Yemek menüleri (her organizasyona birden fazla).
- `participant_meals` — Katılımcı yemek seçimi (menü, fiyat, ödeme durumu).
- `meal_payments` — Yemek ödemeleri (bir katılımcıya birden fazla).
- `expenses` — Masraflar (otobüs, yemek, müze, rehber, konaklama, organizasyon, diger).
- `attendance` — Yoklama kayıtları (geldi, gelmedi, gec_kaldi, otobuse_bindi).
- `reminders` — Hatırlatmalar (okunmadı, okundu, tamamlandi).
- `whatsapp_templates` — Hazır mesaj şablonları.
- `whatsapp_messages` — Gönderim geçmişi.
- `scheduled_messages` — Zamanlanmış mesajlar.
- `activity_log` — Son işlemler kaydı.

2. Güvenlik
- Tüm tablolarda RLS etkin.
- Tüm authenticated yöneticiler tüm verileri okuyabilir/yazabilir.
*/

-- ============================================================
-- meal_organizations: Yemek organizasyonları
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  restaurant_name text NOT NULL,
  meal_name text NOT NULL,
  meal_date date NOT NULL,
  meal_time text,
  location text,
  contact_phone text,
  description text,
  per_person_service_fee numeric(12,2) NOT NULL DEFAULT 0,
  extra_fee numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_org_select" ON meal_organizations;
CREATE POLICY "meal_org_select" ON meal_organizations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "meal_org_insert" ON meal_organizations;
CREATE POLICY "meal_org_insert" ON meal_organizations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meal_org_update" ON meal_organizations;
CREATE POLICY "meal_org_update" ON meal_organizations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meal_org_delete" ON meal_organizations;
CREATE POLICY "meal_org_delete" ON meal_organizations FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meal_org_trip ON meal_organizations(trip_id);

-- ============================================================
-- meal_menus: Yemek menüleri
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_organization_id uuid NOT NULL REFERENCES meal_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_menus_select" ON meal_menus;
CREATE POLICY "meal_menus_select" ON meal_menus FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "meal_menus_insert" ON meal_menus;
CREATE POLICY "meal_menus_insert" ON meal_menus FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meal_menus_update" ON meal_menus;
CREATE POLICY "meal_menus_update" ON meal_menus FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meal_menus_delete" ON meal_menus;
CREATE POLICY "meal_menus_delete" ON meal_menus FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meal_menus_org ON meal_menus(meal_organization_id);

-- ============================================================
-- participant_meals: Katılımcı yemek seçimi
-- ============================================================
CREATE TABLE IF NOT EXISTS participant_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  meal_organization_id uuid NOT NULL REFERENCES meal_organizations(id) ON DELETE CASCADE,
  meal_menu_id uuid REFERENCES meal_menus(id) ON DELETE SET NULL,
  wants_meal boolean NOT NULL DEFAULT false,
  menu_price numeric(12,2) NOT NULL DEFAULT 0,
  extra_fee numeric(12,2) NOT NULL DEFAULT 0,
  meal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, meal_organization_id)
);

ALTER TABLE participant_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant_meals_select" ON participant_meals;
CREATE POLICY "participant_meals_select" ON participant_meals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "participant_meals_insert" ON participant_meals;
CREATE POLICY "participant_meals_insert" ON participant_meals FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "participant_meals_update" ON participant_meals;
CREATE POLICY "participant_meals_update" ON participant_meals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "participant_meals_delete" ON participant_meals;
CREATE POLICY "participant_meals_delete" ON participant_meals FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_participant_meals_participant ON participant_meals(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_meals_trip ON participant_meals(trip_id);
CREATE INDEX IF NOT EXISTS idx_participant_meals_org ON participant_meals(meal_organization_id);

-- ============================================================
-- meal_payments: Yemek ödemeleri
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  meal_organization_id uuid NOT NULL REFERENCES meal_organizations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'nakit'
    CHECK (payment_method IN ('nakit','iban_eft','kart','diger')),
  description text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_payments_select" ON meal_payments;
CREATE POLICY "meal_payments_select" ON meal_payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "meal_payments_insert" ON meal_payments;
CREATE POLICY "meal_payments_insert" ON meal_payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meal_payments_update" ON meal_payments;
CREATE POLICY "meal_payments_update" ON meal_payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meal_payments_delete" ON meal_payments;
CREATE POLICY "meal_payments_delete" ON meal_payments FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meal_payments_participant ON meal_payments(participant_id);

-- ============================================================
-- expenses: Masraflar
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'diger'
    CHECK (category IN ('otobus','yemek','muze','rehber','konaklama','organizasyon','diger')),
  amount numeric(12,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  receipt_url text,
  payment_status text NOT NULL DEFAULT 'odendi'
    CHECK (payment_status IN ('odendi','odenmedi','kismi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);

-- ============================================================
-- attendance: Yoklama
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'geldi'
    CHECK (status IN ('geldi','gelmedi','gec_kaldi','otobuse_bindi')),
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, trip_id)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON attendance;
CREATE POLICY "attendance_select" ON attendance FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "attendance_insert" ON attendance;
CREATE POLICY "attendance_insert" ON attendance FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_update" ON attendance;
CREATE POLICY "attendance_update" ON attendance FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_delete" ON attendance;
CREATE POLICY "attendance_delete" ON attendance FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_attendance_trip ON attendance(trip_id);

-- ============================================================
-- reminders: Hatırlatmalar
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  reminder_date date NOT NULL,
  status text NOT NULL DEFAULT 'okunmadi'
    CHECK (status IN ('okunmadi','okundu','tamamlandi')),
  type text NOT NULL DEFAULT 'genel'
    CHECK (type IN ('gezi_yakinlasma','son_odeme','eksik_odeme','yemek_secimi','bos_koltuk','gezi_tarihi','genel')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select" ON reminders;
CREATE POLICY "reminders_select" ON reminders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_insert" ON reminders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reminders_update" ON reminders;
CREATE POLICY "reminders_update" ON reminders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_delete" ON reminders FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- ============================================================
-- whatsapp_templates: Hazır şablonlar
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_templates_select" ON whatsapp_templates;
CREATE POLICY "wa_templates_select" ON whatsapp_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_templates_insert" ON whatsapp_templates;
CREATE POLICY "wa_templates_insert" ON whatsapp_templates FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "wa_templates_update" ON whatsapp_templates;
CREATE POLICY "wa_templates_update" ON whatsapp_templates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wa_templates_delete" ON whatsapp_templates;
CREATE POLICY "wa_templates_delete" ON whatsapp_templates FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- whatsapp_messages: Gönderim geçmişi
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  recipient_name text,
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'gönderildi'
    CHECK (status IN ('gönderildi','başarısız','planlandi')),
  sent_by text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_messages_select" ON whatsapp_messages;
CREATE POLICY "wa_messages_select" ON whatsapp_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_messages_insert" ON whatsapp_messages;
CREATE POLICY "wa_messages_insert" ON whatsapp_messages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "wa_messages_update" ON whatsapp_messages;
CREATE POLICY "wa_messages_update" ON whatsapp_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wa_messages_delete" ON whatsapp_messages;
CREATE POLICY "wa_messages_delete" ON whatsapp_messages FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_wa_messages_trip ON whatsapp_messages(trip_id);

-- ============================================================
-- scheduled_messages: Zamanlanmış mesajlar
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  recipient_name text,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'beklemede'
    CHECK (status IN ('beklemede','gönderildi','iptal_edildi','başarısız')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_messages_select" ON scheduled_messages;
CREATE POLICY "scheduled_messages_select" ON scheduled_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "scheduled_messages_insert" ON scheduled_messages;
CREATE POLICY "scheduled_messages_insert" ON scheduled_messages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_messages_update" ON scheduled_messages;
CREATE POLICY "scheduled_messages_update" ON scheduled_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_messages_delete" ON scheduled_messages;
CREATE POLICY "scheduled_messages_delete" ON scheduled_messages FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- activity_log: Son işlemler
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "activity_log_update" ON activity_log;
CREATE POLICY "activity_log_update" ON activity_log FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activity_log_delete" ON activity_log;
CREATE POLICY "activity_log_delete" ON activity_log FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
