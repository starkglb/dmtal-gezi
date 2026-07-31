import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Bus,
  Users,
  CreditCard,
  Armchair,
  UtensilsCrossed,
  CheckSquare,
  Receipt,
  UserCog,
  MessageCircle,
  FileText,
  BarChart3,
  Bell,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  emoji: string;
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard', emoji: '🏠' },
  { label: 'Geziler', href: '/dashboard/geziler', icon: Bus, permission: 'trips', emoji: '🚌' },
  { label: 'Katılımcılar', href: '/dashboard/katilimcilar', icon: Users, permission: 'participants', emoji: '👨‍🎓' },
  { label: 'Ödemeler', href: '/dashboard/odemeler', icon: CreditCard, permission: 'payments', emoji: '💳' },
  { label: 'Otobüsler', href: '/dashboard/otobusler', icon: Bus, permission: 'buses', emoji: '🚌' },
  { label: 'Koltuk Düzeni', href: '/dashboard/koltuk-duzeni', icon: Armchair, permission: 'seats', emoji: '💺' },
  { label: 'Yemek Yönetimi', href: '/dashboard/yemekler', icon: UtensilsCrossed, permission: 'meals', emoji: '🍽️' },
  { label: 'Yoklama', href: '/dashboard/yoklama', icon: CheckSquare, permission: 'attendance', emoji: '✅' },
  { label: 'Masraflar', href: '/dashboard/masraflar', icon: Receipt, permission: 'expenses', emoji: '💸' },
  { label: 'Sorumlular', href: '/dashboard/sorumlular', icon: UserCog, permission: 'staff', emoji: '👨‍🏫' },
  { label: 'WhatsApp Merkezi', href: '/dashboard/whatsapp', icon: MessageCircle, permission: 'whatsapp', emoji: '💬' },
  { label: 'Belgeler ve PDF', href: '/dashboard/belgeler', icon: FileText, permission: 'documents', emoji: '📄' },
  { label: 'Raporlar', href: '/dashboard/raporlar', icon: BarChart3, permission: 'reports', emoji: '📊' },
  { label: 'Hatırlatmalar', href: '/dashboard/hatirlatmalar', icon: Bell, permission: 'reminders', emoji: '🔔' },
  { label: 'Ayarlar', href: '/dashboard/ayarlar', icon: Settings, permission: 'settings', emoji: '⚙️' },
];
