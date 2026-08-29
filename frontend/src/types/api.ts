export interface Employee {
  id: string;
  user_id: string;
  name: string;
  department: string;
  job_role: string;

  normal_start_hour: number;
  normal_end_hour: number;

  typical_ip: string;
  typical_location: string;

  typical_login_frequency: number;
  typical_files_accessed: number;
  typical_data_transfer_bytes: number;

  behavior_profile: Record<string, unknown>;

  is_active: boolean;
  created_at: string;
}


export interface SecurityEvent {
  id: string;
  event_id: string;

  timestamp: string;

  employee_id: string;

  session_id: string | null;
  event_type: string;

  source_ip: string;
  destination_ip: string | null;

  source_location: string | null;

  resource_type: string | null;
  resource_name: string | null;

  bytes_sent: number;
  bytes_received: number;

  success: boolean;

  event_metadata: Record<string, unknown>;

  created_at: string;
}