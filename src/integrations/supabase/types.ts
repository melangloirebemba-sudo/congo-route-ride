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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          metadata: Json
          status: string
          target_email: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          status?: string
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          status?: string
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      agencies: {
        Row: {
          address: string | null
          commission_rate: number | null
          created_at: string
          email: string | null
          id: string
          is_popular: boolean
          logo: string | null
          name: string
          owner_id: string | null
          phone: string | null
          popularity_rank: number | null
          rating: number | null
          status: string
          total_trips: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_popular?: boolean
          logo?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          popularity_rank?: number | null
          rating?: number | null
          status?: string
          total_trips?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_popular?: boolean
          logo?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          popularity_rank?: number | null
          rating?: number | null
          status?: string
          total_trips?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          agency_id: string | null
          branch_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      agency_branches: {
        Row: {
          address: string | null
          agency_id: string
          can_create_trips: boolean
          can_scan: boolean
          can_sell_counter: boolean
          can_view_stats: boolean
          city: string | null
          created_at: string
          district: string | null
          id: string
          manager_name: string | null
          name: string
          parent_branch_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          can_create_trips?: boolean
          can_scan?: boolean
          can_sell_counter?: boolean
          can_view_stats?: boolean
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          manager_name?: string | null
          name: string
          parent_branch_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          can_create_trips?: boolean
          can_scan?: boolean
          can_sell_counter?: boolean
          can_view_stats?: boolean
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          parent_branch_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_branches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_reports: {
        Row: {
          agency_id: string
          attachments: Json
          branch_id: string
          category: string
          created_at: string
          id: string
          message: string
          owner_notes: string | null
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          attachments?: Json
          branch_id: string
          category?: string
          created_at?: string
          id?: string
          message: string
          owner_notes?: string | null
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attachments?: Json
          branch_id?: string
          category?: string
          created_at?: string
          id?: string
          message?: string
          owner_notes?: string | null
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          boarded_at: string | null
          boarded_by: string | null
          boarding_branch_id: string | null
          boarding_notes: string | null
          boarding_status: Database["public"]["Enums"]["boarding_status"]
          booking_date: string
          created_at: string
          id: string
          passenger_name: string
          payment_deadline: string | null
          payment_method: string
          payment_status: string
          phone: string
          qr_code: string
          sale_channel: string
          seat_number: number
          status: string
          total_amount: number
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          boarded_at?: string | null
          boarded_by?: string | null
          boarding_branch_id?: string | null
          boarding_notes?: string | null
          boarding_status?: Database["public"]["Enums"]["boarding_status"]
          booking_date?: string
          created_at?: string
          id?: string
          passenger_name: string
          payment_deadline?: string | null
          payment_method: string
          payment_status?: string
          phone: string
          qr_code: string
          sale_channel?: string
          seat_number: number
          status?: string
          total_amount: number
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          boarded_at?: string | null
          boarded_by?: string | null
          boarding_branch_id?: string | null
          boarding_notes?: string | null
          boarding_status?: Database["public"]["Enums"]["boarding_status"]
          booking_date?: string
          created_at?: string
          id?: string
          passenger_name?: string
          payment_deadline?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string
          qr_code?: string
          sale_channel?: string
          seat_number?: number
          status?: string
          total_amount?: number
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_boarding_branch_id_fkey"
            columns: ["boarding_branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_managers: {
        Row: {
          agency_id: string
          branch_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_managers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_managers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_notifications: {
        Row: {
          agency_id: string
          archived_at: string | null
          booking_id: string | null
          branch_id: string
          broadcast_id: string | null
          created_at: string
          id: string
          kind: string
          message: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          agency_id: string
          archived_at?: string | null
          booking_id?: string | null
          branch_id: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          agency_id?: string
          archived_at?: string | null
          booking_id?: string | null
          branch_id?: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      city_districts: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          cancellation_alerts: boolean
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          trip_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_alerts?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          trip_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_alerts?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          trip_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      passenger_notifications: {
        Row: {
          agency_id: string | null
          boarding_date: string | null
          boarding_location: string | null
          boarding_time: string | null
          booking_id: string | null
          branch_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          title: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          boarding_date?: string | null
          boarding_location?: string | null
          boarding_time?: string | null
          booking_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string | null
          boarding_date?: string | null
          boarding_location?: string | null
          boarding_time?: string | null
          booking_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      scheduled_boarding_broadcasts: {
        Row: {
          agency_id: string
          branch_id: string
          created_at: string
          created_by: string
          extra_message: string | null
          failure_reason: string | null
          id: string
          recipients_count: number | null
          scheduled_at: string
          sent_at: string | null
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          branch_id: string
          created_at?: string
          created_by: string
          extra_message?: string | null
          failure_reason?: string | null
          id?: string
          recipients_count?: number | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          branch_id?: string
          created_at?: string
          created_by?: string
          extra_message?: string | null
          failure_reason?: string | null
          id?: string
          recipients_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_boarding_broadcasts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_boarding_broadcasts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_boarding_broadcasts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_broadcasts: {
        Row: {
          agency_id: string
          broadcast_id: string | null
          created_at: string
          created_by: string
          error: string | null
          failure_reason: string | null
          fully_read_at: string | null
          id: string
          kind: string
          message: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          target_branch_ids: string[]
          updated_at: string
        }
        Insert: {
          agency_id: string
          broadcast_id?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          failure_reason?: string | null
          fully_read_at?: string | null
          id?: string
          kind: string
          message: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject: string
          target_branch_ids?: string[]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          broadcast_id?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          failure_reason?: string | null
          fully_read_at?: string | null
          id?: string
          kind?: string
          message?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          target_branch_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_broadcasts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_locks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          locked_by: string
          seat_number: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          locked_by: string
          seat_number: number
          trip_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          locked_by?: string
          seat_number?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_locks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agency_id: string | null
          amount: number
          booking_id: string | null
          commission: number
          created_at: string
          id: string
          net_amount: number
          payment_method: string
          status: string
        }
        Insert: {
          agency_id?: string | null
          amount: number
          booking_id?: string | null
          commission?: number
          created_at?: string
          id?: string
          net_amount?: number
          payment_method: string
          status?: string
        }
        Update: {
          agency_id?: string | null
          amount?: number
          booking_id?: string | null
          commission?: number
          created_at?: string
          id?: string
          net_amount?: number
          payment_method?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_branches: {
        Row: {
          branch_id: string
          created_at: string
          trip_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          trip_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_branches_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          agency_id: string
          arrival_time: string
          available_seats: number
          branch_id: string | null
          bus_type: string | null
          created_at: string
          currency: string
          date: string
          departure: string
          departure_time: string
          destination: string
          id: string
          price: number
          status: string
          total_seats: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          arrival_time: string
          available_seats: number
          branch_id?: string | null
          bus_type?: string | null
          created_at?: string
          currency?: string
          date: string
          departure: string
          departure_time: string
          destination: string
          id?: string
          price: number
          status?: string
          total_seats: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          arrival_time?: string
          available_seats?: number
          branch_id?: string | null
          bus_type?: string | null
          created_at?: string
          currency?: string
          date?: string
          departure?: string
          departure_time?: string
          destination?: string
          id?: string
          price?: number
          status?: string
          total_seats?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agency_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _actor_role: { Args: { _uid: string }; Returns: string }
      broadcast_boarding_info: {
        Args: { _extra_message?: string; _trip_id: string }
        Returns: Json
      }
      check_in_booking: { Args: { _booking_id: string }; Returns: Json }
      claim_booking_by_ref: {
        Args: { _phone: string; _qr: string }
        Returns: Json
      }
      dispatch_scheduled_boarding_broadcasts: { Args: never; Returns: number }
      dispatch_scheduled_broadcasts: { Args: never; Returns: number }
      get_branch_permissions: { Args: { _user_id: string }; Returns: Json }
      get_manager_agency: { Args: { _user_id: string }; Returns: string }
      get_manager_branch: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency_owner: { Args: { _agency_id: string }; Returns: boolean }
      is_branch_manager_of: { Args: { _agency_id: string }; Returns: boolean }
      lock_seat: {
        Args: { _seat_number: number; _trip_id: string; _ttl_seconds?: number }
        Returns: Json
      }
      refuse_boarding: {
        Args: { _booking_id: string; _reason?: string }
        Returns: Json
      }
      release_seat: {
        Args: { _seat_number: number; _trip_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      boarding_status: "pending" | "boarded" | "refused"
      notification_channel: "sms" | "whatsapp"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
      boarding_status: ["pending", "boarded", "refused"],
      notification_channel: ["sms", "whatsapp"],
    },
  },
} as const
