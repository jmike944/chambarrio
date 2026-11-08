// Generated from the Supabase project (hggxrdwjnvhuymkaqiwo) schema. Regenerate after migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      // Hiring pipeline (20261107233000): the timeline, written only by a trigger; readable by the
      // candidate and the vacancy's company.
      application_events: {
        Row: { actor: "candidato" | "empresa"; application_id: string; created_at: string; id: number; interview_at: string | null; status: E["application_status"] };
        Insert: { actor: "candidato" | "empresa"; application_id: string; created_at?: string; id?: never; interview_at?: string | null; status: E["application_status"] };
        Update: { actor?: "candidato" | "empresa"; application_id?: string; created_at?: string; id?: never; interview_at?: string | null; status?: E["application_status"] };
        Relationships: [
          { foreignKeyName: "application_events_application_id_fkey"; columns: ["application_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["id"] },
        ];
      };
      // Private recruiter notes: read / insert / delete-own by the vacancy's company only.
      application_notes: {
        Row: { application_id: string; author_id: string; body: string; created_at: string; id: string };
        Insert: { application_id: string; author_id?: string; body: string; created_at?: string; id?: string };
        Update: { application_id?: string; author_id?: string; body?: string; created_at?: string; id?: string };
        Relationships: [
          { foreignKeyName: "application_notes_application_id_fkey"; columns: ["application_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["id"] },
        ];
      };
      applications: {
        Row: {
          candidate_id: string;
          closed_at: string | null;
          closed_by: "empresa" | "candidato" | null;
          company_message: string | null;
          created_at: string;
          hired_at: string | null;
          id: string;
          interview_at: string | null;
          interview_note: string | null;
          interview_place: string | null;
          job_id: string;
          seen_at: string | null;
          status: E["application_status"];
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          closed_at?: string | null;
          closed_by?: "empresa" | "candidato" | null;
          company_message?: string | null;
          created_at?: string;
          hired_at?: string | null;
          id?: string;
          interview_at?: string | null;
          interview_note?: string | null;
          interview_place?: string | null;
          job_id: string;
          seen_at?: string | null;
          status?: E["application_status"];
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          closed_at?: string | null;
          closed_by?: "empresa" | "candidato" | null;
          company_message?: string | null;
          created_at?: string;
          hired_at?: string | null;
          id?: string;
          interview_at?: string | null;
          interview_note?: string | null;
          interview_place?: string | null;
          job_id?: string;
          seen_at?: string | null;
          status?: E["application_status"];
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "applications_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ];
      };
      branches: {
        Row: { colonia: string; company_id: string; created_at: string; id: string; location: unknown; name: string; sort: number };
        Insert: { colonia: string; company_id: string; created_at?: string; id?: string; location: unknown; name: string; sort?: number };
        Update: { colonia?: string; company_id?: string; created_at?: string; id?: string; location?: unknown; name?: string; sort?: number };
        Relationships: [
          { foreignKeyName: "branches_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
      };
      companies: {
        Row: {
          about: string;
          created_at: string;
          employees: string;
          id: string;
          kind: string;
          name: string;
          owner_id: string | null;
          phone: string | null;
          plan: E["plan_id"];
          size: E["company_size"];
          verified: boolean;
        };
        Insert: {
          about?: string;
          created_at?: string;
          employees?: string;
          id?: string;
          kind?: string;
          name: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: E["plan_id"];
          size?: E["company_size"];
          verified?: boolean;
        };
        Update: {
          about?: string;
          created_at?: string;
          employees?: string;
          id?: string;
          kind?: string;
          name?: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: E["plan_id"];
          size?: E["company_size"];
          verified?: boolean;
        };
        Relationships: [];
      };
      job_unlocks: {
        Row: { company_id: string; created_at: string; job_id: string; unlocked_until: string };
        Insert: { company_id: string; created_at?: string; job_id: string; unlocked_until: string };
        Update: { company_id?: string; created_at?: string; job_id?: string; unlocked_until?: string };
        Relationships: [
          { foreignKeyName: "job_unlocks_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "job_unlocks_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ];
      };
      jobs: {
        Row: {
          benefits: string[];
          branch_id: string;
          category: E["category_id"];
          company_id: string;
          created_at: string;
          description: string;
          experience: E["experience_level"];
          id: string;
          openings: number;
          pay: number;
          pay_max: number | null;
          period: E["pay_period"];
          phone: string | null;
          requirements: string[];
          schedule: string;
          shift: E["shift"];
          status: E["job_status"];
          title: string;
          type: E["employment_type"];
          updated_at: string;
          urgent: boolean;
        };
        Insert: {
          benefits?: string[];
          branch_id: string;
          category: E["category_id"];
          company_id: string;
          created_at?: string;
          description?: string;
          experience?: E["experience_level"];
          id?: string;
          openings?: number;
          pay: number;
          pay_max?: number | null;
          period?: E["pay_period"];
          phone?: string | null;
          requirements?: string[];
          schedule?: string;
          shift: E["shift"];
          status?: E["job_status"];
          title: string;
          type?: E["employment_type"];
          updated_at?: string;
          urgent?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "jobs_branch_id_company_id_fkey"; columns: ["branch_id", "company_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id", "company_id"] },
          { foreignKeyName: "jobs_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          colonia: string | null;
          created_at: string;
          email: string | null;
          email_alerts: boolean;
          email_updates: boolean;
          experience: E["experience_level"];
          home: unknown;
          id: string;
          interests: E["category_id"][];
          location_source: E["location_source"];
          name: string;
          onboarded: boolean;
          phone: string | null;
          radius_km: number;
          headline: string | null;
          about: string | null;
          education: E["education_level"] | null;
          skills: string[];
          certifications: string[];
          languages: string[];
          shifts: E["shift"][];
          available_from: E["start_availability"] | null;
          transport: string[];
          expected_pay: number | null;
          expected_period: E["pay_period"] | null;
          avatar_path: string | null;
          cv_path: string | null;
          /** 20261108000000_avatar_config.sql (app AvatarConfig; absent from `select *` until applied). */
          avatar_config: Json | null;
          role: E["app_role"];
          unsubscribe_token: string;
          updated_at: string;
        };
        Insert: {
          colonia?: string | null;
          created_at?: string;
          email?: string | null;
          email_alerts?: boolean;
          email_updates?: boolean;
          experience?: E["experience_level"];
          home?: unknown;
          id: string;
          interests?: E["category_id"][];
          location_source?: E["location_source"];
          name?: string;
          onboarded?: boolean;
          phone?: string | null;
          radius_km?: number;
          headline?: string | null;
          about?: string | null;
          education?: E["education_level"] | null;
          skills?: string[];
          certifications?: string[];
          languages?: string[];
          shifts?: E["shift"][];
          available_from?: E["start_availability"] | null;
          transport?: string[];
          expected_pay?: number | null;
          expected_period?: E["pay_period"] | null;
          avatar_path?: string | null;
          cv_path?: string | null;
          avatar_config?: Json | null;
          role?: E["app_role"];
          unsubscribe_token?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      work_experiences: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          company: string | null;
          category: E["category_id"] | null;
          start_month: string | null;
          end_month: string | null;
          is_current: boolean;
          description: string | null;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          title: string;
          company?: string | null;
          category?: E["category_id"] | null;
          start_month?: string | null;
          end_month?: string | null;
          is_current?: boolean;
          description?: string | null;
          sort?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_experiences"]["Insert"]>;
        Relationships: [];
      };
      saved_jobs: {
        Row: { candidate_id: string; created_at: string; job_id: string };
        Insert: { candidate_id: string; created_at?: string; job_id: string };
        Update: { candidate_id?: string; created_at?: string; job_id?: string };
        Relationships: [
          { foreignKeyName: "saved_jobs_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      branches_view: {
        Row: { colonia: string | null; company_id: string | null; id: string | null; lat: number | null; lng: number | null; name: string | null; sort: number | null };
        Relationships: [
          { foreignKeyName: "branches_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
      };
    };
    Functions: {
      add_branch: { Args: { lat: number; lng: number; p_colonia: string; p_company_id: string; p_name: string }; Returns: string };
      is_company_owner: { Args: { cid: string }; Returns: boolean };
      /** The signed-in user owns the company of this application's vacancy. */
      owns_application: { Args: { p_app: string }; Returns: boolean };
      job_applicants: {
        Args: { p_job_id: string };
        Returns: {
          application_id: string;
          applied_at: string;
          colonia: string;
          experience: E["experience_level"];
          interests: E["category_id"][];
          km: number;
          name: string;
          phone: string;
          status: E["application_status"];
          unlocked: boolean;
        }[];
      };
      jobs_near: {
        Args: { lat: number; lng: number; radius_km?: number };
        Returns: {
          applicants: number;
          bearing: number;
          benefits: string[];
          branch_id: string;
          branch_lat: number;
          branch_lng: number;
          branch_name: string;
          category: E["category_id"];
          colonia: string;
          company_id: string;
          company_name: string;
          company_verified: boolean;
          created_at: string;
          description: string;
          experience: E["experience_level"];
          id: string;
          km: number;
          openings: number;
          pay: number;
          pay_max: number;
          period: E["pay_period"];
          phone: string;
          requirements: string[];
          schedule: string;
          shift: E["shift"];
          title: string;
          type: E["employment_type"];
          urgent: boolean;
        }[];
      };
      job_applicants_detail: {
        Args: { p_job_id: string };
        Returns: {
          application_id: string;
          status: E["application_status"];
          applied_at: string;
          colonia: string;
          km: number;
          unlocked: boolean;
          strength: number;
          profile: Json;
          experiences: Json;
          contact: Json | null;
        }[];
      };
      profile_strength: { Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }; Returns: number };
      unsubscribe_email: { Args: { p_token: string; p_kind?: string }; Returns: boolean };
      set_my_home: {
        Args: { lat: number; lng: number; p_colonia: string; p_source?: E["location_source"] };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "candidato" | "empresa";
      application_status: "enviada" | "vista" | "entrevista" | "contratada" | "cerrada";
      category_id:
        | "produccion"
        | "almacen"
        | "montacargas"
        | "chofer"
        | "restaurante"
        | "caja"
        | "ventas"
        | "limpieza"
        | "mantenimiento"
        | "seguridad"
        | "oficina"
        | "construccion";
      company_size: "Micro" | "Pequeña" | "Mediana" | "Grande";
      education_level: "primaria" | "secundaria" | "preparatoria" | "tecnico" | "licenciatura";
      start_availability: "inmediata" | "1_semana" | "2_semanas" | "1_mes";
      employment_type: "Tiempo completo" | "Medio tiempo" | "Temporal" | "Fines de semana";
      experience_level: "Sin experiencia" | "6 meses" | "1 año" | "2 años o más";
      job_status: "abierta" | "pausada" | "cerrada";
      location_source: "colonia" | "gps";
      pay_period: "semana" | "quincena" | "mes" | "dia";
      plan_id: "por-vacante" | "pyme" | "industrial";
      shift: "Matutino" | "Vespertino" | "Nocturno" | "Mixto" | "Rotativo";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type NearJob = Database["public"]["Functions"]["jobs_near"]["Returns"][number];
