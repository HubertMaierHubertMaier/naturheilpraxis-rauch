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
      _kb_owner_import_3f7a22a0_chunks: {
        Row: {
          created_at: string
          data: string
          data_length: number
          data_md5: string
          import_key: string
          payload_length: number
          payload_md5: string
          seq: number
          total_chunks: number
        }
        Insert: {
          created_at?: string
          data: string
          data_length: number
          data_md5: string
          import_key: string
          payload_length: number
          payload_md5: string
          seq: number
          total_chunks: number
        }
        Update: {
          created_at?: string
          data?: string
          data_length?: number
          data_md5?: string
          import_key?: string
          payload_length?: number
          payload_md5?: string
          seq?: number
          total_chunks?: number
        }
        Relationships: []
      }
      admin_knowledge_base: {
        Row: {
          category: string
          commercial_claims_reviewed: boolean
          content: string
          contraindications: string[]
          created_at: string
          dosage_status: string
          entry_kind: string
          evidence_level: string
          id: string
          interaction_tags: string[]
          last_reviewed_at: string | null
          patient_facing_allowed: boolean
          review_status: string
          reviewed_by: string | null
          rights_status: string
          safety_notes: string
          source_citations: Json
          tags: string[]
          therapeutic_topics: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          commercial_claims_reviewed?: boolean
          content?: string
          contraindications?: string[]
          created_at?: string
          dosage_status?: string
          entry_kind?: string
          evidence_level?: string
          id?: string
          interaction_tags?: string[]
          last_reviewed_at?: string | null
          patient_facing_allowed?: boolean
          review_status?: string
          reviewed_by?: string | null
          rights_status?: string
          safety_notes?: string
          source_citations?: Json
          tags?: string[]
          therapeutic_topics?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          commercial_claims_reviewed?: boolean
          content?: string
          contraindications?: string[]
          created_at?: string
          dosage_status?: string
          entry_kind?: string
          evidence_level?: string
          id?: string
          interaction_tags?: string[]
          last_reviewed_at?: string | null
          patient_facing_allowed?: boolean
          review_status?: string
          reviewed_by?: string | null
          rights_status?: string
          safety_notes?: string
          source_citations?: Json
          tags?: string[]
          therapeutic_topics?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anamnesis_submissions: {
        Row: {
          form_data: Json
          id: string
          signature_data: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          form_data: Json
          id?: string
          signature_data?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          form_data?: Json
          id?: string
          signature_data?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          context: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          from_addr: string | null
          has_attachment: boolean
          http_status: number | null
          id: string
          recipient: string
          relay_message: string | null
          relay_success: boolean | null
          relay_version: string | null
          subject: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          from_addr?: string | null
          has_attachment?: boolean
          http_status?: number | null
          id?: string
          recipient: string
          relay_message?: string | null
          relay_success?: boolean | null
          relay_version?: string | null
          subject?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          from_addr?: string | null
          has_attachment?: boolean
          http_status?: number | null
          id?: string
          recipient?: string
          relay_message?: string | null
          relay_success?: boolean | null
          relay_version?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_de: string
          answer_en: string
          created_at: string
          id: string
          is_published: boolean
          question_de: string
          question_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_de: string
          answer_en: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_de: string
          question_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_de?: string
          answer_en?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question_de?: string
          question_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      iaa_submissions: {
        Row: {
          appointment_number: number
          form_data: Json
          id: string
          status: string
          submitted_at: string
          therapist_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_number?: number
          form_data?: Json
          id?: string
          status?: string
          submitted_at?: string
          therapist_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_number?: number
          form_data?: Json
          id?: string
          status?: string
          submitted_at?: string
          therapist_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      infothek_gating: {
        Row: {
          gated: boolean
          href: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          gated?: boolean
          href: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          gated?: boolean
          href?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      kb_article_entities: {
        Row: {
          article_revision_id: string
          context_text: string
          created_at: string
          created_by: string | null
          entity_id: string
          rank: number
          role: string
        }
        Insert: {
          article_revision_id: string
          context_text?: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          rank?: number
          role: string
        }
        Update: {
          article_revision_id?: string
          context_text?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          rank?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_entities_article_revision_id_fkey"
            columns: ["article_revision_id"]
            isOneToOne: false
            referencedRelation: "kb_article_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_revisions: {
        Row: {
          article_id: string
          category_path: string
          content_hash: string
          content_markdown: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          origin_type: string
          released_at: string | null
          review_due_at: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision_no: number
          tags: string[]
          title: string
        }
        Insert: {
          article_id: string
          category_path?: string
          content_hash: string
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no: number
          tags?: string[]
          title: string
        }
        Update: {
          article_id?: string
          category_path?: string
          content_hash?: string
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no?: number
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          article_kind: string
          canonical_key: string
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          id: string
          lifecycle_status: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          article_kind?: string
          canonical_key: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          article_kind?: string
          canonical_key?: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_current_revision_fk"
            columns: ["id", "current_revision_id"]
            isOneToOne: false
            referencedRelation: "kb_article_revisions"
            referencedColumns: ["article_id", "id"]
          },
        ]
      }
      kb_assertion_sources: {
        Row: {
          assertion_id: string
          created_at: string
          created_by: string | null
          is_primary: boolean
          locator: string
          original_quote: string
          source_revision_id: string
          source_role: string
        }
        Insert: {
          assertion_id: string
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          locator?: string
          original_quote?: string
          source_revision_id: string
          source_role: string
        }
        Update: {
          assertion_id?: string
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          locator?: string
          original_quote?: string
          source_revision_id?: string
          source_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_assertion_sources_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: false
            referencedRelation: "kb_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_assertion_sources_source_revision_id_fkey"
            columns: ["source_revision_id"]
            isOneToOne: false
            referencedRelation: "kb_source_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_assertions: {
        Row: {
          assertion_kind: string
          canonical_key: string
          claim_text: string
          content_hash: string
          created_at: string
          created_by: string | null
          evidence_basis: string
          evidence_quality: string
          id: string
          metadata: Json
          origin_type: string
          released_at: string | null
          review_due_at: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          supersedes_assertion_id: string | null
          valid_from: string | null
          valid_until: string | null
          version_no: number
        }
        Insert: {
          assertion_kind: string
          canonical_key: string
          claim_text: string
          content_hash: string
          created_at?: string
          created_by?: string | null
          evidence_basis?: string
          evidence_quality?: string
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          supersedes_assertion_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version_no: number
        }
        Update: {
          assertion_kind?: string
          canonical_key?: string
          claim_text?: string
          content_hash?: string
          created_at?: string
          created_by?: string | null
          evidence_basis?: string
          evidence_quality?: string
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          supersedes_assertion_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_assertions_supersedes_assertion_id_fkey"
            columns: ["supersedes_assertion_id"]
            isOneToOne: false
            referencedRelation: "kb_assertions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_change_proposals: {
        Row: {
          data_classification: string
          id: string
          operation: string
          origin_type: string
          proposal: Json
          proposal_kind: string
          review_notes: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          target_id: string | null
          updated_at: string
        }
        Insert: {
          data_classification?: string
          id?: string
          operation: string
          origin_type: string
          proposal: Json
          proposal_kind: string
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          data_classification?: string
          id?: string
          operation?: string
          origin_type?: string
          proposal?: Json
          proposal_kind?: string
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          target_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kb_dosage_candidates: {
        Row: {
          ambiguity_notes: string
          application_route: string
          application_text: string
          batch_id: string
          candidate_key: string
          candidate_status: string
          confidence: number
          created_at: string
          data_classification: string
          dose_unit: string
          duration_text: string
          frequency_text: string
          id: string
          indication_candidate_id: string | null
          indication_entity_id: string | null
          maximum_dose: number | null
          minimum_dose: number | null
          original_excerpt: string
          proposed_data: Json
          reference_period: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_candidate_id: string
          source_locator: string
          subject_candidate_id: string | null
          subject_entity_id: string | null
          timing_text: string
        }
        Insert: {
          ambiguity_notes?: string
          application_route?: string
          application_text?: string
          batch_id: string
          candidate_key: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          dose_unit?: string
          duration_text?: string
          frequency_text?: string
          id?: string
          indication_candidate_id?: string | null
          indication_entity_id?: string | null
          maximum_dose?: number | null
          minimum_dose?: number | null
          original_excerpt?: string
          proposed_data?: Json
          reference_period?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
          timing_text?: string
        }
        Update: {
          ambiguity_notes?: string
          application_route?: string
          application_text?: string
          batch_id?: string
          candidate_key?: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          dose_unit?: string
          duration_text?: string
          frequency_text?: string
          id?: string
          indication_candidate_id?: string | null
          indication_entity_id?: string | null
          maximum_dose?: number | null
          minimum_dose?: number | null
          original_excerpt?: string
          proposed_data?: Json
          reference_period?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id?: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
          timing_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_dosage_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_indication_candidate_id_fkey"
            columns: ["indication_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_indication_entity_id_fkey"
            columns: ["indication_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_indication_same_batch_fk"
            columns: ["batch_id", "indication_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_source_same_batch_fk"
            columns: ["batch_id", "source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_subject_candidate_id_fkey"
            columns: ["subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_dosage_candidates_subject_same_batch_fk"
            columns: ["batch_id", "subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
        ]
      }
      kb_entities: {
        Row: {
          canonical_key: string
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          entity_type_code: string
          id: string
          lifecycle_status: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          entity_type_code: string
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          entity_type_code?: string
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_entities_current_revision_fk"
            columns: ["id", "current_revision_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_revisions"
            referencedColumns: ["entity_id", "id"]
          },
          {
            foreignKeyName: "kb_entities_entity_type_code_fkey"
            columns: ["entity_type_code"]
            isOneToOne: false
            referencedRelation: "kb_entity_types"
            referencedColumns: ["code"]
          },
        ]
      }
      kb_entity_candidates: {
        Row: {
          aliases: string[]
          ambiguity_notes: string
          batch_id: string
          candidate_key: string
          candidate_status: string
          confidence: number
          created_at: string
          data_classification: string
          description_markdown: string
          display_name: string
          id: string
          original_excerpt: string
          proposed_canonical_key: string | null
          proposed_data: Json
          proposed_entity_type_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_candidate_id: string | null
          source_locator: string
          target_entity_id: string | null
        }
        Insert: {
          aliases?: string[]
          ambiguity_notes?: string
          batch_id: string
          candidate_key: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          description_markdown?: string
          display_name: string
          id?: string
          original_excerpt?: string
          proposed_canonical_key?: string | null
          proposed_data?: Json
          proposed_entity_type_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id?: string | null
          source_locator?: string
          target_entity_id?: string | null
        }
        Update: {
          aliases?: string[]
          ambiguity_notes?: string
          batch_id?: string
          candidate_key?: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          description_markdown?: string
          display_name?: string
          id?: string
          original_excerpt?: string
          proposed_canonical_key?: string | null
          proposed_data?: Json
          proposed_entity_type_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id?: string | null
          source_locator?: string
          target_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_entity_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entity_candidates_proposed_entity_type_code_fkey"
            columns: ["proposed_entity_type_code"]
            isOneToOne: false
            referencedRelation: "kb_entity_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kb_entity_candidates_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entity_candidates_source_same_batch_fk"
            columns: ["batch_id", "source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_entity_candidates_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entity_identifiers: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          is_primary: boolean
          namespace: string | null
          normalized_value: string
          scheme_code: string
          valid_from: string | null
          valid_until: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          is_primary?: boolean
          namespace?: string | null
          normalized_value: string
          scheme_code: string
          valid_from?: string | null
          valid_until?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          is_primary?: boolean
          namespace?: string | null
          normalized_value?: string
          scheme_code?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_entity_identifiers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entity_identifiers_scheme_code_fkey"
            columns: ["scheme_code"]
            isOneToOne: false
            referencedRelation: "kb_identifier_schemes"
            referencedColumns: ["code"]
          },
        ]
      }
      kb_entity_names: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          is_preferred: boolean
          language_code: string
          name: string
          name_kind: string
          normalized_name: string
          retired_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          is_preferred?: boolean
          language_code?: string
          name: string
          name_kind: string
          normalized_name: string
          retired_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          is_preferred?: boolean
          language_code?: string
          name?: string
          name_kind?: string
          normalized_name?: string
          retired_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_entity_names_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entity_relations: {
        Row: {
          assertion_id: string
          assignment_strength: string
          context_text: string
          created_at: string
          created_by: string | null
          id: string
          object_entity_id: string
          rank: number
          relation_type_code: string
          subject_entity_id: string
        }
        Insert: {
          assertion_id: string
          assignment_strength?: string
          context_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          object_entity_id: string
          rank?: number
          relation_type_code: string
          subject_entity_id: string
        }
        Update: {
          assertion_id?: string
          assignment_strength?: string
          context_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          object_entity_id?: string
          rank?: number
          relation_type_code?: string
          subject_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_entity_relations_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: true
            referencedRelation: "kb_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entity_relations_object_entity_id_fkey"
            columns: ["object_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entity_relations_relation_type_code_fkey"
            columns: ["relation_type_code"]
            isOneToOne: false
            referencedRelation: "kb_relation_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kb_entity_relations_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entity_revisions: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string | null
          description_markdown: string
          display_name: string
          entity_id: string
          id: string
          metadata: Json
          origin_type: string
          released_at: string | null
          review_due_at: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision_no: number
          summary: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by?: string | null
          description_markdown?: string
          display_name: string
          entity_id: string
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no: number
          summary?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string | null
          description_markdown?: string
          display_name?: string
          entity_id?: string
          id?: string
          metadata?: Json
          origin_type?: string
          released_at?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no?: number
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_entity_revisions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entity_types: {
        Row: {
          code: string
          created_at: string
          description: string
          is_active: boolean
          label: string
          metadata: Json
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          is_active?: boolean
          label: string
          metadata?: Json
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          label?: string
          metadata?: Json
        }
        Relationships: []
      }
      kb_identifier_schemes: {
        Row: {
          code: string
          created_at: string
          description: string
          is_active: boolean
          is_globally_unique: boolean
          label: string
          value_pattern: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          is_active?: boolean
          is_globally_unique: boolean
          label: string
          value_pattern?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          is_globally_unique?: boolean
          label?: string
          value_pattern?: string | null
        }
        Relationships: []
      }
      kb_import_batches: {
        Row: {
          batch_status: string
          candidate_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          data_classification: string
          error_count: number
          id: string
          metadata: Json
          model_name: string
          parser_name: string
          parser_version: string
          prompt_hash: string | null
          source_hash: string
          source_kind: string
          source_label: string
        }
        Insert: {
          batch_status?: string
          candidate_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_classification?: string
          error_count?: number
          id?: string
          metadata?: Json
          model_name?: string
          parser_name?: string
          parser_version?: string
          prompt_hash?: string | null
          source_hash: string
          source_kind: string
          source_label: string
        }
        Update: {
          batch_status?: string
          candidate_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_classification?: string
          error_count?: number
          id?: string
          metadata?: Json
          model_name?: string
          parser_name?: string
          parser_version?: string
          prompt_hash?: string | null
          source_hash?: string
          source_kind?: string
          source_label?: string
        }
        Relationships: []
      }
      kb_import_errors: {
        Row: {
          batch_id: string
          candidate_key: string
          candidate_kind: string | null
          created_at: string
          data_classification: string
          error_code: string
          error_message: string
          id: string
          original_excerpt: string
          severity: string
          source_locator: string
        }
        Insert: {
          batch_id: string
          candidate_key?: string
          candidate_kind?: string | null
          created_at?: string
          data_classification?: string
          error_code: string
          error_message: string
          id?: string
          original_excerpt?: string
          severity?: string
          source_locator?: string
        }
        Update: {
          batch_id?: string
          candidate_key?: string
          candidate_kind?: string | null
          created_at?: string
          data_classification?: string
          error_code?: string
          error_message?: string
          id?: string
          original_excerpt?: string
          severity?: string
          source_locator?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_import_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_relation_candidates: {
        Row: {
          ambiguity_notes: string
          assignment_strength: string
          batch_id: string
          candidate_key: string
          candidate_status: string
          confidence: number
          created_at: string
          data_classification: string
          id: string
          object_candidate_id: string | null
          object_entity_id: string | null
          original_excerpt: string
          proposed_data: Json
          proposed_relation_type_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_candidate_id: string
          source_locator: string
          subject_candidate_id: string | null
          subject_entity_id: string | null
        }
        Insert: {
          ambiguity_notes?: string
          assignment_strength?: string
          batch_id: string
          candidate_key: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          id?: string
          object_candidate_id?: string | null
          object_entity_id?: string | null
          original_excerpt?: string
          proposed_data?: Json
          proposed_relation_type_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
        }
        Update: {
          ambiguity_notes?: string
          assignment_strength?: string
          batch_id?: string
          candidate_key?: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          id?: string
          object_candidate_id?: string | null
          object_entity_id?: string | null
          original_excerpt?: string
          proposed_data?: Json
          proposed_relation_type_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_candidate_id?: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_relation_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_object_candidate_id_fkey"
            columns: ["object_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_object_entity_id_fkey"
            columns: ["object_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_object_same_batch_fk"
            columns: ["batch_id", "object_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_proposed_relation_type_code_fkey"
            columns: ["proposed_relation_type_code"]
            isOneToOne: false
            referencedRelation: "kb_relation_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kb_relation_candidates_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_source_same_batch_fk"
            columns: ["batch_id", "source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_subject_candidate_id_fkey"
            columns: ["subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_relation_candidates_subject_same_batch_fk"
            columns: ["batch_id", "subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
        ]
      }
      kb_relation_type_domains: {
        Row: {
          object_entity_type_code: string
          relation_type_code: string
          review_status: string
          subject_entity_type_code: string
        }
        Insert: {
          object_entity_type_code: string
          relation_type_code: string
          review_status?: string
          subject_entity_type_code: string
        }
        Update: {
          object_entity_type_code?: string
          relation_type_code?: string
          review_status?: string
          subject_entity_type_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_relation_type_domains_object_entity_type_code_fkey"
            columns: ["object_entity_type_code"]
            isOneToOne: false
            referencedRelation: "kb_entity_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kb_relation_type_domains_relation_type_code_fkey"
            columns: ["relation_type_code"]
            isOneToOne: false
            referencedRelation: "kb_relation_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kb_relation_type_domains_subject_entity_type_code_fkey"
            columns: ["subject_entity_type_code"]
            isOneToOne: false
            referencedRelation: "kb_entity_types"
            referencedColumns: ["code"]
          },
        ]
      }
      kb_relation_types: {
        Row: {
          code: string
          created_at: string
          description: string
          is_active: boolean
          is_symmetric: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          is_active?: boolean
          is_symmetric?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          is_symmetric?: boolean
          label?: string
        }
        Relationships: []
      }
      kb_review_decisions: {
        Row: {
          candidate_id: string
          candidate_kind: string
          data_classification: string
          decided_at: string
          decided_by: string
          decision: string
          decision_notes: string
          id: string
          status_after: string
          status_before: string
        }
        Insert: {
          candidate_id: string
          candidate_kind: string
          data_classification?: string
          decided_at?: string
          decided_by?: string
          decision: string
          decision_notes?: string
          id?: string
          status_after: string
          status_before: string
        }
        Update: {
          candidate_id?: string
          candidate_kind?: string
          data_classification?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          decision_notes?: string
          id?: string
          status_after?: string
          status_before?: string
        }
        Relationships: []
      }
      kb_safety_candidates: {
        Row: {
          action_text: string
          ambiguity_notes: string
          batch_id: string
          candidate_key: string
          candidate_status: string
          confidence: number
          created_at: string
          data_classification: string
          id: string
          original_excerpt: string
          proposed_data: Json
          related_candidate_id: string | null
          related_entity_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_type: string
          severity: string
          source_candidate_id: string
          source_locator: string
          subject_candidate_id: string | null
          subject_entity_id: string | null
        }
        Insert: {
          action_text: string
          ambiguity_notes?: string
          batch_id: string
          candidate_key: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          id?: string
          original_excerpt?: string
          proposed_data?: Json
          related_candidate_id?: string | null
          related_entity_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_type: string
          severity?: string
          source_candidate_id: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
        }
        Update: {
          action_text?: string
          ambiguity_notes?: string
          batch_id?: string
          candidate_key?: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          id?: string
          original_excerpt?: string
          proposed_data?: Json
          related_candidate_id?: string | null
          related_entity_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_type?: string
          severity?: string
          source_candidate_id?: string
          source_locator?: string
          subject_candidate_id?: string | null
          subject_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_safety_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_related_candidate_id_fkey"
            columns: ["related_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_related_entity_id_fkey"
            columns: ["related_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_related_same_batch_fk"
            columns: ["batch_id", "related_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_source_same_batch_fk"
            columns: ["batch_id", "source_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_source_candidates"
            referencedColumns: ["batch_id", "id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_subject_candidate_id_fkey"
            columns: ["subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_subject_entity_id_fkey"
            columns: ["subject_entity_id"]
            isOneToOne: false
            referencedRelation: "kb_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_safety_candidates_subject_same_batch_fk"
            columns: ["batch_id", "subject_candidate_id"]
            isOneToOne: false
            referencedRelation: "kb_entity_candidates"
            referencedColumns: ["batch_id", "id"]
          },
        ]
      }
      kb_source_candidates: {
        Row: {
          ambiguity_notes: string
          batch_id: string
          candidate_key: string
          candidate_status: string
          confidence: number
          created_at: string
          data_classification: string
          external_identifier: string
          id: string
          original_excerpt: string
          proposed_data: Json
          proposed_source_type: string
          publication_date: string | null
          publisher: string
          reviewed_at: string | null
          reviewed_by: string | null
          rights_status: string
          source_locator: string
          source_url: string
          target_source_id: string | null
          title: string
        }
        Insert: {
          ambiguity_notes?: string
          batch_id: string
          candidate_key: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          external_identifier?: string
          id?: string
          original_excerpt?: string
          proposed_data?: Json
          proposed_source_type?: string
          publication_date?: string | null
          publisher?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          source_locator?: string
          source_url?: string
          target_source_id?: string | null
          title: string
        }
        Update: {
          ambiguity_notes?: string
          batch_id?: string
          candidate_key?: string
          candidate_status?: string
          confidence?: number
          created_at?: string
          data_classification?: string
          external_identifier?: string
          id?: string
          original_excerpt?: string
          proposed_data?: Json
          proposed_source_type?: string
          publication_date?: string | null
          publisher?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_status?: string
          source_locator?: string
          source_url?: string
          target_source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_source_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kb_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_source_candidates_target_source_id_fkey"
            columns: ["target_source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_source_revisions: {
        Row: {
          archive_location: string | null
          authors: string[]
          content_hash: string
          created_at: string
          created_by: string | null
          doi: string | null
          edition: string | null
          file_sha256: string | null
          id: string
          isbn: string | null
          metadata: Json
          pmid: string | null
          published_on: string | null
          publisher: string | null
          released_at: string | null
          retrieved_on: string | null
          review_due_at: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision_no: number
          rights_status: string
          source_id: string
          source_type: string
          title: string
          url: string | null
        }
        Insert: {
          archive_location?: string | null
          authors?: string[]
          content_hash: string
          created_at?: string
          created_by?: string | null
          doi?: string | null
          edition?: string | null
          file_sha256?: string | null
          id?: string
          isbn?: string | null
          metadata?: Json
          pmid?: string | null
          published_on?: string | null
          publisher?: string | null
          released_at?: string | null
          retrieved_on?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no: number
          rights_status?: string
          source_id: string
          source_type: string
          title: string
          url?: string | null
        }
        Update: {
          archive_location?: string | null
          authors?: string[]
          content_hash?: string
          created_at?: string
          created_by?: string | null
          doi?: string | null
          edition?: string | null
          file_sha256?: string | null
          id?: string
          isbn?: string | null
          metadata?: Json
          pmid?: string | null
          published_on?: string | null
          publisher?: string | null
          released_at?: string | null
          retrieved_on?: string | null
          review_due_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_no?: number
          rights_status?: string
          source_id?: string
          source_type?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_source_revisions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "kb_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_sources: {
        Row: {
          canonical_key: string
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          id: string
          lifecycle_status: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          lifecycle_status?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_sources_current_revision_fk"
            columns: ["id", "current_revision_id"]
            isOneToOne: false
            referencedRelation: "kb_source_revisions"
            referencedColumns: ["source_id", "id"]
          },
        ]
      }
      knowledge_product_links: {
        Row: {
          clinical_topics: string[]
          confidence: number
          created_at: string
          created_by: string | null
          id: string
          knowledge_entry_id: string
          product_id: string
          relation_type: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          safety_notes: string
          updated_at: string
        }
        Insert: {
          clinical_topics?: string[]
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          knowledge_entry_id: string
          product_id: string
          relation_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_notes?: string
          updated_at?: string
        }
        Update: {
          clinical_topics?: string[]
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          knowledge_entry_id?: string
          product_id?: string
          relation_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_product_links_knowledge_entry_id_fkey"
            columns: ["knowledge_entry_id"]
            isOneToOne: false
            referencedRelation: "admin_knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mannayan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      mannayan_orders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          items: Json
          notes: string | null
          order_number: string
          patient_label: string | null
          pseudonym_id: string | null
          total_eur: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          patient_label?: string | null
          pseudonym_id?: string | null
          total_eur?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          patient_label?: string | null
          pseudonym_id?: string | null
          total_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      mannayan_products: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_eur: number
          sku: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_eur?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_eur?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_access: {
        Row: {
          anamnese_download: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          infothek_all: boolean
          infothek_items: string[]
          library_access: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          anamnese_download?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          infothek_all?: boolean
          infothek_items?: string[]
          library_access?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          anamnese_download?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          infothek_all?: boolean
          infothek_items?: string[]
          library_access?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_resources: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_published: boolean
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_snapshot: {
        Row: {
          created_at: string
          data: Json
          pseudonym_id: string
          source_created_at: string | null
          source_session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          pseudonym_id: string
          source_created_at?: string | null
          source_session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          pseudonym_id?: string
          source_created_at?: string | null
          source_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      practice_info: {
        Row: {
          content_de: string
          content_en: string
          created_at: string
          icon: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title_de: string
          title_en: string
          updated_at: string
        }
        Insert: {
          content_de: string
          content_en: string
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title_de: string
          title_en: string
          updated_at?: string
        }
        Update: {
          content_de?: string
          content_en?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title_de?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_pricing: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          label_de: string
          label_en: string
          note_de: string | null
          note_en: string | null
          price_text_de: string
          price_text_en: string
          service_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          label_de: string
          label_en: string
          note_de?: string | null
          note_en?: string | null
          price_text_de: string
          price_text_en: string
          service_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          label_de?: string
          label_en?: string
          note_de?: string | null
          note_en?: string | null
          price_text_de?: string
          price_text_en?: string
          service_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string | null
          id: string
          is_verified_patient: boolean
          last_name: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_verified_patient?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_verified_patient?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      therapy_deleted_document_markers: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          marker_name: string
          pseudonym_id: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          marker_name: string
          pseudonym_id: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          marker_name?: string
          pseudonym_id?: string
        }
        Relationships: []
      }
      therapy_sessions: {
        Row: {
          befund_html: string | null
          befund_meta: Json | null
          created_at: string
          created_by: string
          eingabe_daten: Json
          empfehlung: string | null
          id: string
          kind: string
          notiz: string | null
          parent_session_id: string | null
          pseudonym_id: string
          updated_at: string
          version_label: string | null
          version_number: number | null
        }
        Insert: {
          befund_html?: string | null
          befund_meta?: Json | null
          created_at?: string
          created_by: string
          eingabe_daten?: Json
          empfehlung?: string | null
          id?: string
          kind?: string
          notiz?: string | null
          parent_session_id?: string | null
          pseudonym_id: string
          updated_at?: string
          version_label?: string | null
          version_number?: number | null
        }
        Update: {
          befund_html?: string | null
          befund_meta?: Json | null
          created_at?: string
          created_by?: string
          eingabe_daten?: Json
          empfehlung?: string | null
          id?: string
          kind?: string
          notiz?: string | null
          parent_session_id?: string | null
          pseudonym_id?: string
          updated_at?: string
          version_label?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_pending_bindings: {
        Row: {
          binding_token: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          used: boolean
          user_id: string
        }
        Insert: {
          binding_token: string
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          used?: boolean
          user_id: string
        }
        Update: {
          binding_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      two_factor_verified_sessions: {
        Row: {
          created_at: string
          method: string
          purpose: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          method?: string
          purpose: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          method?: string
          purpose?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          type: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          type?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _strip_doc_block: {
        Args: { _archive_path: string; _filename: string; _text: string }
        Returns: string
      }
      admin_strip_document_from_patient_context: {
        Args: {
          _archive_path: string
          _filename: string
          _pseudonym_id: string
        }
        Returns: Json
      }
      clear_current_two_factor_session: { Args: never; Returns: undefined }
      compact_therapy_session_input: {
        Args: { _input: Json; _max_chars?: number }
        Returns: Json
      }
      complete_two_factor_binding: {
        Args: { _binding_token: string }
        Returns: boolean
      }
      extract_patient_snapshot_fields: { Args: { _input: Json }; Returns: Json }
      get_my_patient_access: { Args: never; Returns: Json }
      get_public_app_setting: { Args: { _key: string }; Returns: Json }
      get_therapy_patient_safe_snapshot: {
        Args: { _max_rows?: number; _pseudonym_id: string }
        Returns: Json
      }
      get_therapy_session_safe_detail: {
        Args: { _include_befund_html?: boolean; _session_id: string }
        Returns: Json
      }
      get_therapy_sessions_safe_list: {
        Args: { _max_rows?: number; _pseudonym_id: string }
        Returns: {
          befund_meta: Json
          created_at: string
          eingabe_daten: Json
          empfehlung: string
          has_befund_html: boolean
          has_empfehlung: boolean
          id: string
          is_truncated: boolean
          kind: string
          notiz: string
          parent_session_id: string
          pseudonym_id: string
          updated_at: string
          version_label: string
          version_number: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: {
        Args: {
          _action: string
          _details?: Json
          _ip_address?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      is_current_session_two_factor_completed: {
        Args: { _max_age?: string }
        Returns: boolean
      }
      is_current_session_two_factor_verified: {
        Args: { _max_age?: string }
        Returns: boolean
      }
      is_verified_patient: { Args: { _user_id: string }; Returns: boolean }
      kb_complete_import_batch_review: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      kb_record_import_review_decision: {
        Args: {
          _candidate_id: string
          _candidate_kind: string
          _decision: string
          _decision_notes?: string
        }
        Returns: string
      }
      list_admin_accounts: {
        Args: never
        Returns: {
          admin_since: string
          email: string
          first_name: string
          last_name: string
          profile_created_at: string
          user_id: string
        }[]
      }
      next_mannayan_order_number: { Args: never; Returns: string }
      next_mannayan_order_number_for_pseudonym: {
        Args: { _pseudonym: string }
        Returns: string
      }
      redact_therapy_pii_jsonb: {
        Args: { _parent_key?: string; _value: Json }
        Returns: Json
      }
      redact_therapy_pii_text: { Args: { _value: string }; Returns: string }
      strip_recently_deleted_document_markers: {
        Args: { _data: Json; _pseudonym_id: string }
        Returns: Json
      }
      upsert_therapy_autosave_draft: {
        Args: {
          _eingabe_daten: Json
          _empfehlung?: string
          _notiz?: string
          _pseudonym_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "patient"
      language_code: "de" | "en"
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
      app_role: ["admin", "patient"],
      language_code: ["de", "en"],
    },
  },
} as const
