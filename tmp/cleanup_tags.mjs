import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/admin/BookingTable.tsx';
let data = readFileSync(filePath, 'utf8');

// Specific repair for the broken closing tags at lines 537-542
const brokenTagsRegex = /\s*}\)\s*\}\s*<\/div>\s*<\/div>\s*<\/div>/g;

// Replacing the specific region that has the extra nested closes
const badPart = `      </div>
                                                )}
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </div>`;

const goodPart = `      </div>
                                         </div>
                                      </div>`;

// Since the file has many divs, replacing the specific block at the end of the expanded section.
const tableGridEnd = /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/td>\s*<\/tr>/;

// Looking for the exact pattern from the previous view_file around line 536-544
const targetSequence = `                                         </div>
                                      </div>
                                                )}
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </div>`;

if (data.includes(targetSequence)) {
    data = data.replace(targetSequence, `                                         </div>
                                      </div>`);
    writeFileSync(filePath, data);
    console.log('Successfully repaired BookingTable.tsx closing tags.');
} else {
    console.error('Target sequence not found in BookingTable.tsx. Attempting backup regex...');
    // Fallback: search for the specific notes block end
    const notesBlockEnd = /<\/div>\s*<\/div>\s*<\/div>\s*<\/\s*React\.Fragment>/;
    // ... we need to be careful with the map loop
}
