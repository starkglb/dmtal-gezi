/*
# GEZİYÖNET — Temel Tablolar

1. Genel
Bu migration GEZİYÖNET okul gezi yönetim sisteminin temel tablolarını oluşturur.
Uygulama yalnızca yöneticiler tarafından kullanılan bir paneldir.
Kimlik doğrulama Supabase Auth (e-posta/şifre) ile yapılır.

2. Yeni Tablolar
- `system_users` — Yönetici kullanıcıların profilleri (rol bilgisi içerir). auth.users ile birebir ilişkili.
  Roller: ana_yonetici, gezi_sorumlusu, odeme_sorumlusu, yoklama_gorevlisi
- `settings` — Sistem/organizasyon ayarları (tek satır).
- `trips` — Geziler. Durum, tarih, ücret, kontenjan, açıklama vb. alanlar.
- `buses` — Otobüsler. Her geziye birden fazla otobüs eklenebilir.
- `seats` — Koltuklar. Her otobüs için koltuk düzeni.
- `participants` — Katılımcılar. Öğrenci bilgileri, veli bilgileri, gezi/otobüs/koltuk ataması.
- `trip_payments` — Gezi ödemeleri. Bir katılımcıya birden fazla ödeme eklenebilir.
- `meal_organizations` — Yemek organizasyonları. Her geziye birden fazla eklenebilir.
- `meal_menus` — Yemek menüleri. Her organizasyona birden fazla menü.
- `participant_meals` — Katılımcı yemek seçimleri.
- `meal_payments` — Yemek ödemeleri. Bir katılımcıya birden fazla ödeme eklenebilir.
- `expenses` — Masraflar. Kategori, tutar, açıklama.
- `attendance` — Yoklama kayıtları. Her katılımcı için durum.
- `reminders` — Hatırlatmalar. Okundu/okunmadı/tamamlandı durumu.
- `reminders` — Hatırlatmalar.
- `whatsapp_messages` — WhatsApp gönderim geçmişi.
- `whatsapp_templates` — Hazır mesaj şablonları.
- `scheduled_messages` — Zamanlanmış mesajlar.
- `activity_log` — Son işlemler kaydı.

3. Güvenlik
- Tüm tablolarda RLS etkin.
- Tüm yetkili yöneticiler (authenticated) tüm verileri okuyabilir/yazabilir.
- Bu özel bir yönetim panelidir; tüm oturum açmış kullanıcılar organizasyon verisine erişebilir.
- system_users tablosu: kullanıcı kendi profilini okuyabilir, güncelleyebilir.
- Roller uygulama katmanında uygulanır; veritabanı tüm authenticated kullanıcıları için açıktır.
- İlk ana yönetici, eşleşen e-posta ile auth.users kaydı oluştuktan sonra manuel eklenir.
*/

-- ============================================================
-- system_users: Yönetici profilleri
-- ============================================================
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'gezi_sorumlusu'
    CHECK (role IN ('ana_yonetici','gezi_sorumlusu','odeme_sorumlusu','yoklama_gorevlisi')),
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "su_select_all" ON system_users;
CREATE POLICY "su_select_all" ON system_users FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "su_insert_self" ON system_users;
CREATE POLICY "su_insert_self" ON system_users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "su_update_self" ON system_users;
CREATE POLICY "su_update_self" ON system_users FOR UPDATE
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM system_users su WHERE su.id = auth.uid() AND su.role = 'ana_yonetici'))
  WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM system_users su WHERE su.id = auth.uid() AND su.role = 'ana_yonetici'));

DROP POLICY IF EXISTS "su_delete_admin" ON system_users;
CREATE POLICY "su_delete_admin" ON system_users FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM system_users su WHERE su.id = auth.uid() AND su.role = 'ana_yonetici'));

-- ============================================================
-- settings: Sistem ayarları (tek satır)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL DEFAULT 'GEZİYÖNET',
  logo_url text,
  organization_name text NOT NULL DEFAULT 'Okul Gezi Organizasyonu',
  phone text,
  email text,
  address text,
  pdf_header text NOT NULL DEFAULT 'GEZİYÖNET',
  pdf_footer text NOT NULL DEFAULT 'GEZİYÖNET Okul Gezi Yönetim Sistemi',
  default_currency text NOT NULL DEFAULT 'TL',
  date_format text NOT NULL DEFAULT 'DD.MM.YYYY',
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_api_key text,
  whatsapp_sender_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_insert" ON settings;
CREATE POLICY "settings_insert" ON settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "settings_update" ON settings;
CREATE POLICY "settings_update" ON settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- İlk ayar satırı
INSERT INTO settings (id) VALUES (gen_random_uuid())
  ON CONFLICT DO NOTHING;

-- ============================================================
-- trips: Geziler
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  poster_url text,
  city text,
  places text,
  description text,
  trip_date date NOT NULL,
  departure_date date,
  departure_time text,
  return_date date,
  return_time text,
  departure_point text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  capacity int NOT NULL DEFAULT 0,
  registration_deadline date,
  program text,
  included_services text,
  excluded_services text,
  private_notes text,
  responsible_person text,
  status text NOT NULL DEFAULT 'taslak'
    CHECK (status IN ('taslak','planlaniyor','kayit_aliniyor','kontenjan_doldu','tamamlandi','iptal_edildi','arsivlendi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips_select" ON trips;
CREATE POLICY "trips_select" ON trips FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "trips_insert" ON trips;
CREATE POLICY "trips_insert" ON trips FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trips_update" ON trips;
CREATE POLICY "trips_update" ON trips FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trips_delete" ON trips;
CREATE POLICY "trips_delete" ON trips FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);

-- ============================================================
-- buses: Otobüsler
-- ============================================================
CREATE TABLE IF NOT EXISTS buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  bus_number text NOT NULL,
  plate text,
  company text,
  capacity int NOT NULL DEFAULT 46,
  driver_name text,
  driver_phone text,
  guide_name text,
  responsible_teacher text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buses_select" ON buses;
CREATE POLICY "buses_select" ON buses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "buses_insert" ON buses;
CREATE POLICY "buses_insert" ON buses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "buses_update" ON buses;
CREATE POLICY "buses_update" ON buses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "buses_delete" ON buses;
CREATE POLICY "buses_delete" ON buses FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_buses_trip ON buses(trip_id);

-- ============================================================
-- seats: Koltuklar
-- ============================================================
CREATE TABLE IF NOT EXISTS seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  seat_number int NOT NULL,
  seat_type text NOT NULL DEFAULT 'empty'
    CHECK (seat_type IN ('empty','reserved','teacher','staff','unavailable','driver')),
  participant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bus_id, seat_number)
);

ALTER TABLE seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seats_select" ON seats;
CREATE POLICY "seats_select" ON seats FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "seats_insert" ON seats;
CREATE POLICY "seats_insert" ON seats FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "seats_update" ON seats;
CREATE POLICY "seats_update" ON seats FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "seats_delete" ON seats;
CREATE POLICY "seats_delete" ON seats FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_seats_bus ON seats(bus_id);
CREATE INDEX IF NOT EXISTS idx_seats_participant ON seats(participant_id);

-- ============================================================
-- participants: Katılımcılar
-- ============================================================
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  seat_id uuid REFERENCES seats(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  student_number text,
  class_grade text,
  class_section text,
  phone text,
  parent_name text,
  parent_phone text,
  notes text,
  status text NOT NULL DEFAULT 'kesin_katiliyor'
    CHECK (status IN ('kesin_katiliyor','beklemede','iptal_edildi','katilmadi')),
  trip_discount numeric(12,2) NOT NULL DEFAULT 0,
  trip_extra_fee numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select" ON participants;
CREATE POLICY "participants_select" ON participants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "participants_insert" ON participants;
CREATE POLICY "participants_insert" ON participants FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "participants_update" ON participants;
CREATE POLICY "participants_update" ON participants FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "participants_delete" ON participants;
CREATE POLICY "participants_delete" ON participants FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_participants_trip ON participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_participants_bus ON participants(bus_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_class ON participants(class_grade);

-- ============================================================
-- trip_payments: Gezi ödemeleri
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'nakit'
    CHECK (payment_method IN ('nakit','iban_eft','kart','diger')),
  description text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trip_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_payments_select" ON trip_payments;
CREATE POLICY "trip_payments_select" ON trip_payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "trip_payments_insert" ON trip_payments;
CREATE POLICY "trip_payments_insert" ON trip_payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trip_payments_update" ON trip_payments;
CREATE POLICY "trip_payments_update" ON trip_payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trip_payments_delete" ON trip_payments;
CREATE POLICY "trip_payments_delete" ON trip_payments FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_trip_payments_participant ON trip_payments(participant_id);
CREATE INDEX IF NOT EXISTS idx_trip_payments_trip ON trip_payments(trip_id);
