export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          barber_id: string | null
          barbershop_id: string
          benefit_kind: string | null
          benefit_processed: boolean
          created_at: string
          customer_cpf: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          ends_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_expires_at: string | null
          payment_method: string
          payment_state: string
          price_cents: number
          service_id: string | null
          source: string
          starts_at: string
          status: string
          subscription_id: string | null
          use_benefit: boolean
        }
        Insert: {
          barber_id?: string | null
          barbershop_id: string
          benefit_kind?: string | null
          benefit_processed?: boolean
          created_at?: string
          customer_cpf?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string
          payment_state?: string
          price_cents?: number
          service_id?: string | null
          source?: string
          starts_at: string
          status?: string
          subscription_id?: string | null
          use_benefit?: boolean
        }
        Update: {
          barber_id?: string | null
          barbershop_id?: string
          benefit_kind?: string | null
          benefit_processed?: boolean
          created_at?: string
          customer_cpf?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string
          payment_state?: string
          price_cents?: number
          service_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          subscription_id?: string | null
          use_benefit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          barbershop_id: string
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          barbershop_id: string
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          barbershop_id?: string
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          barbershop_id: string
          bio: string | null
          commission_pct: number
          created_at: string
          end_time: string
          id: string
          name: string
          photo_url: string | null
          start_time: string
          work_days: number[]
        }
        Insert: {
          active?: boolean
          barbershop_id: string
          bio?: string | null
          commission_pct?: number
          created_at?: string
          end_time?: string
          id?: string
          name: string
          photo_url?: string | null
          start_time?: string
          work_days?: number[]
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          bio?: string | null
          commission_pct?: number
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          photo_url?: string | null
          start_time?: string
          work_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "barbers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershop_members: {
        Row: {
          barbershop_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          barbershop_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          barbershop_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbershop_members_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          accent_color: string
          address: string | null
          bg_color: string
          brand_style: string | null
          brand_symbol: string | null
          cover_url: string | null
          cpf_cnpj: string | null
          created_at: string
          description: string | null
          font_family: string
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          onboarding_done: boolean
          owner_id: string
          phone: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          secondary_color: string
          slug: string
          template: string
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          bg_color?: string
          brand_style?: string | null
          brand_symbol?: string | null
          cover_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          description?: string | null
          font_family?: string
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name: string
          onboarding_done?: boolean
          owner_id: string
          phone?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          secondary_color?: string
          slug: string
          template?: string
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          bg_color?: string
          brand_style?: string | null
          brand_symbol?: string | null
          cover_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          description?: string | null
          font_family?: string
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          onboarding_done?: boolean
          owner_id?: string
          phone?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          secondary_color?: string
          slug?: string
          template?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      billing_accounts: {
        Row: {
          barbershop_id: string
          created_at: string
          free_quota: number
          free_used: number
          updated_at: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          free_quota?: number
          free_used?: number
          updated_at?: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          free_quota?: number
          free_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: true
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          amount_cents: number
          barbershop_id: string
          billed_count: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          status: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          barbershop_id: string
          billed_count?: number
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          status?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          barbershop_id?: string
          billed_count?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_cents: number
          appointments_count: number
          barbershop_id: string
          created_at: string
          cycle_id: string | null
          due_date: string
          id: string
          paid_amount_cents: number | null
          paid_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          pix_txid: string
          status: string
          suspend_at: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointments_count?: number
          barbershop_id: string
          created_at?: string
          cycle_id?: string | null
          due_date: string
          id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          pix_txid: string
          status?: string
          suspend_at: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointments_count?: number
          barbershop_id?: string
          created_at?: string
          cycle_id?: string | null
          due_date?: string
          id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          pix_txid?: string
          status?: string
          suspend_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          cycle_days: number
          free_quota: number
          id: boolean
          payment_days: number
          pending_days: number
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          cycle_days?: number
          free_quota?: number
          id?: boolean
          payment_days?: number
          pending_days?: number
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          cycle_days?: number
          free_quota?: number
          id?: boolean
          payment_days?: number
          pending_days?: number
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_usages: {
        Row: {
          appointment_id: string
          barbershop_id: string
          created_at: string
          cycle_id: string | null
          id: string
          is_free: boolean
          unit_price_cents: number
        }
        Insert: {
          appointment_id: string
          barbershop_id: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_free?: boolean
          unit_price_cents?: number
        }
        Update: {
          appointment_id?: string
          barbershop_id?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_free?: boolean
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_usages_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_usages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          created_at: string
          external_id: string
          id: string
          invoice_id: string | null
          payload: Json | null
          provider: string
          result: string | null
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          provider: string
          result?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          provider?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          barbershop_id: string
          close_time: string
          closed: boolean
          id: string
          open_time: string
          weekday: number
        }
        Insert: {
          barbershop_id: string
          close_time?: string
          closed?: boolean
          id?: string
          open_time?: string
          weekday: number
        }
        Update: {
          barbershop_id?: string
          close_time?: string
          closed?: boolean
          id?: string
          open_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          barbershop_id: string
          created_at: string
          id: string
          message: string
          name: string
          segment: string
          sent_count: number
          status: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          id?: string
          message: string
          name: string
          segment?: string
          sent_count?: number
          status?: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          id?: string
          message?: string
          name?: string
          segment?: string
          sent_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscriptions: {
        Row: {
          barbershop_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          id: string
          last_payment_at: string | null
          next_payment: string | null
          payment_status: string
          plan_id: string
          price_cents: number
          started_on: string
          status: string
          updated_at: string
          uses_left: number
        }
        Insert: {
          barbershop_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          last_payment_at?: string | null
          next_payment?: string | null
          payment_status?: string
          plan_id: string
          price_cents?: number
          started_on?: string
          status?: string
          updated_at?: string
          uses_left?: number
        }
        Update: {
          barbershop_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          last_payment_at?: string | null
          next_payment?: string | null
          payment_status?: string
          plan_id?: string
          price_cents?: number
          started_on?: string
          status?: string
          updated_at?: string
          uses_left?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscriptions_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          barbershop_id: string
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          points: number
        }
        Insert: {
          barbershop_id: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          points?: number
        }
        Update: {
          barbershop_id?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          barbershop_id: string
          created_at: string
          id: string
          name: string
          points_cost: number
        }
        Insert: {
          active?: boolean
          barbershop_id: string
          created_at?: string
          id?: string
          name: string
          points_cost?: number
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          created_at?: string
          id?: string
          name?: string
          points_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          barbershop_id: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          barbershop_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          barbershop_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_breaks: {
        Row: {
          barber_id: string | null
          barbershop_id: string
          created_at: string
          end_time: string
          id: string
          name: string
          specific_date: string | null
          start_time: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          barber_id?: string | null
          barbershop_id: string
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          specific_date?: string | null
          start_time?: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          barber_id?: string | null
          barbershop_id?: string
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          specific_date?: string | null
          start_time?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "schedule_breaks_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_breaks_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          barbershop_id: string
          benefit_kind: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          image_url: string | null
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          barbershop_id: string
          benefit_kind?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_url?: string | null
          name: string
          price_cents?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          benefit_kind?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cycles: {
        Row: {
          barbershop_id: string
          beards_credits: number
          created_at: string
          cuts_credits: number
          extras_credits: number
          id: string
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          barbershop_id: string
          beards_credits?: number
          created_at?: string
          cuts_credits?: number
          extras_credits?: number
          id?: string
          period_end: string
          period_start?: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          barbershop_id?: string
          beards_credits?: number
          created_at?: string
          cuts_credits?: number
          extras_credits?: number
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cycles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          barbershop_id: string
          created_at: string
          cycle_id: string | null
          due_date: string | null
          id: string
          method: string | null
          paid_at: string | null
          status: string
          subscription_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          barbershop_id: string
          created_at?: string
          cycle_id?: string | null
          due_date?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          status?: string
          subscription_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          barbershop_id?: string
          created_at?: string
          cycle_id?: string | null
          due_date?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          status?: string
          subscription_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycle_balances"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "subscription_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          barbershop_id: string
          beards_included: number
          benefits: string | null
          created_at: string
          cuts_included: number
          cycle_days: number
          extras_included: number
          id: string
          name: string
          price_cents: number
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          barbershop_id: string
          beards_included?: number
          benefits?: string | null
          created_at?: string
          cuts_included?: number
          cycle_days?: number
          extras_included?: number
          id?: string
          name: string
          price_cents?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          beards_included?: number
          benefits?: string | null
          created_at?: string
          cuts_included?: number
          cycle_days?: number
          extras_included?: number
          id?: string
          name?: string
          price_cents?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usages: {
        Row: {
          appointment_id: string | null
          barber_id: string | null
          barbershop_id: string
          benefit_kind: string
          created_at: string
          created_by: string | null
          customer_id: string
          cycle_id: string
          id: string
          kind: string
          quantity: number
          reason: string | null
          service_id: string | null
          subscription_id: string
        }
        Insert: {
          appointment_id?: string | null
          barber_id?: string | null
          barbershop_id: string
          benefit_kind: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          cycle_id: string
          id?: string
          kind?: string
          quantity?: number
          reason?: string | null
          service_id?: string | null
          subscription_id: string
        }
        Update: {
          appointment_id?: string | null
          barber_id?: string | null
          barbershop_id?: string
          benefit_kind?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          cycle_id?: string
          id?: string
          kind?: string
          quantity?: number
          reason?: string | null
          service_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycle_balances"
            referencedColumns: ["cycle_id"]
          },
          {
            foreignKeyName: "subscription_usages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      subscription_cycle_balances: {
        Row: {
          barbershop_id: string | null
          beards_credits: number | null
          beards_left: number | null
          beards_used: number | null
          cuts_credits: number | null
          cuts_left: number | null
          cuts_used: number | null
          cycle_id: string | null
          cycle_status: string | null
          extras_credits: number | null
          extras_left: number | null
          extras_used: number | null
          period_end: string | null
          period_start: string | null
          subscription_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cycles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      billing_account_status: { Args: { _shop: string }; Returns: string }
      billing_close_due_cycles: { Args: { _shop?: string }; Returns: number }
      billing_ensure_account: {
        Args: { _shop: string }
        Returns: {
          barbershop_id: string
          created_at: string
          free_quota: number
          free_used: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "billing_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      billing_is_suspended: { Args: { _shop: string }; Returns: boolean }
      billing_mark_invoice_paid: {
        Args: {
          _amount_cents?: number
          _external_id?: string
          _payload?: Json
          _provider?: string
          _reference?: string
          _txid: string
        }
        Returns: Json
      }
      billing_run_daily: { Args: never; Returns: undefined }
      book_appointment: {
        Args: {
          _barber_id: string
          _cpf?: string
          _name: string
          _payment_method?: string
          _phone: string
          _service_id: string
          _slug: string
          _starts_at: string
        }
        Returns: Json
      }
      booked_slots: {
        Args: { _barber_id: string; _day: string; _slug: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      cancel_subscription: {
        Args: { _reason?: string; _subscription_id: string }
        Returns: Json
      }
      complete_appointment: {
        Args: { _appointment_id: string; _payment_method?: string }
        Returns: Json
      }
      create_subscription: {
        Args: { _customer_id: string; _plan_id: string; _shop: string }
        Returns: Json
      }
      customer_by_cpf: { Args: { _cpf: string; _shop: string }; Returns: Json }
      ensure_subscription_cycle: {
        Args: { _subscription_id: string }
        Returns: {
          barbershop_id: string
          beards_credits: number
          created_at: string
          cuts_credits: number
          extras_credits: number
          id: string
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_cycles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_member: { Args: { _shop: string }; Returns: boolean }
      is_shop_admin: { Args: { _shop: string }; Returns: boolean }
      my_billing_overview: { Args: { _shop: string }; Returns: Json }
      public_breaks: {
        Args: { _slug: string }
        Returns: {
          barber_id: string
          end_time: string
          id: string
          name: string
          specific_date: string
          start_time: string
          weekdays: number[]
        }[]
      }
      public_plan_eligibility: {
        Args: { _cpf: string; _service_ids: string[]; _slug: string }
        Returns: Json
      }
      public_shop: {
        Args: { _slug: string }
        Returns: {
          accent_color: string
          address: string
          bg_color: string
          cover_url: string
          description: string
          font_family: string
          has_pix: boolean
          id: string
          instagram: string
          logo_url: string
          name: string
          phone: string
          secondary_color: string
          slug: string
          whatsapp: string
        }[]
      }
      public_shop_accepting: { Args: { _slug: string }; Returns: boolean }
      public_shop_pix: {
        Args: { _slug: string }
        Returns: {
          pix_holder_name: string
          pix_key: string
          pix_key_type: string
        }[]
      }
      refund_appointment_benefit: {
        Args: { _appointment_id: string; _reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "barber" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "barber", "customer"],
    },
  },
} as const
