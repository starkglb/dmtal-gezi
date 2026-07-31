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
  ],
};
