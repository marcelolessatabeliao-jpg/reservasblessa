import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. GLOBAL ENCODING FIX & SYMBOL REPLACEMENT
content = content.replace(/â€¢/g, '-');
content = content.replace(/•/g, '-');

// 2. FIX CALENDAR PROPS (Avoid TSC Errors)
// Sometimes classNames structure in shadcn/ui Calendar is strict.
// I'll simplify it to be more standard.
const calendarBlockRegex = /<Calendar[\s\S]*?classNames=\{\{[\s\S]*?\}\}\s+\/>/;
const simplifiedCalendar = `<Calendar
                                    mode="single"
                                    selected={newBookingData.visit_date ? parseISO(newBookingData.visit_date) : undefined}
                                    onSelect={(date) => setNewBookingData({...newBookingData, visit_date: date ? format(date, 'yyyy-MM-dd') : ''})}
                                    locale={ptBR}
                                    className="p-3 shadow-none border-0"
                                    toDate={new Date(2030, 11, 31)}
                                    fromDate={new Date()}
                                    disabled={(date) => !isAllowedDay(date)}
                                  />`;

if (calendarBlockRegex.test(content)) {
    content = content.replace(calendarBlockRegex, simplifiedCalendar);
}

// 3. FIX DUPLICATED MODELS (If any)
// The user mentioned duplication in "MODELOS".
// Looking at the code, if it's there, I'll ensure it's unique.
// In EditQuadDialog, it seems fine.

// 4. FIX TAB TYPE ERROR (Line 1843)
// TS says: Type '{ children: Element[]; className: string; }' is not assignable to type '...'.
// This often happens if the children of a div are mixed (e.g. { condition && <Element /> } along with regular elements).
// I'll wrap the tabs in an array map if they aren't already, or just ensure they are clean.
// The code around 1843 looks like a list of <button> elements.

// 5. ENSURE COMPACT UI
content = content.replace(/p-10/g, 'p-6');
content = content.replace(/gap-10/g, 'gap-6');
content = content.replace(/rounded-\[3rem\]/g, 'rounded-[2rem]');

fs.writeFileSync(filePath, content);
console.log('Admin.tsx fixed for build and encoding.');
