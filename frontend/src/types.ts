export type Role = "BUYER" | "SUPPLIER";

export type AuctionStatus = "SCHEDULED" | "ACTIVE" | "CLOSED" | "FORCE_CLOSED";

export type TriggerType = "ANY_BID" | "ANY_RANK_CHANGE" | "L1_CHANGE_ONLY";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface RankedBid {
  id: number;
  supplierId: number;
  carrierName: string;
  freightCharge: number;
  originCharge: number;
  destinationCharge: number;
  totalAmount: number;
  transitTime: string;
  quoteValidityDays: number;
  submittedAt: string;
  label: string;
}

export interface RfqListItem {
  id: number;
  referenceId: string;
  status: AuctionStatus;
  bidCloseAt: string;
  forcedCloseAt: string;
  lowestBid: { carrierName: string; totalAmount: number } | null;
}

export type ActivityEventType = "BID_SUBMITTED" | "EXTENDED" | "CLOSED" | "FORCE_CLOSED";

export interface ActivityLogEntry {
  id: number;
  type: ActivityEventType;
  reason: string;
  createdAt: string;
  bid: { carrierName: string; totalAmount: number } | null;
}

export interface RfqDetail {
  id: number;
  referenceId: string;
  status: AuctionStatus;
  pickupDate: string;
  bidStartAt: string;
  bidCloseAt: string;
  forcedCloseAt: string;
  triggerWindowMin: number;
  extensionMin: number;
  triggerType: TriggerType;
  bids: RankedBid[];
  activityLog: ActivityLogEntry[];
}

export interface CreateRfqPayload {
  referenceId: string;
  pickupDate: string;
  bidStartAt: string;
  bidCloseAt: string;
  forcedCloseAt: string;
  triggerWindowMin: number;
  extensionMin: number;
  triggerType: TriggerType;
}

export interface SubmitBidPayload {
  carrierName: string;
  freightCharge: number;
  originCharge: number;
  destinationCharge: number;
  transitTime: string;
  quoteValidityDays: number;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
