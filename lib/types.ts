export type UserRole = 'ana_yonetici' | 'gezi_sorumlusu' | 'odeme_sorumlusu' | 'yoklama_gorevlisi';

export type TripStatus =
  | 'taslak'
  | 'planlaniyor'
  | 'kayit_aliniyor'
  | 'kontenjan_doldu'
  | 'tamamlandi'
  | 'iptal_edildi'
  | 'arsivlendi';

export type ParticipantStatus = 'kesin_katiliyor' | 'beklemede' | 'iptal_edildi' | 'katilmadi';

export type PaymentMethod = 'nakit' | 'iban_eft' | 'kart' | 'diger';

export type PaymentStatus = 'odenmedi' | 'kismi_odeme' | 'odendi' | 'fazla_odeme' | 'ucretsiz';

export type SeatType = 'empty' | 'reserved' | 'teacher' | 'staff' | 'unavailable' | 'driver';

export type AttendanceStatus = 'geldi' | 'gelmedi' | 'gec_kaldi' | 'otobuse_bindi';

export type ExpenseCategory = 'otobus' | 'yemek' | 'muze' | 'rehber' | 'konaklama' | 'organizasyon' | 'diger';

export type ExpensePaymentStatus = 'odendi' | 'odenmedi' | 'kismi';

export type ReminderStatus = 'okunmadi' | 'okundu' | 'tamamlandi';

export type ReminderType =
  | 'gezi_yakinlasma'
  | 'son_odeme'
  | 'eksik_odeme'
  | 'yemek_secimi'
  | 'bos_koltuk'
  | 'gezi_tarihi'
  | 'genel';

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  system_name: string;
  logo_url: string | null;
  organization_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  pdf_header: string;
  pdf_footer: string;
  default_currency: string;
  date_format: string;
  whatsapp_enabled: boolean;
  whatsapp_api_key: string | null;
  whatsapp_sender_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  name: string;
  poster_url: string | null;
  city: string | null;
  places: string | null;
  description: string | null;
  trip_date: string;
  departure_date: string | null;
  departure_time: string | null;
  return_date: string | null;
  return_time: string | null;
  departure_point: string | null;
  price: number;
  capacity: number;
  registration_deadline: string | null;
  program: string | null;
  included_services: string | null;
  excluded_services: string | null;
  private_notes: string | null;
  responsible_person: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  trip_id: string;
  bus_number: string;
  plate: string | null;
  company: string | null;
  capacity: number;
  driver_name: string | null;
  driver_phone: string | null;
  guide_name: string | null;
  responsible_teacher: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Seat {
  id: string;
  bus_id: string;
  seat_number: number;
  seat_type: SeatType;
  participant_id: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  bus_id: string | null;
  seat_id: string | null;
  first_name: string;
  last_name: string;
  student_number: string | null;
  class_grade: string | null;
  class_section: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  notes: string | null;
  status: ParticipantStatus;
  trip_discount: number;
  trip_extra_fee: number;
  created_at: string;
  updated_at: string;
}

export interface TripPayment {
  id: string;
  participant_id: string;
  trip_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface MealOrganization {
  id: string;
  trip_id: string;
  restaurant_name: string;
  meal_name: string;
  meal_date: string;
  meal_time: string | null;
  location: string | null;
  contact_phone: string | null;
  description: string | null;
  per_person_service_fee: number;
  extra_fee: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealMenu {
  id: string;
  meal_organization_id: string;
  name: string;
  description: string | null;
  content: string | null;
  price: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParticipantMeal {
  id: string;
  participant_id: string;
  trip_id: string;
  meal_organization_id: string;
  meal_menu_id: string | null;
  wants_meal: boolean;
  menu_price: number;
  extra_fee: number;
  meal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealPayment {
  id: string;
  participant_id: string;
  trip_id: string;
  meal_organization_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  description: string | null;
  receipt_url: string | null;
  payment_status: ExpensePaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  participant_id: string;
  trip_id: string;
  status: AttendanceStatus;
  notes: string | null;
  recorded_at: string;
}

export interface Reminder {
  id: string;
  trip_id: string | null;
  title: string;
  description: string | null;
  reminder_date: string;
  status: ReminderStatus;
  type: ReminderType;
  created_at: string;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappMessage {
  id: string;
  trip_id: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  message: string;
  status: string;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
}

export interface ScheduledMessage {
  id: string;
  trip_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  message: string;
  scheduled_at: string;
  status: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  created_at: string;
}

export interface ParticipantWithDetails extends Participant {
  trips?: Trip;
  buses?: Bus | null;
  seats?: Seat | null;
  trip_payments?: TripPayment[];
}

export interface ParticipantWithCalculations extends ParticipantWithDetails {
  trip_total_debt: number;
  trip_paid: number;
  trip_remaining: number;
  trip_payment_status: PaymentStatus;
}

// ============================================================
// Yeni Modüller: Olay, Kara Liste, Acil Durum, Push
// ============================================================

export type IncidentType =
  | 'disiplin_sorunu'
  | 'gezi_kurallarina_uymama'
  | 'ogretmen_talimatina_uymama'
  | 'gruptan_izinsiz_ayrilma'
  | 'gec_kalma'
  | 'otobus_kurallari_ihlali'
  | 'katilimcilari_rahatsiz_etme'
  | 'fiziksel_sozlu_tartisma'
  | 'esyaya_zarar_verme'
  | 'guvenlik_kurallari_ihlali'
  | 'diger';

export type IncidentStatus = 'acik' | 'inceleniyor' | 'cozuldu' | 'kapatildi';

export interface TripRule {
  id: string;
  rule_text: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  trip_id: string | null;
  participant_id: string | null;
  incident_type: IncidentType;
  incident_date: string;
  incident_time: string | null;
  location: string | null;
  description: string | null;
  handled_by: string | null;
  status: IncidentStatus;
  admin_note: string | null;
  send_to_blacklist: boolean;
  created_at: string;
  updated_at: string;
}

export type BlacklistType = 'gecici' | 'suresiz' | 'inceleme_altinda';

export type BlacklistStatus = 'aktif' | 'pasif' | 'suresi_doldu' | 'kaldirildi';

export interface BlacklistEntry {
  id: string;
  participant_id: string;
  trip_id: string | null;
  incident_id: string | null;
  blacklist_type: BlacklistType;
  start_date: string;
  end_date: string | null;
  admin_note: string | null;
  status: BlacklistStatus;
  removal_reason: string | null;
  removed_by: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlacklistViolation {
  id: string;
  blacklist_entry_id: string;
  trip_rule_id: string;
  created_at: string;
}

export interface BlacklistHistory {
  id: string;
  blacklist_entry_id: string;
  action: string;
  action_by: string | null;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

export type EmergencyType =
  | 'saglik_durumu'
  | 'kayip_ogrenci'
  | 'otobus_arizasi'
  | 'trafik_kazasi'
  | 'guvenlik_sorunu'
  | 'ogrenci_acil_durum'
  | 'dogal_olay'
  | 'diger';

export type EmergencyUrgency = 'dusuk' | 'orta' | 'yuksek' | 'kritik';

export type EmergencyStatus = 'aktif' | 'mudahale_ediliyor' | 'cozuldu' | 'kapatildi';

export interface Emergency {
  id: string;
  trip_id: string | null;
  emergency_type: EmergencyType;
  location: string | null;
  description: string | null;
  urgency_level: EmergencyUrgency;
  status: EmergencyStatus;
  created_by: string | null;
  created_by_user_id: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  resolution_result: string | null;
  resolved_at: string | null;
  notify_user_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyAcknowledgment {
  id: string;
  emergency_id: string;
  user_id: string;
  user_name: string | null;
  notification_sent: boolean;
  notification_viewed: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  created_at: string;
}
