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
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
      }
      grant_applications: {
        Row: {
          id: string
          user_id: string
          organization_name: string | null
          project_title: string | null
          grantor_name: string | null
          funding_amount: number | null
          project_description: string | null
          grant_opportunity_url: string | null
          structure_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_name?: string | null
          project_title?: string | null
          grantor_name?: string | null
          funding_amount?: number | null
          project_description?: string | null
          grant_opportunity_url?: string | null
          structure_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_name?: string | null
          project_title?: string | null
          grantor_name?: string | null
          funding_amount?: number | null
          project_description?: string | null
          grant_opportunity_url?: string | null
          structure_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Add other table types as needed
    }
  }
}