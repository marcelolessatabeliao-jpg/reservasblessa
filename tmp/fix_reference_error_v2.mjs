import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The block that is currently broken:
// 503:       // 2. Create Booking
// 504:       const { data: booking, error: bError } = await supabase.from('bookings').insert({

// Let's use a more robust replacement that doesn't depend on too much context.

const bookingInsertSearch = `      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        adults: adults_normal + adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity + is_pcd + is_tea + is_senior + is_birthday,
        children: Array(children_free).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();`;

const bookingInsertReplace = `      // 0. Define Local Link
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

const newData = data.replace(bookingInsertSearch, bookingInsertReplace);

if (newData === data) {
    console.error("FAILED TO REPLACE! Space or indentation issue?");
    // Try regex
    const regex = /\/\/ 2\. Create Booking\s+const \{ data: booking, error: bError \} = await supabase\.from\('bookings'\)\.insert\(\{[\s\S]*?\}\)\.select\(\)\.single\(\);/;
    data = data.replace(regex, bookingInsertReplace);
} else {
    data = newData;
}

writeFileSync(adminPath, data);
console.log('Fixed ReferenceError in Admin.tsx: confCode is now defined.');
