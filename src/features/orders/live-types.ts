export type LiveOrderDto = {
  id: string;
  orderNumber: string;
  status: string;
  version: number;
  tableName: string;
  total: string;
  customerNote: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    note: string | null;
    options: string[];
  }>;
};

export type LiveTableDto = {
  id: string;
  name: string;
  number: number;
  state: "BOS" | "DOLU" | "PASIF";
  openTotal: string;
  lastOrderAt: string | null;
  paymentRequested: boolean;
};

export type LiveDashboardDto = {
  orders: LiveOrderDto[];
  tables: LiveTableDto[];
  generatedAt: string;
};
