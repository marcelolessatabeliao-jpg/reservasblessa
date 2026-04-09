import re
import os

path = r'c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\components\admin\BookingTable.tsx'
if not os.path.exists(path):
    print("File not found")
    exit(1)

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# The new message string with Unicode escapes for emojis
# Using raw string to avoid escaping backslashes, but we still need to handle ${}
new_msg_content = r'\u{1F33F} *BALNEÁRIO FAMÍLIA LESSA*\n\nEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n\u{1F4C5} *Data:* ${dateStr}\n\u{1F464} *Titular:* ${name}\n\n\u{1F4DD} *Resumo do Pedido:*\n${itemsList.replace(/%0A/g, "\n")}\n\n\u{1F4B0} *Total:* ${formatCurrency(booking.total_amount)}\n\nVoucher: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}\n\n\u{2728} *Aguardamos vocês para o lazer que a sua família merece.*'

# Regex to find the existing message block. 
# It looks for ` followed by any characters (non-greedy) until the end of the sentence and the closing `
pattern = r'`.*?FAMÍLIA LESSA.*?familia merece\.\*`'

# We replace it with ` + new_msg_content + `
def replacer(match):
    return "`" + new_msg_content + "`"

new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully replaced emoji blocks")
