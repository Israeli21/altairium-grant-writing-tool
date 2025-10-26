import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for your database tables
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          nonprofit_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          nonprofit_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          nonprofit_name?: string | null
          created_at?: string
        }
      }

      grants: {
        Row: {
          id: string
          user_id: string
          nonprofit_name: string
          grantor_name: string | null
          funding_amount: number | null
          proposal_type: 'standard' | 'federal' | 'foundation' | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nonprofit_name: string
          grantor_name?: string | null
          funding_amount?: number | null
          proposal_type?: 'standard' | 'federal' | 'foundation' | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nonprofit_name?: string
          grantor_name?: string | null
          funding_amount?: number | null
          proposal_type?: 'standard' | 'federal' | 'foundation' | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      uploaded_documents: {
        Row: {
          id: string
          grant_id: string
          user_id: string
          file_name: string
          file_type: 'form_990' | 'form_1023' | 'past_projects'
          file_url: string
          extracted_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          grant_id: string
          user_id: string
          file_name: string
          file_type: 'form_990' | 'form_1023' | 'past_projects'
          file_url: string
          extracted_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          grant_id?: string
          user_id?: string
          file_name?: string
          file_type?: 'form_990' | 'form_1023' | 'past_projects'
          file_url?: string
          extracted_text?: string | null
          created_at?: string
        }
      }

      document_embeddings: {
        Row: {
          id: string
          document_id: string
          grant_id: string
          user_id: string
          content: string
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          grant_id: string
          user_id: string
          content: string
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          grant_id?: string
          user_id?: string
          content?: string
          embedding?: number[] | null
          created_at?: string
        }
      }
    }
  }
}
