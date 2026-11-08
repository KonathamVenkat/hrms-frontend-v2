export interface DocumentType {
  docTypeId: number;
  docTypeCode: string;
  docTypeName: string;
  docTypeNameAr: string;
  category: string;
  description?: string;
  isMandatory: boolean;
  hasExpiry: boolean;
  expiryNoticeDays: number;
  allowedExtensions: string;
  maxFileSizeMb: number;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface DocumentTypeRequest {
  docTypeCode: string;
  docTypeName: string;
  docTypeNameAr: string;
  category: string;
  description?: string;
  isMandatory: boolean;
  hasExpiry: boolean;
  expiryNoticeDays?: number;
  allowedExtensions?: string;
  maxFileSizeMb?: number;
  sortOrder: number;
  isActive?: boolean;
  /** The version the screen was opened with; the server refuses an edit made from an older one. */
  version?: number;
}
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
