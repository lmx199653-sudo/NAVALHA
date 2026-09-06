export type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  accent_color: string;
  secondary_color: string;
  bg_color: string;
  font_family: string;
  pix_key?: string | null;
  pix_key_type?: string | null;
  pix_holder_name?: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  image_url?: string | null;
};

export type Barber = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  work_days: number[];
  start_time: string;
  end_time: string;
};

export type PaymentChoice = "plan" | "pix" | "pix_qr" | "on_site";

export type PlanEligibility = {
  eligible: boolean;
  plan_name?: string | null;
  period_end?: string | null;
  services?: { service_id: string; covered: boolean; benefit_kind: string | null; left: number }[];
};
