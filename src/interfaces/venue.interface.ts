export interface IVenue {
  _id?: string;
  name: string;
  city: string;
  state?: string;
  country: string;
  capacity?: number;
  established?: number;
  yearOfFirstMatch?: number;
  knownAs?: string;
  association?: string;
  image?: string;
  timezone: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  pitchType: 'batting' | 'bowling' | 'balanced';
  suitedFor?: 'pace' | 'spin';
  avgFirstInningsScore?: {
    test?: number;
    odi?: number;
    t20?: number;
  };
  groundSize?: 'small' | 'medium' | 'large';
  groundDimensions?: {
    topEndName?: string;
    bottomEndName?: string;
    distances?: {
      top?: number;
      topRight?: number;
      right?: number;
      bottomRight?: number;
      bottom?: number;
      bottomLeft?: number;
      left?: number;
      topLeft?: number;
    };
  };
  pitchDescription?: {
    dusty?: string;
    green?: string;
    dead?: string;
  };
  bio?: string;
  isActive: boolean;
  createdAt?: Date;
}

export interface IVenueResponse {
  success: boolean;
  data: IVenue;
  message?: string;
}

export interface IPaginatedVenueResponse {
  success: boolean;
  data: {
    venues: IVenue[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

