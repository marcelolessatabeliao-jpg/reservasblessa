import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// 1. Correct the nameMatch and matchDate placements if needed
// 2. Fix the relatedOrder matching to be even more robust
const matchingSearch = /const relatedOrder = \(orderData \|\| \[\]\)\.find\(o => \s+\(o\.confirmation_code === b\.confirmation_code && b\.confirmation_code\) \|\| \s+\(nameMatch\(o\.customer_name, b\.name\) && matchDate\(o\.visit_date, b\.visit_date\)\)\s+\);/;
const matchingReplace = `const relatedOrder = (orderData || []).find(o => 
          (o.confirmation_code && b.confirmation_code && o.confirmation_code === b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && matchDate(o.visit_date, b.visit_date))
        );`;
data = data.replace(matchingSearch, matchingReplace);

// 3. THE CRITICAL FIX: Ensure flattenedBks uses enrichedBookings
const flattenedSearch = /const flattenedBks = \(bks \|\| \[\]\)\.map\(b => \{/;
const flattenedReplace = `const flattenedBks = (enrichedBookings || []).map(b => {`;
data = data.replace(flattenedSearch, flattenedReplace);

// 4. Ensure totals calculation also uses enrichedBookings
data = data.replace('\[...(bks || []),', '[...(enrichedBookings || []),');

writeFileSync(adminPath, data);
console.log('Fixed Critical Overwrite BUG: flattenedBks now uses enrichedBookings');
