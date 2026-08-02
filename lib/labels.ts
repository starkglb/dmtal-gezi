import {
  UserRole,
  TripStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  SeatType,
  AttendanceStatus,
  ExpenseCategory,
  ExpensePaymentStatus,
  ReminderStatus,
  ReminderType,
  IncidentType,
  IncidentStatus,
  BlacklistType,
  BlacklistStatus,
  EmergencyType,
  EmergencyUrgency,
  EmergencyStatus,
} from './types';

export const roleLabels: Record<UserRole, string> = {
  ana_yonetici: 'Ana Yönetici',
  gezi_sorumlusu: 'Gezi Sorumlusu',
  odeme_sorumlusu: 'Ödeme Sorumlusu',
  yoklama_gorevlisi: 'Yoklama Görevlisi',
};

export const tripStatusLabels: Record<TripStatus, string> = {
  taslak: 'Taslak',
  planlaniyor: 'Planlanıyor',
  kayit_aliniyor: 'Kayıt Alınıyor',
  kontenjan_doldu: 'Kontenjan Doldu',
  tamamlandi: 'Tamamlandı',
  iptal_edildi: 'İptal Edildi',
  arsivlendi: 'Arşivlendi',
};

export const participantStatusLabels: Record<ParticipantStatus, string> = {
  kesin_katiliyor: 'Kesin Katılıyor',
  beklemede: 'Beklemede',
  iptal_edildi: 'İptal Edildi',
  katilmadi: 'Katılmadı',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  nakit: 'Nakit',
  iban_eft: 'IBAN/EFT',
  kart: 'Kart',
  diger: 'Diğer',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  odenmedi: 'Ödenmedi',
  kismi_odeme: 'Kısmi Ödeme',
  odendi: 'Ödendi',
  fazla_odeme: 'Fazla Ödeme',
  ucretsiz: 'Ücretsiz',
};

export const seatTypeLabels: Record<SeatType, string> = {
  empty: 'Boş',
  reserved: 'Rezerve',
  teacher: 'Öğretmen',
  staff: 'Sorumlu',
  unavailable: 'Kullanılamaz',
  driver: 'Şoför',
};

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  geldi: 'Geldi',
  gelmedi: 'Gelmedi',
  gec_kaldi: 'Geç Kaldı',
  otobuse_bindi: 'Otobüse Bindi',
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  otobus: 'Otobüs',
  yemek: 'Yemek',
  muze: 'Müze',
  rehber: 'Rehber',
  konaklama: 'Konaklama',
  organizasyon: 'Organizasyon',
  diger: 'Diğer',
};

export const expensePaymentStatusLabels: Record<ExpensePaymentStatus, string> = {
  odendi: 'Ödendi',
  odenmedi: 'Ödenmedi',
  kismi: 'Kısmi Ödeme',
};

export const reminderStatusLabels: Record<ReminderStatus, string> = {
  okunmadi: 'Okunmadı',
  okundu: 'Okundu',
  tamamlandi: 'Tamamlandı',
};

export const reminderTypeLabels: Record<ReminderType, string> = {
  gezi_yakinlasma: 'Gezi Yakınlaşma',
  son_odeme: 'Son Ödeme',
  eksik_odeme: 'Eksik Ödeme',
  yemek_secimi: 'Yemek Seçimi',
  bos_koltuk: 'Boş Koltuk',
  gezi_tarihi: 'Gezi Tarihi',
  genel: 'Genel',
};

export const incidentTypeLabels: Record<IncidentType, string> = {
  disiplin_sorunu: 'Disiplin Sorunu',
  gezi_kurallarina_uymama: 'Gezi Kurallarına Uymama',
  ogretmen_talimatina_uymama: 'Öğretmen Talimatına Uymama',
  gruptan_izinsiz_ayrilma: 'Gezi Grubundan İzinsiz Ayrılma',
  gec_kalma: 'Geç Kalma',
  otobus_kurallari_ihlali: 'Otobüs Kurallarını İhlal Etme',
  katilimcilari_rahatsiz_etme: 'Diğer Katılımcıları Rahatsız Etme',
  fiziksel_sozlu_tartisma: 'Fiziksel veya Sözlü Tartışma',
  esyaya_zarar_verme: 'Eşyaya Zarar Verme',
  guvenlik_kurallari_ihlali: 'Güvenlik Kurallarını İhlal Etme',
  diger: 'Diğer',
};

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  acik: 'Açık',
  inceleniyor: 'İnceleniyor',
  cozuldu: 'Çözüldü',
  kapatildi: 'Kapatıldı',
};

export const blacklistTypeLabels: Record<BlacklistType, string> = {
  gecici: 'Geçici',
  suresiz: 'Süresiz',
  inceleme_altinda: 'İnceleme Altında',
};

export const blacklistStatusLabels: Record<BlacklistStatus, string> = {
  aktif: 'Aktif',
  pasif: 'Pasif',
  suresi_doldu: 'Süresi Doldu',
  kaldirildi: 'Kaldırıldı',
};

export const emergencyTypeLabels: Record<EmergencyType, string> = {
  saglik_durumu: 'Sağlık Durumu',
  kayip_ogrenci: 'Kayıp Öğrenci',
  otobus_arizasi: 'Otobüs Arızası',
  trafik_kazasi: 'Trafik Kazası',
  guvenlik_sorunu: 'Güvenlik Sorunu',
  ogrenci_acil_durum: 'Öğrenciyle İlgili Acil Durum',
  dogal_olay: 'Doğal Olay veya Hava Koşulu',
  diger: 'Diğer',
};

export const emergencyUrgencyLabels: Record<EmergencyUrgency, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

export const emergencyStatusLabels: Record<EmergencyStatus, string> = {
  aktif: 'Aktif',
  mudahale_ediliyor: 'Müdahale Ediliyor',
  cozuldu: 'Çözüldü',
  kapatildi: 'Kapatıldı',
};

export const rolePermissions: Record<UserRole, string[]> = {
  ana_yonetici: [
    'dashboard',
    'trips',
    'participants',
    'payments',
    'buses',
    'seats',
    'meals',
    'attendance',
    'expenses',
    'staff',
    'whatsapp',
    'documents',
    'reports',
    'reminders',
    'settings',
    'incidents',
    'rules',
    'blacklist',
    'emergency',
  ],
  gezi_sorumlusu: [
    'dashboard',
    'trips',
    'participants',
    'payments',
    'buses',
    'seats',
    'meals',
    'attendance',
    'expenses',
    'staff',
    'whatsapp',
    'documents',
    'reports',
    'reminders',
    'incidents',
    'blacklist',
    'emergency',
  ],
  odeme_sorumlusu: [
    'dashboard',
    'trips',
    'participants',
    'payments',
    'meals',
    'expenses',
    'reports',
    'reminders',
  ],
  yoklama_gorevlisi: [
    'dashboard',
    'trips',
    'participants',
    'attendance',
    'documents',
    'reminders',
    'incidents',
  ],
};
