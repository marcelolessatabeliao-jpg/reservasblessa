import fs from 'fs';
const filePath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The 5th button (Vendas) should span 2 columns on mobile
const vendasButtonRegex = /<button onClick=\{\(\) => setActiveTab\('vendas'\)\} className=\{cn\(\s+"px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-\[11px\] md:text-\[13px\] font-black flex items-center justify-center gap-1\.5 md:gap-2\.5 transition-all whitespace-nowrap", \s+activeTab === 'vendas'/;
const replacement = `<button onClick={() => setActiveTab('vendas')} className={cn(
               "col-span-2 lg:flex-1 px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'vendas'`;

if (content.match(vendasButtonRegex)) {
    content = content.replace(vendasButtonRegex, replacement);
    fs.writeFileSync(filePath, content);
    console.log('Update complete v6!');
} else {
    console.log('Regex not found. Trying simpler one.');
    content = content.replace(/setActiveTab\('vendas'\)\}\s+className=\{cn\(\s+"px-4 md:px-8/, "setActiveTab('vendas')} className={cn(\"col-span-2 lg:flex-1 px-4 md:px-8");
    fs.writeFileSync(filePath, content);
    console.log('Update complete v6 (simplified)!');
}
