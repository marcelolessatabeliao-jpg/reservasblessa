export const isValidCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let s = 0;
  for (let i = 1; i <= 9; i++) s = s + parseInt(clean.substring(i - 1, i)) * (11 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(clean.substring(9, 10))) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s = s + parseInt(clean.substring(i - 1, i)) * (12 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(clean.substring(10, 11))) return false;
  return true;
};
