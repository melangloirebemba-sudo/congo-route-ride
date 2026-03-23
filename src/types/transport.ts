export interface Agency {
  id: string;
  name: string;
  logo: string;
  rating: number;
  totalTrips: number;
}

export interface Trip {
  id: string;
  agencyId: string;
  agencyName: string;
  departure: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  currency: string;
  totalSeats: number;
  availableSeats: number;
  busType: string;
}

export interface Booking {
  id: string;
  tripId: string;
  trip: Trip;
  passengerName: string;
  phone: string;
  seatNumber: number;
  status: "confirmed" | "completed" | "cancelled";
  paymentMethod: string;
  paymentStatus: string;
  bookingDate: string;
  qrCode: string;
  totalAmount: number;
}
