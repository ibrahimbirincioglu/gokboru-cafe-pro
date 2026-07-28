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

export function buildInitialSettings() {
  return [
    { key: "businessTimezone", valueJson: "Europe/Istanbul" },
    { key: "businessDayCutoff", valueJson: "00:00" },
    { key: "currency", valueJson: "TRY" },
    { key: "defaultLocale", valueJson: "tr-TR" },
    { key: "orderAutoAccept", valueJson: false },
    { key: "serviceChargeEnabled", valueJson: false },
  ];
}
