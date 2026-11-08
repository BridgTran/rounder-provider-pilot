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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor: string
          actor_role: string
          created_at: string
          event_type: string
          fund_id: string | null
          id: string
          organisation_id: string
          rule_version: number | null
        }
        Insert: {
          actor: string
          actor_role: string
          created_at?: string
          event_type: string
          fund_id?: string | null
          id?: string
          organisation_id: string
          rule_version?: number | null
        }
        Update: {
          actor?: string
          actor_role?: string
          created_at?: string
          event_type?: string
          fund_id?: string | null
          id?: string
          organisation_id?: string
          rule_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      australian_universities: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          fund_id: string | null
          id: string
          organisation_id: string | null
          provider_id: string
          rule_version: number | null
          status: string
          student_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          fund_id?: string | null
          id?: string
          organisation_id?: string | null
          provider_id: string
          rule_version?: number | null
          status?: string
          student_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          fund_id?: string | null
          id?: string
          organisation_id?: string | null
          provider_id?: string
          rule_version?: number | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invites: {
        Row: {
          accepted_at: string | null
          created_by: string
          email: string
          expires_at: string
          id: string
          organisation_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_by: string
          email: string
          expires_at?: string
          id?: string
          organisation_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          organisation_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          member_role: string
          organisation_id: string
          user_id: string
        }
        Insert: {
          member_role?: string
          organisation_id: string
          user_id: string
        }
        Update: {
          member_role?: string
          organisation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          contact_person: string
          created_at: string
          id: string
          organisation_id: string | null
          organisation_name: string
        }
        Insert: {
          contact_person?: string
          created_at?: string
          id: string
          organisation_id?: string | null
          organisation_name?: string
        }
        Update: {
          contact_person?: string
          created_at?: string
          id?: string
          organisation_id?: string | null
          organisation_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_credits: {
        Row: {
          balance: number
          provider_id: string
        }
        Insert: {
          balance?: number
          provider_id: string
        }
        Update: {
          balance?: number
          provider_id?: string
        }
        Relationships: []
      }
      provider_organisations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      scholarship_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          fund_id: string
          id: string
          provider_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          fund_id: string
          id?: string
          provider_id: string
          snapshot: Json
          version: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          fund_id?: string
          id?: string
          provider_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_audit_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_rule_versions: {
        Row: {
          created_at: string
          fund_id: string
          id: string
          provider_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          fund_id: string
          id?: string
          provider_id: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          fund_id?: string
          id?: string
          provider_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_rule_versions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          created_at: string
          deed_confirmed_at: string | null
          deed_path: string | null
          discipline: string
          finalist_requirements: string[]
          id: string
          life_load: string[]
          location: string
          maximum_award_value: number | null
          min_empathy: number
          min_resilience: number
          org_class: string
          organisation_id: string | null
          provider_id: string
          rule_version: number
          rules: Json
          status: string
          stipend_aud: number | null
          title: string
        }
        Insert: {
          created_at?: string
          deed_confirmed_at?: string | null
          deed_path?: string | null
          discipline?: string
          finalist_requirements?: string[]
          id?: string
          life_load?: string[]
          location?: string
          maximum_award_value?: number | null
          min_empathy?: number
          min_resilience?: number
          org_class?: string
          organisation_id?: string | null
          provider_id: string
          rule_version?: number
          rules?: Json
          status?: string
          stipend_aud?: number | null
          title: string
        }
        Update: {
          created_at?: string
          deed_confirmed_at?: string | null
          deed_path?: string | null
          discipline?: string
          finalist_requirements?: string[]
          id?: string
          life_load?: string[]
          location?: string
          maximum_award_value?: number | null
          min_empathy?: number
          min_resilience?: number
          org_class?: string
          organisation_id?: string | null
          provider_id?: string
          rule_version?: number
          rules?: Json
          status?: string
          stipend_aud?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "provider_organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_eligibility: {
        Row: {
          campus_state: string | null
          centrelink_concession: boolean | null
          degree_level: string | null
          first_generation: boolean | null
          first_undergraduate_degree: boolean | null
          gender: string | null
          household_income: number | null
          institution: string | null
          postcode: string | null
          region: string | null
          state: string | null
          student_id: string
          years_completed: number | null
        }
        Insert: {
          campus_state?: string | null
          centrelink_concession?: boolean | null
          degree_level?: string | null
          first_generation?: boolean | null
          first_undergraduate_degree?: boolean | null
          gender?: string | null
          household_income?: number | null
          institution?: string | null
          postcode?: string | null
          region?: string | null
          state?: string | null
          student_id: string
          years_completed?: number | null
        }
        Update: {
          campus_state?: string | null
          centrelink_concession?: boolean | null
          degree_level?: string | null
          first_generation?: boolean | null
          first_undergraduate_degree?: boolean | null
          gender?: string | null
          household_income?: number | null
          institution?: string | null
          postcode?: string | null
          region?: string | null
          state?: string | null
          student_id?: string
          years_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_eligibility_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_identities: {
        Row: {
          email: string
          legal_name: string
          phone: string
          student_id: string
          transcript_url: string
        }
        Insert: {
          email: string
          legal_name: string
          phone: string
          student_id: string
          transcript_url: string
        }
        Update: {
          email?: string
          legal_name?: string
          phone?: string
          student_id?: string
          transcript_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_identities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_invites: {
        Row: {
          consent_version: string | null
          consented_at: string | null
          created_at: string
          expires_at: string
          id: string
          provider_id: string
          student_id: string | null
          token_hash: string
        }
        Insert: {
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider_id: string
          student_id?: string | null
          token_hash: string
        }
        Update: {
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider_id?: string
          student_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_invites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          adaptability: number
          birth_year: number
          candidate_code: string
          client_empathy: number
          crisis_management: number
          degree: string
          degree_title: string
          discipline: string
          endorsement: string
          endorser: string
          equity_tags: string[]
          id: string
          org_mask: string
          pressure_resilience: number
          program: string
          raw_gpa: number
          study_load: number
          study_mode: string
          traits: string[]
          uni: string
          verified_centrelink: boolean
          verified_low_ses: boolean
          visa_status: string
          weekly_hours: number
          work_sector: string
          year_label: string
          year_level: number
        }
        Insert: {
          adaptability: number
          birth_year: number
          candidate_code: string
          client_empathy: number
          crisis_management: number
          degree: string
          degree_title: string
          discipline: string
          endorsement?: string
          endorser?: string
          equity_tags?: string[]
          id?: string
          org_mask?: string
          pressure_resilience: number
          program?: string
          raw_gpa: number
          study_load: number
          study_mode: string
          traits?: string[]
          uni: string
          verified_centrelink?: boolean
          verified_low_ses?: boolean
          visa_status: string
          weekly_hours: number
          work_sector: string
          year_label: string
          year_level: number
        }
        Update: {
          adaptability?: number
          birth_year?: number
          candidate_code?: string
          client_empathy?: number
          crisis_management?: number
          degree?: string
          degree_title?: string
          discipline?: string
          endorsement?: string
          endorser?: string
          equity_tags?: string[]
          id?: string
          org_mask?: string
          pressure_resilience?: number
          program?: string
          raw_gpa?: number
          study_load?: number
          study_mode?: string
          traits?: string[]
          uni?: string
          verified_centrelink?: boolean
          verified_low_ses?: boolean
          visa_status?: string
          weekly_hours?: number
          work_sector?: string
          year_label?: string
          year_level?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      accept_match: { Args: { p_candidate_code: string }; Returns: undefined }
      accept_organisation_invite: {
        Args: { p_token: string }
        Returns: undefined
      }
      create_organisation_invite: {
        Args: { p_email: string; p_hash: string }
        Returns: undefined
      }
      create_student_invite: { Args: { p_token_hash: string }; Returns: string }
      eligible_scholarship_students: {
        Args: { p_discipline: string; p_life_load: string[]; p_rules: Json }
        Returns: {
          student_id: string
        }[]
      }
      evaluate_fund_rules: {
        Args: {
          p_discipline: string
          p_life_load: string[]
          p_rules: Json
          p_student: string
        }
        Returns: {
          met: boolean
          preferred: boolean
          rule_key: string
        }[]
      }
      fund_eligibility_results: {
        Args: { p_discipline: string; p_life_load: string[]; p_rules: Json }
        Returns: {
          preferences_met: number
          preferences_total: number
          student_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_organisation_member: { Args: { p_org: string }; Returns: boolean }
      list_student_requests: {
        Args: never
        Returns: {
          candidate_code: string
          organisation: string
          program: string
          status: string
        }[]
      }
      request_fund_unlock: {
        Args: { p_fund_id: string; p_student_id: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          fund_id: string | null
          id: string
          organisation_id: string | null
          provider_id: string
          rule_version: number | null
          status: string
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_match: {
        Args: { p_student_id: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          fund_id: string | null
          id: string
          organisation_id: string | null
          provider_id: string
          rule_version: number | null
          status: string
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_scholarship_rules: {
        Args: {
          p_activate: boolean
          p_confirmed: boolean
          p_expected_version: number
          p_fund_id: string
          p_input: Json
        }
        Returns: Json
      }
      save_scholarship_rules_internal: {
        Args: {
          p_activate: boolean
          p_confirmed: boolean
          p_expected_version: number
          p_fund_id: string
          p_input: Json
        }
        Returns: Json
      }
      student_invite_action: {
        Args: { p_action: string; p_payload?: Json; p_token: string }
        Returns: Json
      }
      top_up_credits: { Args: { p_amount: number }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "provider"
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
      app_role: ["admin", "provider"],
    },
  },
} as const
