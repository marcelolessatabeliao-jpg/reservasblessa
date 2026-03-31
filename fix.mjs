import fs from 'fs';
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

const regex = /             <\/tbody>\n          <\/table>\n       <\/div>\n    <\/div>\n  \);\n\n  return \(/;

const replacement = `             </tbody>
          </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (`;

if (regex.test(data)) {
  data = data.replace(regex, replacement);
  fs.writeFileSync(path, data);
  console.log('Fixed syntax error in Admin.tsx');
} else {
  console.log('Regex did not match. Current lines around table:');
  const lines = data.split('\n');
  const tableEnd = lines.findIndex(l => l.includes('</table>'));
  if (tableEnd > -1 && tableEnd > 800) {
     console.log(lines.slice(tableEnd - 2, tableEnd + 10).join('\\n'));
  }
}
