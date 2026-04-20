export interface CategoryColor {
  fill: string
  stroke: string
}

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  central_heating_energy: {
    fill: "oklch(0.68 0.14 55)",
    stroke: "oklch(0.75 0.14 55)",
  },
  cold_water_and_sewage: {
    fill: "oklch(0.65 0.12 195)",
    stroke: "oklch(0.72 0.12 195)",
  },
  e_kartoteka_access: {
    fill: "oklch(0.55 0.03 260)",
    stroke: "oklch(0.62 0.03 260)",
  },
  hot_water_heating: {
    fill: "oklch(0.62 0.11 175)",
    stroke: "oklch(0.70 0.11 175)",
  },
  municipal_waste: {
    fill: "oklch(0.62 0.10 105)",
    stroke: "oklch(0.70 0.10 105)",
  },
  ordered_heating_power: {
    fill: "oklch(0.60 0.12 15)",
    stroke: "oklch(0.68 0.12 15)",
  },
  renovation_investment_fund: {
    fill: "oklch(0.58 0.14 290)",
    stroke: "oklch(0.66 0.14 290)",
  },
  shared_property_advance: {
    fill: "oklch(0.65 0.12 240)",
    stroke: "oklch(0.72 0.12 240)",
  },
}

const DEFAULT_CATEGORY_COLOR: CategoryColor = {
  fill: "oklch(0.50 0.05 260)",
  stroke: "oklch(0.58 0.05 260)",
}

export function getCategoryColor(category: string): CategoryColor {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR
}
