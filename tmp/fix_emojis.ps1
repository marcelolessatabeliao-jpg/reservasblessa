$path = 'c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\components\admin\BookingTable.tsx'
$content = Get-Content $path
$newLine = '                                                             const message = `\u{1F33F} *BALNEÁRIO FAMÍLIA LESSA*\n\nEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n\u{1F4C5} *Data:* ${dateStr}\n\u{1F464} *Titular:* ${name}\n\n\u{1F4DD} *Resumo do Pedido:*\n${itemsList.replace(/%0A/g, ''\n'')}\n\n\u{1F4B0} *Total:* ${formatCurrency(booking.total_amount)}\n\nVoucher: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}\n\n\u{2728} *Aguardamos vocês para o lazer que a sua família merece.*`;'

# Array index is 0-based
$content[243] = $newLine
$content[582] = $newLine

$content | Set-Content $path -Encoding UTF8
