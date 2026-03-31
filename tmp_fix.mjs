import fs from 'fs';
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

const target = `       </div>
    </div>
  );`;

const replacement = `              )}
            </div>
          </div>
        </div>
      </div>
    );`;

if (data.includes(target)) {
  data = data.replace(target, replacement);
  fs.writeFileSync(path, data);
  console.log('Fixed syntax error in Admin.tsx');
} else {
  console.log('Target string not found, outputting context:');
  const lines = data.split('\n');
  const i = lines.findIndex(l => l.includes('   );'));
  console.log(lines.slice(Math.max(0, i - 10), i + 5).join('\n'));
}
