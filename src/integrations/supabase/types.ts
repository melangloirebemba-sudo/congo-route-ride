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
      agency_branches: {
        Row: {
          address: string | null
          agency_id: string
          city: string | null
          created_at: string
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
          city?: string | null
          created_at?: string
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
          city?: string | null
          created_at?: string
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
      bookings: {
        Row: {
          booking_date: string
          created_at: string
          id: string
          passenger_name: string
          payment_method: string
          payment_status: string
          phone: string
          qr_code: string
          seat_number: number
          status: string
          total_amount: number
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          booking_date?: string
          created_at?: string
          id?: string
          passenger_name: string
          payment_method: string
          payment_status?: string
          phone: string
          qr_code: string
          seat_number: number
          status?: string
          total_amount: number
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          booking_date?: string
          created_at?: string
          id?: string
          passenger_name?: string
          payment_method?: string
          payment_status?: string
          phone?: string
          qr_code?: string
          seat_number?: number
          status?: string
          total_amount?: number
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      notification_channel: ["sms", "whatsapp"],
    },
  },
} as const
