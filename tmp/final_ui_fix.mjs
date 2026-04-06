import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. COMPACT UI (Internal Booking Modal)
content = content.replace(/p-10/g, 'p-6');
content = content.replace(/gap-10/g, 'gap-4');
content = content.replace(/rounded-\[3rem\]/g, 'rounded-[2.5rem]');
content = content.replace(/space-y-10/g, 'space-y-6');

// 2. DATE INPUT REPLACEMENT
const oldDateInputRegex = /<Input\s+type="date"\s+value=\{newBookingData\.visit_date\}[\s\S]*?disabled=\{isFetchingAvail\}\s+\/>/;
const newDateInput = `<Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-14 w-full rounded-2xl border-2 border-emerald-100 font-black bg-white text-emerald-950 justify-start px-4",
                                      !newBookingData.visit_date && "text-emerald-400"
                                    )}
                                    disabled={isFetchingAvail}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 text-emerald-600" />
                                    {newBookingData.visit_date ? format(parseISO(newBookingData.visit_date), 'dd/MM/yyyy') : "DD/MM/AAAA"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden border-2 border-emerald-100 shadow-2xl" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={newBookingData.visit_date ? parseISO(newBookingData.visit_date) : undefined}
                                    onSelect={(date) => setNewBookingData({...newBookingData, visit_date: date ? format(date, 'yyyy-MM-dd') : ''})}
                                    locale={ptBR}
                                    className="p-4"
                                    toDate={new Date(2030, 11, 31)}
                                    fromDate={new Date()}
                                    disabled={(date) => !isAllowedDay(date)}
                                    classNames={{
                                      month: "space-y-4",
                                      caption: "flex justify-center pt-1 relative items-center mb-2 bg-emerald-800 rounded-xl py-3 border-2 border-emerald-900 shadow-lg w-full",
                                      caption_label: "text-sm font-black text-white uppercase tracking-widest",
                                      nav: "flex items-center justify-between absolute inset-x-0 inset-y-0 px-4 pointer-events-none z-30",
                                      nav_button: "h-8 w-8 bg-emerald-500 text-white border border-emerald-400 hover:bg-emerald-400 shadow-md rounded-lg transition-all pointer-events-auto flex items-center justify-center",
                                      nav_button_previous: "relative left-0",
                                      nav_button_next: "relative right-0",
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>`;

if (oldDateInputRegex.test(content)) {
    content = content.replace(oldDateInputRegex, newDateInput);
}

// 3. DISCOUNT UI REPLACEMENT
const oldDiscountInputRegex = /<Input\s+type="number"\s+min="0"\s+value=\{newBookingData\.manual_discount\}[\s\S]*?placeholder="0,00"\s+\/>/;
const newDiscountInput = `<div className="flex gap-2">
                                           <Input 
                                              type="number" 
                                              min="0" 
                                              value={newBookingData.manual_discount}
                                              onChange={e => setNewBookingData({...newBookingData, manual_discount: parseFloat(e.target.value) || 0})}
                                              className="h-12 bg-white/10 border-white/20 text-white rounded-xl focus:ring-emerald-500 placeholder:text-white/20 font-bold flex-1"
                                              placeholder="0,00"
                                           />
                                           <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
                                              <button 
                                                onClick={() => setNewBookingData({...newBookingData, manual_discount_type: 'unit'})}
                                                className={cn("px-3 rounded-lg text-[10px] font-black transition-all", newBookingData.manual_discount_type === 'unit' ? "bg-emerald-500 text-white shadow-lg" : "text-emerald-100 hover:text-white")}
                                              >R$</button>
                                              <button 
                                                onClick={() => setNewBookingData({...newBookingData, manual_discount_type: 'percent'})}
                                                className={cn("px-3 rounded-lg text-[10px] font-black transition-all", newBookingData.manual_discount_type === 'percent' ? "bg-emerald-500 text-white shadow-lg" : "text-emerald-100 hover:text-white")}
                                              >%</button>
                                           </div>
                                        </div>`;

if (oldDiscountInputRegex.test(content)) {
    content = content.replace(oldDiscountInputRegex, newDiscountInput);
}

fs.writeFileSync(filePath, content);
console.log('Final UI fixes applied to Admin.tsx');
