Balneário Lessa booking site - Brazilian nature resort reservation system

## Design System
- Primary: Forest Green hsl(113 38% 25%)
- Secondary: Earth Brown hsl(24 41% 39%)
- WhatsApp CTA: hsl(142 69% 49%)
- Highlight: Sun Yellow hsl(48 96% 53%)
- Display font: Montserrat, Body: Inter
- Mobile-first, sticky cart summary

## Architecture
- Booking state in useBooking hook
- Services: Entries, Kiosks, Quadricycle, Additionals
- WhatsApp finalization with auto-generated message
- Confirmation code auto-generated (6-char) on insert via DB trigger
- Phone field in booking form
- Admin panel at /admin with password auth via edge function
- Realtime updates on bookings table
- Edge functions: admin-auth, update-booking-status (supports status + notes)
- DB columns: confirmation_code, phone, notes, checked_in_at
