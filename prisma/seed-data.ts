export function buildInitialTables() {
  return Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;

    return {
      number,
      name: `Masa ${number}`,
      sortOrder: number,
      isActive: true,
    };
  });
}
