import type { Timestamp } from '@google-cloud/firestore';

export interface SDKKeyDocument {
  id: string;
  name: string;
  projectId: string;
  hashedKey: string;
  createdAt: Timestamp;
  lastUsedAt: Timestamp | null;
  revokedAt: Timestamp | null;
}

export interface CreateSDKKeyRequest {
  name: string;
  projectId: string;
}

export interface SDKKeyMetadata {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
