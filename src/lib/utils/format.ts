
export const formatPhone = (val: string) => {
  const raw = val.replace(/\D/g, '').slice(0, 11);
  if (!raw) return '';
  if (raw.length <= 2) return `(${raw}`;
  if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
};

export const unformatPhone = (val: string) => {
  return val.replace(/\D/g, '').slice(0, 11);
};
