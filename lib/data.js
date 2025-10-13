export const dummyTrips = [
  {
    id: '1',
    origin: { city: 'Lisboa', province: 'Lisboa' },
    destination: { city: 'Porto', province: 'Porto' },
    departureTime: '2025-10-20T08:00:00Z',
    arrivalTime: '2025-10-20T11:30:00Z',
    price: 25.50,
    company: 'Nawabus Express',
    availableSeats: 15,
    seatClass: 'economy',
    bus: { make: 'Mercedes', model: 'Tourismo', amenities: ['wifi', 'ac'] }
  },
  {
    id: '2',
    origin: { city: 'Lisboa', province: 'Lisboa' },
    destination: { city: 'Porto', province: 'Porto' },
    departureTime: '2025-10-20T10:00:00Z',
    arrivalTime: '2025-10-20T13:30:00Z',
    price: 35.00,
    company: 'Nawabus Comfort',
    availableSeats: 30,
    seatClass: 'business',
    bus: { make: 'Volvo', model: '9900', amenities: ['wifi', 'ac', 'toilet', 'power_outlets'] }
  },
  {
    id: '3',
    origin: { city: 'Faro', province: 'Algarve' },
    destination: { city: 'Lisboa', province: 'Lisboa' },
    departureTime: '2025-10-20T14:00:00Z',
    arrivalTime: '2025-10-20T17:00:00Z',
    price: 18.75,
    company: 'Nawabus Express',
    availableSeats: 5,
    seatClass: 'economy',
    bus: { make: 'Setra', model: 'S 516 HD', amenities: ['wifi', 'ac'] }
  },
  {
    id: '4',
    origin: { city: 'Porto', province: 'Porto' },
    destination: { city: 'Coimbra', province: 'Coimbra' },
    departureTime: '2025-10-21T09:30:00Z',
    arrivalTime: '2025-10-21T11:00:00Z',
    price: 12.00,
    company: 'Nawabus Connect',
    availableSeats: 22,
    seatClass: 'economy',
    bus: { make: 'Irizar', model: 'i6', amenities: ['ac'] }
  }
];
