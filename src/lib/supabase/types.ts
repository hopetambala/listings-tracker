/**
 * Supabase TypeScript types for listings-tracker
 * Extended from base Supabase types to include listings-tracker tables
 */

export type Database = {
  public: {
    Tables: {
      listings_tracker_properties: {
        Row: {
          id: string;
          admin_id: string;
          listing_link: string;
          street_address: string | null;
          mls_number: string | null;
          listing_price: number;
          sold_price: number | null;
          notes: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["listings_tracker_properties"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["listings_tracker_properties"]["Insert"]
        >;
      };
      listings_tracker_prices: {
        Row: {
          id: string;
          property_id: string;
          price: number;
          recorded_at: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["listings_tracker_prices"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["listings_tracker_prices"]["Insert"]
        >;
      };
      listings_tracker_photos: {
        Row: {
          id: string;
          property_id: string;
          photo_url: string;
          uploaded_by: string | null;
          uploaded_at: string;
          notes: string | null;
          display_order: number;
          is_key_photo: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["listings_tracker_photos"]["Row"],
          "id" | "created_at" | "uploaded_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["listings_tracker_photos"]["Insert"]
        >;
      };
      listings_tracker_access_codes: {
        Row: {
          id: string;
          property_id: string;
          code: string;
          created_at: string;
          created_by: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["listings_tracker_access_codes"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["listings_tracker_access_codes"]["Insert"]
        >;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
