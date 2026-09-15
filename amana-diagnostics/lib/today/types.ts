/**
 * What `/api/admin/today` returns: the raw rows the dashboard is built from.
 *
 * Rows, not figures, on purpose. The period boundaries are local midnights
 * in the clinic's own time, and the server that answers may be in another
 * one (Vercel runs in UTC; Nigeria is UTC+1). Sending rows and adding them
 * up in the browser keeps "today" meaning the clinic's today without any
 * time-zone plumbing on the server. The window is bounded — see the route —
 * so this is dozens of kilobytes, not the whole register.
 */

export interface TodayVisit {
  id: string;
  slip_number: string;
  registered_at: string;
  first_name: string | null;
  surname: string | null;
  referred_by: string | null;
  referring_doctor_id: string | null;
  referring_facility_id: string | null;
  commission_assigned: boolean;
  commission_amount: number;
  commission_status: 'pending' | 'paid' | null;
  commission_paid_at: string | null;
  net_amount: number;
  paid_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method: string | null;
}

export interface TodayTest {
  id: string;
  patient_id: string;
  test_name: string;
  department: 'lab' | 'radiology';
  status: 'pending' | 'in_progress' | 'completed';
  completed_by: string | null;
  completed_by_profile_id: string | null;
  completed_at: string | null;
  price: number;
  commission_amount: number;
  /** The result flags — 'HH' and 'LL' are critical. Empty when unfinished. */
  flags: string[];
  /** Whether a critical value on this test was acknowledged at the bench. */
  acknowledged: boolean;
  /** From the visit: when the patient arrived. */
  registered_at: string;
  patient_name: string;
  slip_number: string;
}

export interface TodayLedgerRow {
  created_at: string;
  type: string;
  amount: number;
  created_by: string | null;
}

export interface TodayChargeRow {
  created_at: string;
  amount: number;
  department: string;
  created_by: string | null;
}

export interface TodayStaffRow {
  id: string;
  full_name: string | null;
  role: string | null;
  signature_url: string | null;
}

export interface TodayReferrerRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface TodayPendingTestRow {
  id: string;
  name: string;
  department: string;
}

export interface TodayInviteRow {
  id: string;
  email: string;
  role: string;
  expires_at: string | null;
}

export interface TodayPayload {
  generatedAt: string;
  /** The start of the bounded window the dated rows were fetched from. */
  since: string;
  /** Visits registered since `since`, plus any unpaid or commission-owing visit of any date. */
  visits: TodayVisit[];
  /** Tests of visits registered since `since`, plus any unfinished test of any date. */
  tests: TodayTest[];
  ledger: TodayLedgerRow[];
  charges: TodayChargeRow[];
  staff: TodayStaffRow[];
  doctors: TodayReferrerRow[];
  facilities: TodayReferrerRow[];
  /** Custom investigations switched off — usually awaiting a price. */
  pendingTests: TodayPendingTestRow[];
  /** Cloud only. A hub cannot see invitations and sends null. */
  invites: TodayInviteRow[] | null;
  /** Whether a date-unbounded set hit its cap, so the figure is a floor. */
  truncated: { unpaid: boolean; pendingCommission: boolean; unfinished: boolean };
}

/** How many rows a date-unbounded set may carry before it is cut. */
export const TODAY_ROW_CAP = 500;
/** 30 days shown + 30 days compared against + a day of slack. */
export const TODAY_WINDOW_DAYS = 61;
