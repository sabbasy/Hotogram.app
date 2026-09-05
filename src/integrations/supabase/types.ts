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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          restaurant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          restaurant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          restaurant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          consent_given: boolean
          consent_timestamp: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          order_id: string
          phone: string | null
          restaurant_id: string
          total_spend: number
          visit_count: number
        }
        Insert: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          order_id: string
          phone?: string | null
          restaurant_id: string
          total_spend?: number
          visit_count?: number
        }
        Update: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          order_id?: string
          phone?: string | null
          restaurant_id?: string
          total_spend?: number
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          request_type: Database["public"]["Enums"]["request_type"]
          restaurant_id: string
          status: Database["public"]["Enums"]["request_status"]
          table_id: string | null
          table_number: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          request_type: Database["public"]["Enums"]["request_type"]
          restaurant_id: string
          status?: Database["public"]["Enums"]["request_status"]
          table_id?: string | null
          table_number: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          request_type?: Database["public"]["Enums"]["request_type"]
          restaurant_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          table_id?: string | null
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          restaurant_id: string
          tag: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          tag: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          invoice_number: string
          order_id: string
          restaurant_id: string
          sent_to: string | null
          sent_via: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_number: string
          order_id: string
          restaurant_id: string
          sent_to?: string | null
          sent_via?: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_number?: string
          order_id?: string
          restaurant_id?: string
          sent_to?: string | null
          sent_via?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number | null
          updated_at: string
          preparation_time_minutes: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string
          preparation_time_minutes?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string
          preparation_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          item_price: number
          menu_item_id: string | null
          order_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          item_price: number
          menu_item_id?: string | null
          order_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          item_price?: number
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_items: Json | null
          closed_at: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string | null
          preparing_at: string | null
          ready_at: string | null
          restaurant_id: string
          served_at: string | null
          session_id: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          table_id: string | null
          table_number: string
          tax_amount: number
          total_amount: number | null
          updated_at: string
          voice_note_listened: boolean
          voice_note_url: string | null
        }
        Insert: {
          accepted_at?: string | null
          cancelled_items?: Json | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          restaurant_id: string
          served_at?: string | null
          session_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          table_id?: string | null
          table_number: string
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
          voice_note_listened?: boolean
          voice_note_url?: string | null
        }
        Update: {
          accepted_at?: string | null
          cancelled_items?: Json | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          restaurant_id?: string
          served_at?: string | null
          session_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          table_id?: string | null
          table_number?: string
          tax_amount?: number
          total_amount?: number | null
          updated_at?: string
          voice_note_listened?: boolean
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          confirmed_by: string | null
          created_at: string
          customer_vpa: string | null
          id: string
          initiated_at: string
          notes: string | null
          order_id: string | null
          payment_method: string
          restaurant_id: string
          session_id: string | null
          status: string
          transaction_id: string
          updated_at: string
          upi_reference: string | null
          verified_at: string | null
        }
        Insert: {
          amount: number
          confirmed_by?: string | null
          created_at?: string
          customer_vpa?: string | null
          id?: string
          initiated_at?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          restaurant_id: string
          session_id?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
          upi_reference?: string | null
          verified_at?: string | null
        }
        Update: {
          amount?: number
          confirmed_by?: string | null
          created_at?: string
          customer_vpa?: string | null
          id?: string
          initiated_at?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          restaurant_id?: string
          session_id?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          upi_reference?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          qr_code_token: string
          restaurant_id: string
          status: Database["public"]["Enums"]["table_status"]
          table_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          qr_code_token?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["table_status"]
          table_number: string
        }
        Update: {
          created_at?: string
          id?: string
          qr_code_token?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["table_status"]
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          cuisine_type: string | null
          currency: string | null
          email: string
          feature_analytics: boolean
          feature_customer_export: boolean
          feature_voice_notes: boolean
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string
          status: Database["public"]["Enums"]["restaurant_status"] | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          tax_percentage: number
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          email: string
          feature_analytics?: boolean
          feature_customer_export?: boolean
          feature_voice_notes?: boolean
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone: string
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          tax_percentage?: number
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          email?: string
          feature_analytics?: boolean
          feature_customer_export?: boolean
          feature_voice_notes?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          tax_percentage?: number
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          payment_status: string
          restaurant_id: string
          session_token: string
          status: string
          table_id: string
          total_amount: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          payment_status?: string
          restaurant_id: string
          session_token?: string
          status?: string
          table_id: string
          total_amount?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          payment_status?: string
          restaurant_id?: string
          session_token?: string
          status?: string
          table_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
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
      get_public_restaurant_info: {
        Args: { _restaurant_id: string }
        Returns: {
          address: string
          cuisine_type: string
          currency: string
          feature_voice_notes: boolean
          id: string
          logo_url: string
          name: string
          status: Database["public"]["Enums"]["restaurant_status"]
          tax_percentage: number
          upi_id: string
        }[]
      }
      has_restaurant_access: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_active: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      upsert_customer_contact: {
        Args: {
          p_consent_given?: boolean
          p_email?: string
          p_name?: string
          p_order_id: string
          p_phone?: string
          p_restaurant_id: string
          p_total_spend?: number
        }
        Returns: string
      }
      validate_qr_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "platform_admin"
        | "restaurant_admin"
        | "kitchen_staff"
        | "waiter"
        | "cashier"
      order_status: "new" | "preparing" | "ready" | "served" | "cancelled"
      payment_method: "upi" | "counter" | "none"
      payment_status: "pending" | "paid"
      request_status: "pending" | "handled"
      request_type: "call_waiter" | "request_water" | "request_bill"
      restaurant_status: "pending" | "active" | "disabled"
      subscription_plan: "free" | "basic" | "pro"
      table_status: "vacant" | "occupied" | "billing" | "closed"
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
      app_role: [
        "platform_admin",
        "restaurant_admin",
        "kitchen_staff",
        "waiter",
        "cashier",
      ],
      order_status: ["new", "preparing", "ready", "served", "cancelled"],
      payment_method: ["upi", "counter", "none"],
      payment_status: ["pending", "paid"],
      request_status: ["pending", "handled"],
      request_type: ["call_waiter", "request_water", "request_bill"],
      restaurant_status: ["pending", "active", "disabled"],
      subscription_plan: ["free", "basic", "pro"],
      table_status: ["vacant", "occupied", "billing", "closed"],
    },
  },
} as const
