"use client";

import { create } from "zustand";

export type DashboardUiFilters = {
  datasetId: string;
  campus?: string;
  majorDescription?: string;
  classStanding?: string;
  studentType?: string;
  gpaRange: [number, number];
  excludeZeroGpa: boolean;
};

type CategoricalKey = "campus" | "majorDescription" | "classStanding" | "studentType";

type DashboardFilterStore = DashboardUiFilters & {
  setPartial: (patch: Partial<DashboardUiFilters>) => void;
  setDataset: (datasetId: string) => void;
  toggleCategorical: (key: CategoricalKey, value?: string) => void;
  clearFilters: (defaultGpaRange?: [number, number]) => void;
};

const initialState: DashboardUiFilters = {
  datasetId: "",
  gpaRange: [0, 4],
  excludeZeroGpa: false
};

export const useDashboardFilterStore = create<DashboardFilterStore>((set, get) => ({
  ...initialState,
  setPartial: (patch) => set((state) => ({ ...state, ...patch })),
  setDataset: (datasetId) =>
    set({
      datasetId,
      campus: undefined,
      majorDescription: undefined,
      classStanding: undefined,
      studentType: undefined,
      gpaRange: [0, 4],
      excludeZeroGpa: false
    }),
  toggleCategorical: (key, value) =>
    set((state) => {
      const nextValue = value?.trim() ? value : undefined;
      return {
        ...state,
        [key]: state[key] === nextValue ? undefined : nextValue
      };
    }),
  clearFilters: (defaultGpaRange) => {
    const datasetId = get().datasetId;
    set({
      datasetId,
      campus: undefined,
      majorDescription: undefined,
      classStanding: undefined,
      studentType: undefined,
      gpaRange: defaultGpaRange ?? [0, 4],
      excludeZeroGpa: false
    });
  }
}));
