import sys
import os

src = r'c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\pages\Admin.tsx'
dst = r'c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\pages\Admin_new.tsx'

replacements = {
    378: ("b.status === 'paid') {", "b.status === 'paid' || b.status === 'pending') {"),
    2075: ("Meia/Solid\u00e1rio", "Meia-Entrada"),
    2076: ("{ k: 'adults_free', l: 'Especial (PCD/Idoso)', p: 'Gr\u00e1tis' },",
           "{ k: 'is_teacher', l: 'Professor', p: 'R$ 25' },\r\n                                 { k: 'is_student', l: 'Estudante', p: 'R$ 25' },\r\n                                 { k: 'is_server', l: 'Servidor', p: 'R$ 25' },\r\n                                 { k: 'is_donor', l: 'Doador Sangue', p: 'R$ 25' },\r\n                                 { k: 'is_solidarity', l: 'Adulto Solid\u00e1rio', p: 'R$ 25' },\r\n                                 { k: 'is_pcd', l: 'PCD', p: 'Gr\u00e1tis' },\r\n                                 { k: 'is_tea', l: 'TEA', p: 'Gr\u00e1tis' },\r\n                                 { k: 'is_senior', l: 'Idoso (60+)', p: 'Gr\u00e1tis' },\r\n                                 { k: 'is_birthday', l: 'Aniversariante', p: 'Gr\u00e1tis' },"),
}

with open(src, 'rb') as fin, open(dst, 'wb') as fout:
    linenum = 0
    for raw in fin:
        linenum += 1
        if linenum in replacements:
            old, new = replacements[linenum]
            decoded = raw.decode('utf-8', errors='replace')
            if old in decoded:
                decoded = decoded.replace(old, new, 1)
                print(f'Line {linenum}: replaced')
            raw = decoded.encode('utf-8')
        fout.write(raw)

print(f'Done. Total lines: {linenum}')
os.replace(dst, src)
print('File replaced.')
