export type ProposalStatus = 'draft' | 'sent' | 'negotiating' | 'won' | 'lost'
export type InteractionType = 'meeting' | 'call' | 'email' | 'visit' | 'note'
export type UserRole = 'admin' | 'member'
export type LossReason = 'price' | 'deadline' | 'competitor' | 'cancelled' | 'budget' | 'scope' | 'other'
export type TagCategory = 'service' | 'technology' | 'area'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Client {
  id: string
  name: string
  full_name: string | null
  sector: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  folder_name: string | null
  status: 'active' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Proposal {
  id: string
  client_id: string
  title: string
  description: string | null
  proposal_number: string | null
  status: ProposalStatus
  value: number | null
  proposal_date: string | null
  original_filename: string | null
  ai_generated: boolean
  loss_reason: LossReason | null
  loss_notes: string | null
  retry_date: string | null
  retried_from: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  category: TagCategory
  color: string | null
  created_at: string
}

export interface ProposalFile {
  id: string
  proposal_id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  storage_path: string
  created_at: string
}

export interface Interaction {
  id: string
  client_id: string
  type: InteractionType
  title: string
  description: string | null
  interaction_date: string
  created_by: string | null
  created_at: string
}

export interface Reminder {
  id: string
  client_id: string
  proposal_id: string | null
  title: string
  description: string | null
  due_date: string
  completed: boolean
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
}

export interface ClientWithProposals extends Client {
  proposals: (Proposal & { files: ProposalFile[] })[]
  interactions: Interaction[]
  reminders: Reminder[]
}

export interface DashboardMetrics {
  total_clients: number
  proposals_won: number
  proposals_negotiating: number
  proposals_lost: number
  proposals_total: number
}
