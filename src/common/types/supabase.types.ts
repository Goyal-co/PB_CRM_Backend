export type BookingStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'approved'
  | 'agreement_generated'
  | 'agreement_printed'
  | 'agreement_signed'
  | 'active'
  | 'possession_offered'
  | 'possession_taken'
  | 'registered'
  | 'cancelled'
  | 'rejected';

export type UnitStatus =
  | 'available'
  | 'blocked'
  | 'booked'
  | 'agreement_signed'
  | 'registered'
  | 'cancelled';

export type UnitType = '2bhk' | '2_5bhk' | '3bhk';

export type TowerName = 'A' | 'B' | 'C' | 'D' | 'E';

export type DocType =
  | 'aadhar_card'
  | 'pan_card'
  | 'passport'
  | 'voter_id'
  | 'driving_license'
  | 'oci_pio_card'
  | 'business_card'
  | 'passport_photo'
  | 'agreement_for_sale'
  | 'payment_receipt'
  | 'floor_plan'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'demanded'
  | 'received'
  | 'cleared'
  | 'bounced'
  | 'refunded';

export type PaymentMethod =
  | 'cheque'
  | 'demand_draft'
  | 'wire_transfer'
  | 'upi'
  | 'neft'
  | 'rtgs';

export type PaymentMilestone =
  | 'booking_5pct'
  | 'agreement_5pct'
  | 'excavation_10pct'
  | 'foundation_10pct'
  | 'slab_floor_1_5pct'
  | 'slab_floor_4_5pct'
  | 'slab_floor_6_5pct'
  | 'slab_floor_8_5pct'
  | 'slab_floor_10_5pct'
  | 'slab_floor_12_10pct'
  | 'slab_floor_14_5pct'
  | 'slab_floor_16_5pct'
  | 'slab_floor_18_5pct'
  | 'slab_floor_20_5pct'
  | 'slab_floor_22_5pct'
  | 'slab_floor_24_5pct'
  | 'possession_registration_5pct';

export type FieldDataType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'phone'
  | 'email'
  | 'file';

export type ReviewItemStatus = 'not_reviewed' | 'ok' | 'needs_revision';

export type UserRole = 'super_admin' | 'manager' | 'user';

export interface ProfileRow {
  id: string;
  email: string | null;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  father_husband_name: string | null;
  date_of_birth: string | null;
  marital_status: string | null;
  nationality: string | null;
  aadhar_no: string | null;
  pan_no: string | null;
  phone: string | null;
  alternate_phone: string | null;
  communication_address: string | null;
  permanent_address: string | null;
  occupation: string | null;
  employer_name: string | null;
  designation: string | null;
  place_of_business: string | null;
  assigned_manager_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
