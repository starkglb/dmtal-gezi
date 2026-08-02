/*
# GEZİYÖNET — Olay, Kara Liste, Acil Durum ve Push Bildirim Tabloları

1. Genel
Bu migration mevcut GEZİYÖNET sistemine 4 yeni modül ekler:
- Olay ve Durum Kayıt Sistemi
- Gezi Kuralları Yönetimi
- Kara Liste Sistemi (çoklu kural ihlali ilişkisel tablo ile)
- Acil Durum Merkezi ve PWA Push Bildirimleri

Mevcut tablolar değiştirilmez. Yalnızca yeni tablolar eklenir.

2. Yeni Tablolar
- `trip_rules` — Gezi kuralları (veritabanından yönetilir, aktif/pasif, sıralı).
- `incidents` — Olay kayıtları (öğrenci, gezi, tür, durum, kara listeye gönderim).
- `blacklist_entries` — Kara liste kayıtları (öğrenci, tür, tarih aralığı, durum).
- `blacklist_violations` — Kara liste ihlalleri (kara liste kaydı ↔ kural ilişkisi, çoklu seçim).
- `blacklist_history` — Kara liste geçmişi (ekleme, kaldırma, durum değişikliği).
- `emergencies` — Acil durum kayıtları (tür, aciliyet, konum, durum, çözüm notu).
- `emergency_acknowledgments` — Acil durum görüntüleme/onay kayıtları.
- `push_subscriptions` — PWA push bildirim abonelikleri.

3. Güvenlik
- Tüm tablolarda RLS etkin.
- Tüm authenticated yöneticiler tüm verileri okuyabilir/yazabilir (mevcut sistemle uyumlu).
- push_subscriptions: kullanıcı yalnızca kendi aboneliğini yönetebilir (auth.uid = user_id).
*/

-- ============================================================
-- trip_rules: Gezi kuralları
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_text text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_rules_select" ON trip_rules;
CREATE POLICY "trip_rules_select" ON trip_rules FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "trip_rules_insert" ON trip_rules;
CREATE POLICY "trip_rules_insert" ON trip_rules FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trip_rules_update" ON trip_rules;
CREATE POLICY "trip_rules_update" ON trip_rules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trip_rules_delete" ON trip_rules;
CREATE POLICY "trip_rules_delete" ON trip_rules FOR DELETE
  TO authenticated USING (true);

INSERT INTO trip_rules (rule_text, sort_order, is_active) VALUES
  ('Öğretmen ve görevli talimatlarına uyulmalıdır.', 1, true),
  ('Gezi grubundan izinsiz ayrılmak yasaktır.', 2, true),
  ('Otobüs içerisinde düzeni bozacak davranışlarda bulunulmamalıdır.', 3, true),
  ('Diğer katılımcıları rahatsız etmek yasaktır.', 4, true),
  ('Fiziksel veya sözlü kavga yasaktır.', 5, true),
  ('Gezi programını aksatacak davranışlarda bulunulmamalıdır.', 6, true),
  ('Okul, otobüs veya ziyaret edilen alanlardaki eşyalara zarar verilmemelidir.', 7, true),
  ('Güvenlik kurallarına uyulmalıdır.', 8, true),
  ('Gezi boyunca belirlenen saatlere uyulmalıdır.', 9, true),
  ('Uygunsuz veya tehlikeli davranışlarda bulunulmamalıdır.', 10, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- incidents: Olay kayıtları
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE,
  incident_type text NOT NULL DEFAULT 'diger'
    CHECK (incident_type IN (
      'disiplin_sorunu','gezi_kurallarina_uymama','ogretmen_talimatina_uymama',
      'gruptan_izinsiz_ayrilma','gec_kalma','otobus_kurallari_ihlali',
      'katilimcilari_rahatsiz_etme','fiziksel_sozlu_tartisma',
      'esyaya_zarar_verme','guvenlik_kurallari_ihlali','diger'
    )),
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  incident_time text,
  location text,
  description text,
  handled_by text,
  status text NOT NULL DEFAULT 'acik'
    CHECK (status IN ('acik','inceleniyor','cozuldu','kapatildi')),
  admin_note text,
  send_to_blacklist boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON incidents;
CREATE POLICY "incidents_select" ON incidents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "incidents_insert" ON incidents;
CREATE POLICY "incidents_insert" ON incidents FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_update" ON incidents;
CREATE POLICY "incidents_update" ON incidents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_delete" ON incidents;
CREATE POLICY "incidents_delete" ON incidents FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_incidents_trip ON incidents(trip_id);
CREATE INDEX IF NOT EXISTS idx_incidents_participant ON incidents(participant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);

-- ============================================================
-- blacklist_entries: Kara liste kayıtları
-- ============================================================
CREATE TABLE IF NOT EXISTS blacklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  blacklist_type text NOT NULL DEFAULT 'gecici'
    CHECK (blacklist_type IN ('gecici','suresiz','inceleme_altinda')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  admin_note text,
  status text NOT NULL DEFAULT 'aktif'
    CHECK (status IN ('aktif','pasif','suresi_doldu','kaldirildi')),
  removal_reason text,
  removed_by text,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE blacklist_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blacklist_select" ON blacklist_entries;
CREATE POLICY "blacklist_select" ON blacklist_entries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "blacklist_insert" ON blacklist_entries;
CREATE POLICY "blacklist_insert" ON blacklist_entries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "blacklist_update" ON blacklist_entries;
CREATE POLICY "blacklist_update" ON blacklist_entries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blacklist_delete" ON blacklist_entries;
CREATE POLICY "blacklist_delete" ON blacklist_entries FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blacklist_participant ON blacklist_entries(participant_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_status ON blacklist_entries(status);
CREATE INDEX IF NOT EXISTS idx_blacklist_type ON blacklist_entries(blacklist_type);

-- ============================================================
-- blacklist_violations: Kara liste ihlalleri (çoklu kural seçimi)
-- ============================================================
CREATE TABLE IF NOT EXISTS blacklist_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_entry_id uuid NOT NULL REFERENCES blacklist_entries(id) ON DELETE CASCADE,
  trip_rule_id uuid NOT NULL REFERENCES trip_rules(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blacklist_entry_id, trip_rule_id)
);

ALTER TABLE blacklist_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blv_select" ON blacklist_violations;
CREATE POLICY "blv_select" ON blacklist_violations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "blv_insert" ON blacklist_violations;
CREATE POLICY "blv_insert" ON blacklist_violations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "blv_delete" ON blacklist_violations;
CREATE POLICY "blv_delete" ON blacklist_violations FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blv_entry ON blacklist_violations(blacklist_entry_id);
CREATE INDEX IF NOT EXISTS idx_blv_rule ON blacklist_violations(trip_rule_id);

-- ============================================================
-- blacklist_history: Kara liste geçmişi
-- ============================================================
CREATE TABLE IF NOT EXISTS blacklist_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_entry_id uuid NOT NULL REFERENCES blacklist_entries(id) ON DELETE CASCADE,
  action text NOT NULL,
  action_by text,
  reason text,
  previous_status text,
  new_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE blacklist_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blh_select" ON blacklist_history;
CREATE POLICY "blh_select" ON blacklist_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "blh_insert" ON blacklist_history;
CREATE POLICY "blh_insert" ON blacklist_history FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "blh_delete" ON blacklist_history;
CREATE POLICY "blh_delete" ON blacklist_history FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blh_entry ON blacklist_history(blacklist_entry_id);

-- ============================================================
-- emergencies: Acil durum kayıtları
-- ============================================================
CREATE TABLE IF NOT EXISTS emergencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  emergency_type text NOT NULL DEFAULT 'diger'
    CHECK (emergency_type IN (
      'saglik_durumu','kayip_ogrenci','otobus_arizasi','trafik_kazasi',
      'guvenlik_sorunu','ogrenci_acil_durum','dogal_olay','diger'
    )),
  location text,
  description text,
  urgency_level text NOT NULL DEFAULT 'orta'
    CHECK (urgency_level IN ('dusuk','orta','yuksek','kritik')),
  status text NOT NULL DEFAULT 'aktif'
    CHECK (status IN ('aktif','mudahale_ediliyor','cozuldu','kapatildi')),
  created_by text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by text,
  resolution_note text,
  resolution_result text,
  resolved_at timestamptz,
  notify_user_ids text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emergencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emergencies_select" ON emergencies;
CREATE POLICY "emergencies_select" ON emergencies FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "emergencies_insert" ON emergencies;
CREATE POLICY "emergencies_insert" ON emergencies FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "emergencies_update" ON emergencies;
CREATE POLICY "emergencies_update" ON emergencies FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "emergencies_delete" ON emergencies;
CREATE POLICY "emergencies_delete" ON emergencies FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies(status);
CREATE INDEX IF NOT EXISTS idx_emergencies_created ON emergencies(created_at DESC);

-- ============================================================
-- emergency_acknowledgments: Acil durum görüntüleme/onay kayıtları
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id uuid NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text,
  notification_sent boolean NOT NULL DEFAULT false,
  notification_viewed boolean NOT NULL DEFAULT false,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emergency_id, user_id)
);

ALTER TABLE emergency_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emack_select" ON emergency_acknowledgments;
CREATE POLICY "emack_select" ON emergency_acknowledgments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "emack_insert" ON emergency_acknowledgments;
CREATE POLICY "emack_insert" ON emergency_acknowledgments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "emack_update" ON emergency_acknowledgments;
CREATE POLICY "emack_update" ON emergency_acknowledgments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "emack_delete" ON emergency_acknowledgments;
CREATE POLICY "emack_delete" ON emergency_acknowledgments FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_emack_emergency ON emergency_acknowledgments(emergency_id);

-- ============================================================
-- push_subscriptions: PWA push bildirim abonelikleri
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pushsub_select_own" ON push_subscriptions;
CREATE POLICY "pushsub_select_own" ON push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pushsub_insert_own" ON push_subscriptions;
CREATE POLICY "pushsub_insert_own" ON push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pushsub_delete_own" ON push_subscriptions;
CREATE POLICY "pushsub_delete_own" ON push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pushsub_user ON push_subscriptions(user_id);
