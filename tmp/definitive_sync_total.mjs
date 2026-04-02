import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// 1. ADD UTILITIES before fetchData
const utilities = `  const matchDate = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const s1 = typeof d1 === 'string' ? d1.split('T')[0] : format(d1, 'yyyy-MM-dd');
    const s2 = typeof d2 === 'string' ? d2.split('T')[0] : format(d2, 'yyyy-MM-dd');
    return s1 === s2;
  };
  const nameMatch = (n1: string, n2: string) => (n1 || '').toLowerCase().trim() === (n2 || '').toLowerCase().trim();
`;

data = data.replace('  const fetchData = useCallback(async () => {', utilities + '  const fetchData = useCallback(async () => {');

// 2. Fix linking logic in fetchData (fallback: name + matchDate)
const linkingOld = `const nameMatch = (name1, name2) => (name1 || '').toLowerCase().trim() === (name2 || '').toLowerCase().trim();
        const relatedOrder = (orderData || []).find(o => 
          (o.confirmation_code === b.confirmation_code && b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && (o.visit_date === b.visit_date))
        );`;

const linkingNew = `const relatedOrder = (orderData || []).find(o => 
          (o.confirmation_code === b.confirmation_code && b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && matchDate(o.visit_date, b.visit_date))
        );`;

data = data.replace(linkingOld, linkingNew);

// 3. Fix filters in renderDashboard (Date Normalization)
data = data.replace('d === format(targetDate, \'yyyy-MM-dd\')', 'matchDate(d, targetDate)');
data = data.replace('b.visit_date === format(targetDate, \'yyyy-MM-dd\')', 'matchDate(b.visit_date, targetDate)');
data = data.replace('(o.visit_date || o.created_at.split(\'T\')[0]) === format(targetDate, \'yyyy-MM-dd\')', 'matchDate(o.visit_date || o.created_at, targetDate)');

// 4. Fix Kiosk ID Parser Regex (Double backslash needed for string output)
const kioskRegexOld = `const kioskIdMatch = pNameLower.match(/quiosques*(d+)/i);`;
const kioskRegexNew = `const kioskIdMatch = pNameLower.match(/quiosque\\s*(\\d+)/i);`;
data = data.replace(kioskRegexOld, kioskRegexNew);

// 5. Broaden Quad Keywords again to be double sure
data = data.replace('const quadKeywords = [\'quadri\', \'passeio\', \'quadriciclo\'];', 'const quadKeywords = [\'quadri\', \'passeio\', \'quadriciclo\', \'quadricido\'];');

writeFileSync(adminPath, data);
console.log('Fixed Multi-point sync errors definitively');
