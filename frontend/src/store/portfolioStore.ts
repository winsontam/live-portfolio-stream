import { create } from 'zustand';

export interface Position {
  productId: string;
  qty: number;
  avgCost: number;
}

interface PortfolioState {
  positions: Position[];
  setPositions: (positions: Position[]) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),
}));
