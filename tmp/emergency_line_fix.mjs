import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/admin/BookingTable.tsx';
const lines = readFileSync(filePath, 'utf8').split('\n');

// The problematic lines are 537-542 based on the last view_file.
// In 1-indexed view_file, they correspond to lines[536] to lines[541].
// Let's verify we are at the right place by checking the content.
if (lines[536].includes(')}') && lines[541].includes('</div>')) {
    console.log('Target lines identified. Removing lines 537-542...');
    // Splice removes from 536 for 6 lines.
    lines.splice(536, 6);
    writeFileSync(filePath, lines.join('\n'));
    console.log('Successfully repaired BookingTable.tsx.');
} else {
    console.error('Line content mismatch. Cannot proceed with line removal.');
    console.log('Line 537:', lines[536]);
    console.log('Line 542:', lines[541]);
}
