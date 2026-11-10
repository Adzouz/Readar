// Types for the part of the Supabase schema the client uses (supabase/migrations).
// Hand-written to match the migrations; keep them in sync when the schema changes, or replace
// this file with `supabase gen types typescript --project-id <ref>` output.

import type { ItemState } from '@readar/core'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type ProfileRow = {
  user_id: string
  style: 'glass' | 'editorial' | 'playful' | null
  mode: 'system' | 'light' | 'dark' | null
  setup_step: 'style' | 'topics' | 'sources' | 'claude' | 'done'
  setup_completed: boolean
  disabled_source_ids: string[]
  updated_at: string
}

type UserItemRow = {
  user_id: string
  item_id: string
  topic_id: string
  state: ItemState
  decided_at: string
}

export type ItemCardRow = {
  id: string
  url: string
  title: string
  author: string | null
  published_at: string | null
  image_url: string | null
  excerpt: string | null
  content_type: 'article' | 'video' | 'thread' | 'podcast'
  reading_minutes: number | null
  source_name: string | null
  coverage: number
}

/** Raw fetch facts for one of the user's sources (`my_source_health`). Catalog and keyword
 * sources have a slug, links a URL. Null facts: the worker hasn't picked the link up yet. */
export type SourceHealthRow = {
  topic_id: string
  slug: string | null
  url: string | null
  fetched_at: string | null
  last_status: number | null
  last_error: string | null
  error_count: number
  items: number
  latest_item_at: string | null
}

export type ListItemRow = ItemCardRow & {
  topic_id: string
  state: Exclude<ItemState, 'read'>
  decided_at: string
}

export type SetupPayload = {
  style: ProfileRow['style']
  mode: ProfileRow['mode']
  step: ProfileRow['setup_step']
  completed: boolean
  disabledSourceIds: string[]
  topics: { id: string; keyword?: string }[]
  sources: { topicId: string; url: string }[]
}

export type SavedSetup = {
  profile: Omit<ProfileRow, 'user_id'> | null
  topics: { id: string; keyword: string | null }[]
  sources: { topicId: string; url: string }[]
}

/** A summary written on the user's device with their own key. Private to that user (RLS). */
export type SummaryRow = {
  user_id: string
  item_id: string
  prompt_version: number
  model: string
  tldr: string
  points: string[]
  content_type: ItemCardRow['content_type'] | null
  reading_minutes: number | null
  created_at: string
}

export type SummaryInputRow = {
  title: string
  url: string
  source_name: string | null
  text: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow>
        Update: Partial<ProfileRow>
        Relationships: []
      }
      user_items: {
        Row: UserItemRow
        Insert: Omit<UserItemRow, 'user_id' | 'decided_at'> & { decided_at?: string }
        Update: Partial<UserItemRow>
        Relationships: []
      }
      summaries: {
        Row: SummaryRow
        Insert: Omit<SummaryRow, 'user_id' | 'created_at'>
        Update: Partial<SummaryRow>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_setup: { Args: { [_ in never]: never }; Returns: Json }
      save_setup: { Args: { payload: Json }; Returns: undefined }
      deck: { Args: { p_topic_id: string; p_limit?: number }; Returns: ItemCardRow[] }
      list_items: { Args: { [_ in never]: never }; Returns: ListItemRow[] }
      my_source_health: { Args: { [_ in never]: never }; Returns: SourceHealthRow[] }
      worker_active: { Args: { [_ in never]: never }; Returns: boolean }
      summary_input: { Args: { p_item_id: string }; Returns: SummaryInputRow[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
