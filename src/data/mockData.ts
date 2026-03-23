import { Trip, Agency, Booking } from "@/types/transport";

export const agencies: Agency[] = [
  { id: "1", name: "OCEAN du Nord", logo: "🚌", rating: 4.5, totalTrips: 1250 },
  { id: "2", name: "TransBony", logo: "🚐", rating: 4.2, totalTrips: 890 },
  { id: "3", name: "Étoile de Stelmac", logo: "⭐", rating: 4.7, totalTrips: 2100 },
  { id: "4", name: "Trans Congo Express", logo: "🚍", rating: 4.0, totalTrips: 650 },
];

export const cities = [
  "Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Ouesso",
  "Owando", "Impfondo", "Madingou", "Sibiti", "Kinkala"
];

export const trips: Trip[] = [
  {
    id: "t1", agencyId: "1", agencyName: "OCEAN du Nord",
    departure: "Brazzaville", destination: "Pointe-Noire",
    departureTime: "06:00", arrivalTime: "14:00",
    date: "2026-03-25", price: 15000, currency: "FCFA",
    totalSeats: 50, availableSeats: 12, busType: "VIP Climatisé",
  },
  {
    id: "t2", agencyId: "2", agencyName: "TransBony",
    departure: "Brazzaville", destination: "Pointe-Noire",
    departureTime: "07:30", arrivalTime: "15:30",
    date: "2026-03-25", price: 12000, currency: "FCFA",
    totalSeats: 60, availableSeats: 25, busType: "Standard",
  },
  {
    id: "t3", agencyId: "3", agencyName: "Étoile de Stelmac",
    departure: "Brazzaville", destination: "Dolisie",
    departureTime: "08:00", arrivalTime: "14:00",
    date: "2026-03-25", price: 10000, currency: "FCFA",
    totalSeats: 45, availableSeats: 5, busType: "Semi-luxe",
  },
  {
    id: "t4", agencyId: "1", agencyName: "OCEAN du Nord",
    departure: "Pointe-Noire", destination: "Brazzaville",
    departureTime: "09:00", arrivalTime: "17:00",
    date: "2026-03-26", price: 15000, currency: "FCFA",
    totalSeats: 50, availableSeats: 30, busType: "VIP Climatisé",
  },
  {
    id: "t5", agencyId: "4", agencyName: "Trans Congo Express",
    departure: "Brazzaville", destination: "Nkayi",
    departureTime: "06:30", arrivalTime: "11:00",
    date: "2026-03-25", price: 8000, currency: "FCFA",
    totalSeats: 40, availableSeats: 18, busType: "Standard",
  },
  {
    id: "t6", agencyId: "3", agencyName: "Étoile de Stelmac",
    departure: "Dolisie", destination: "Pointe-Noire",
    departureTime: "10:00", arrivalTime: "13:00",
    date: "2026-03-26", price: 7000, currency: "FCFA",
    totalSeats: 45, availableSeats: 40, busType: "Semi-luxe",
  },
];

export const sampleBookings: Booking[] = [
  {
    id: "b1", tripId: "t1", trip: trips[0],
    passengerName: "Jean Makaya", phone: "+242 06 123 4567",
    seatNumber: 12, status: "confirmed",
    paymentMethod: "MTN MoMo", paymentStatus: "paid",
    bookingDate: "2026-03-23", qrCode: "TCKT-2026-001-BPG",
    totalAmount: 15000,
  },
  {
    id: "b2", tripId: "t3", trip: trips[2],
    passengerName: "Jean Makaya", phone: "+242 06 123 4567",
    seatNumber: 5, status: "completed",
    paymentMethod: "Airtel Money", paymentStatus: "paid",
    bookingDate: "2026-03-20", qrCode: "TCKT-2026-002-BDL",
    totalAmount: 10000,
  },
];
