export interface OfficeLocation {
  locationId: number;
  locationCode: string;
  locationName: string;
  locationNameAr: string;
  locationType: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  country: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface OfficeLocationRequest {
  locationCode: string;
  locationName: string;
  locationNameAr: string;
  locationType: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  country: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
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
