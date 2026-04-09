$path = 'c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\components\admin\BookingTable.tsx'
$content = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)

# Use Unicode escapes for EVERYTHING including accented characters
$line = '                                                             const message = `\u{1F33F} *BALNE\u00C1RIO FAM\u00CDLIA LESSA*\n\nEsse \u00E9 seu voucher de confirma\u00E7\u00E3o da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n\u{1F4C5} *Data:* ${dateStr}\n\u{1F464} *Titular:* ${name}\n\n\u{1F4DD} *Resumo do Pedido:*\n${itemsList.replace(/%0A/g, ''\n'')}\n\n\u{1F4B0} *Total:* ${formatCurrency(booking.total_amount)}\n\nVoucher: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}\n\n\u{2728} *Aguardamos voc\u00EAs para o lazer que a sua fam\u00EDlia merece.*`;'

$content[243] = $line
$content[582] = $line

[System.IO.File]::WriteAllLines($path, $content, (New-Object System.Text.UTF8Encoding($false)))
