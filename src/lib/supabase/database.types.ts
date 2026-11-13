// Generated from the Supabase project (hggxrdwjnvhuymkaqiwo) schema. Regenerate after migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];
/** application_events.change (check constraint, not an enum). */
type EventChange = "hora" | "lugar" | "indicaciones" | "mensaje" | "reabierta";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      // Hiring pipeline (20261107223917): the timeline, written only by a trigger; readable by the
      // candidate and the vacancy's company.
      application_events: {
        // change / message: 20261108041400_pipeline_notify_v3.sql (not applied yet; live.ts falls back without them).
        // actor_user_id: 20261108172838_team_accounts.sql (the team member behind a company-side step; null for the candidate's own).
        // NOT selectable by `authenticated` (column grants keep member ids from candidates): read it with rpc("application_event_actors").
        Row: { actor: "candidato" | "empresa"; actor_user_id: string | null; application_id: string; change: EventChange | null; created_at: string; id: number; interview_at: string | null; message: string | null; status: E["application_status"] };
        Insert: { actor: "candidato" | "empresa"; actor_user_id?: string | null; application_id: string; change?: EventChange | null; created_at?: string; id?: never; interview_at?: string | null; message?: string | null; status: E["application_status"] };
        Update: { actor?: "candidato" | "empresa"; actor_user_id?: string | null; application_id?: string; change?: EventChange | null; created_at?: string; id?: never; interview_at?: string | null; message?: string | null; status?: E["application_status"] };
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
          /** 20261112230000_curated_jobs.sql: when someone claimed a company Chambarrio had published. */
          claimed_at?: string | null;
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
      // Team accounts (20261108172838): read-only for members (RLS); written only by the team RPCs.
      // company_invites is service-role / RPC only and deliberately not typed here.
      company_members: {
        Row: { branch_ids: string[] | null; company_id: string; created_at: string; invited_by: string | null; role: E["team_role"]; user_id: string };
        Insert: { branch_ids?: string[] | null; company_id: string; created_at?: string; invited_by?: string | null; role: E["team_role"]; user_id: string };
        Update: { branch_ids?: string[] | null; company_id?: string; created_at?: string; invited_by?: string | null; role?: E["team_role"]; user_id?: string };
        Relationships: [
          { foreignKeyName: "company_members_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
        ];
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
          // 20261112230000_curated_jobs.sql (optional: absent until it's applied). Written only by
          // Chambarrio (trigger guard_job_source ignores them from the app).
          source?: E["job_source"];
          source_label?: string | null;
          source_url?: string | null;
          checked_at?: string | null;
          expires_at?: string | null;
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
          /** 20261108002840_avatar_config.sql (app AvatarConfig; absent from `select *` until applied). */
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
      /** Since 20261108172838: the caller is a dueño of the company (kept for compatibility). */
      is_company_owner: { Args: { cid: string }; Returns: boolean };
      /** The caller is a team member whose branch scope includes this application's vacancy (never their own application). */
      owns_application: { Args: { p_app: string }; Returns: boolean };
      // ---- team accounts (20261108172838_team_accounts.sql)
      company_role: { Args: { p_company_id: string }; Returns: E["team_role"] | null };
      is_company_member: { Args: { p_company_id: string; p_min_role?: E["team_role"] }; Returns: boolean };
      can_see_branch: { Args: { p_company_id: string; p_branch_id: string }; Returns: boolean };
      can_see_job: { Args: { p_job_id: string }; Returns: boolean };
      my_membership: {
        Args: Record<PropertyKey, never>;
        Returns: { company_id: string; company_name: string; plan: E["plan_id"]; role: E["team_role"]; branch_ids: string[] | null; joined_at: string }[];
      };
      team_members: {
        Args: { p_company_id: string };
        Returns: { user_id: string; role: E["team_role"]; branch_ids: string[] | null; name: string; email: string | null; joined_at: string; invited_by: string | null; is_me: boolean }[];
      };
      team_invites: {
        Args: { p_company_id: string };
        Returns: { id: string; email: string; role: E["team_role"]; branch_ids: string[] | null; created_at: string; last_sent_at: string; expires_at: string; invited_by: string | null; expired: boolean }[];
      };
      team_people: { Args: { p_company_id: string }; Returns: { user_id: string; name: string; role: E["team_role"] | null }[] };
      /** Open, unexpired invitations (just the count, for every member): 20261108190949_team_pending_invites.sql. */
      team_pending_invites: { Args: { p_company_id: string }; Returns: number };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          status: "vigente" | "vencida" | "cancelada" | "usada";
          company_name: string;
          role: E["team_role"];
          branch_names: string[] | null;
          inviter_name: string | null;
          email_hint: string;
          expires_at: string;
          email_matches: boolean | null;
        }[];
      };
      /** Returns { id, token, expires_at, email, emailed }: the raw token only this once; emailed false = link only (address got 3 invites today). */
      invite_member: { Args: { p_company_id: string; p_email: string; p_role: E["team_role"]; p_branch_ids?: string[] | null }; Returns: Json };
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined };
      /** Returns { company_id, company_name, role, branch_ids, profile_role }. */
      accept_invite: { Args: { p_token: string; p_name?: string | null }; Returns: Json };
      update_member: { Args: { p_company_id: string; p_user_id: string; p_role: E["team_role"]; p_branch_ids?: string[] | null }; Returns: undefined };
      remove_member: { Args: { p_company_id: string; p_user_id: string }; Returns: undefined };
      leave_company: { Args: { p_company_id: string }; Returns: undefined };
      /** Who made each company-side step (team only; application_events.actor_user_id isn't selectable by authenticated). Up to 200 ids. */
      application_event_actors: { Args: { p_application_ids: string[] }; Returns: { application_id: string; event_id: number; actor_user_id: string }[] };
      applied_to_job: { Args: { p_job: string }; Returns: boolean };
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
          // 20261112230000_curated_jobs.sql (absent until it's applied).
          source?: E["job_source"];
          source_label?: string | null;
          source_url?: string | null;
          checked_at?: string | null;
          expires_at?: string | null;
        }[];
      };
      // ---- vacantes curadas (20261112230000_curated_jobs.sql)
      /** Public (signed out too). No row = no such company. phone_hints: last 2 digits of the phones that can claim it. */
      claim_preview: {
        Args: { p_company_id: string };
        Returns: { company_id: string; company_name: string; claimable: boolean; open_jobs: number; phone_hints: string[] }[];
      };
      /** Returns { company_id, company_name }. Errors carry hint "claim:<code>" (or "team:other_company"). */
      claim_company: { Args: { p_company_id: string; p_name?: string | null }; Returns: Json };
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
      /** 20261112230000_curated_jobs.sql. */
      job_source: "chambarrio" | "curada";
      location_source: "colonia" | "gps";
      pay_period: "semana" | "quincena" | "mes" | "dia";
      plan_id: "por-vacante" | "pyme" | "industrial";
      shift: "Matutino" | "Vespertino" | "Nocturno" | "Mixto" | "Rotativo";
      /** Ordered reclutador < admin < dueno (20261108172838_team_accounts.sql). */
      team_role: "reclutador" | "admin" | "dueno";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type NearJob = Database["public"]["Functions"]["jobs_near"]["Returns"][number];
