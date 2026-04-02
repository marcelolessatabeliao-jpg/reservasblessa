import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// 1. Fix the ReferenceError by properly defining confCode and using it in both inserts
const bookingInsertOld = `      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        adults: adults_normal + adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity + is_pcd + is_tea + is_senior + is_birthday,
        children: Array(children_free).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();`;

const bookingInsertNew = `      // 0. Generate Unique Code for Linking
      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        confirmation_code: confCode,
        adults: adults_normal + adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity + is_pcd + is_tea + is_senior + is_birthday,
        children: Array(children_free).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();`;

data = data.replace(bookingInsertOld, bookingInsertNew);

writeFileSync(adminPath, data);
console.log('Fixed ReferenceError: confCode is now defined and shared between booking and order.');
