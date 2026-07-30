/**
 * Formata os nomes dos produtos exibidos nas reservas de acordo com o preço unitário e regras de negócios.
 */
export function formatProductDisplayName(
  productId: string | null | undefined,
  unitPrice: number,
  productName?: string | null | undefined
): string {
  const rawName = (productName || productId || '').trim();
  
  // Limpar prefixos como "1x " e espaços extras
  let displayName = rawName.replace(/^1x\s*/i, '').trim();
  
  const lower = displayName.toLowerCase();
  
  // Verifica se é uma variação genérica de adulto ou entrada
  const isAdultGeneric = 
    lower === 'adulto' || 
    lower === 'entrada' || 
    lower === 'adulto inteira' || 
    lower === 'entrada adulto' ||
    lower === 'entrada adulto inteira' ||
    lower === 'adulto solidario' ||
    lower === 'adulto solidário' ||
    lower === 'entrada adulto solidário' ||
    lower === 'entrada adulto solidario';

  if (isAdultGeneric) {
    if (Math.abs(unitPrice) < 0.01) {
      return 'Assinante Lessa Club';
    } else if (unitPrice <= 25 && unitPrice > 0) {
      return 'Entrada Adulto Solidário';
    } else {
      return 'Entrada Adulto Inteira';
    }
  }

  // Mapeamentos genéricos de criança
  if (
    lower === 'crianca' || 
    lower === 'criança' || 
    lower === 'criança grátis' || 
    lower === 'crianca gratis' || 
    lower === 'lessa kids'
  ) {
    return 'Entrada Criança';
  }
  if (lower === 'lessa kids pcd') {
    return 'Lessa Kids PCD';
  }

  // Mapeamentos genéricos de meia-entrada
  if (lower === 'meia' || lower === 'meia-entrada') {
    return 'Entrada Meia';
  }

  // Garante a capitalização correta para passes específicos
  if (lower === 'lessa inclusão' || lower === 'lessa inclusao') {
    return 'Lessa Inclusão';
  }
  if (lower === 'lessa vitalício' || lower === 'lessa vitalicio') {
    return 'Lessa Vitalício';
  }
  if (lower === 'lessa professor pass') {
    return 'Lessa Professor Pass';
  }
  if (lower === 'lessa doador pass') {
    return 'Lessa Doador Pass';
  }
  if (lower === 'lessa estudante pass') {
    return 'Lessa Estudante Pass';
  }
  if (lower === 'lessa servidor pass') {
    return 'Lessa Servidor Pass';
  }
  if (lower === 'associado lessa club' || lower === 'lessa club' || lower === 'assinante lessa club') {
    return 'Assinante Lessa Club';
  }
  if (lower === 'aniversariante' || lower === 'aniversariante pass' || lower === 'lessa aniversariante pass') {
    return 'Aniversariante';
  }

  return displayName || 'Serviço';
}
