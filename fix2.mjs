import fs from 'fs';
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

const regex = /             <\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*\);\s*return \(/;

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
  console.log('Fixed syntax error via wide regex in Admin.tsx');
} else {
  console.log('Wide regex still failed.');
}
