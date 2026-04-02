import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/admin/BookingTable.tsx';
const content = readFileSync(filePath, 'utf8');

// We need to add one more closing div at the end of the expanded section.
// Specifically, after the grid ends at line 536.
const oldEnd = `                                         </div>
                                      </div>
                                </td>`;

const newEnd = `                                         </div>
                                      </div>
                                   </div>
                                </td>`;

if (content.includes(oldEnd)) {
    const newContent = content.replace(oldEnd, newEnd);
    writeFileSync(filePath, newContent);
    console.log('Fixed missing div in BookingTable.tsx.');
} else {
    console.error('Could not find the expected end sequence in BookingTable.tsx.');
}
