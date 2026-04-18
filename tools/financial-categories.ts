import type { VaultRecord } from './schemas/record.ts';

type DocumentType = VaultRecord['document_type'];
type FinancialRowType = VaultRecord['financial_rows'][number]['row_type'];

export type NormalizedFinancialCategory = {
  category: string;
  categoryGroup: string | null;
};

const CATEGORY_ALIASES: Record<string, NormalizedFinancialCategory> = {
  energia_cieplna_co: { category: 'central_heating_energy', categoryGroup: 'media' },
  fundusz_remontowo_inwestycyjny: { category: 'renovation_investment_fund', categoryGroup: 'funds' },
  podgrzanie_wody: { category: 'hot_water_heating', categoryGroup: 'media' },
  uslugi_e_kartoteki: { category: 'e_kartoteka_access', categoryGroup: 'individual' },
  woda_i_scieki: { category: 'cold_water_and_sewage', categoryGroup: 'media' },
  wywoz_odpadow_komunalnych: { category: 'municipal_waste', categoryGroup: 'media' },
  zaliczka_czesc_wspolna: { category: 'shared_property_advance', categoryGroup: 'shared_property' },
  zamowiona_moc_cieplna: { category: 'ordered_heating_power', categoryGroup: 'media' },
  heat_energy_advances: { category: 'central_heating_advances', categoryGroup: 'media_settlement' },
  heat_energy_cost: { category: 'central_heating_cost', categoryGroup: 'media_settlement' },
  heat_energy_underpayment: { category: 'central_heating_underpayment', categoryGroup: 'media_settlement' },
  ekartoteka_service_advances: { category: 'e_kartoteka_access_advances', categoryGroup: 'media_settlement' },
  ekartoteka_service_cost: { category: 'e_kartoteka_access_cost', categoryGroup: 'media_settlement' },
  ekartoteka_service_overpayment: { category: 'e_kartoteka_access_overpayment', categoryGroup: 'media_settlement' },
  overall_media_overpayment: { category: 'media_settlement_net_overpayment', categoryGroup: 'media_settlement' },
};

const CATEGORY_GROUP_ALIASES: Record<string, string> = {
  fundusze: 'funds',
  oplaty_indywidualne: 'individual',
  utrzymanie_nieruchomosci_wspolnej: 'shared_property',
};

export function normalizeFinancialCategory(
  category: string,
  categoryGroup: string | null,
  options: {
    categoryOriginal?: string;
    documentType?: DocumentType;
    rowType?: FinancialRowType;
  } = {},
): NormalizedFinancialCategory {
  const categoryAlias = CATEGORY_ALIASES[category];

  if (categoryAlias) {
    return categoryAlias;
  }

  const labelMatch = normalizeCategoryFromLabel(
    options.categoryOriginal ?? category,
    options.documentType,
    options.rowType,
  );

  if (labelMatch) {
    return labelMatch;
  }

  if (categoryGroup && CATEGORY_GROUP_ALIASES[categoryGroup]) {
    return {
      category,
      categoryGroup: CATEGORY_GROUP_ALIASES[categoryGroup] ?? categoryGroup,
    };
  }

  return {
    category,
    categoryGroup,
  };
}

export function normalizeVaultRecordFinancialCategories(record: VaultRecord): VaultRecord {
  return {
    ...record,
    financial_rows: record.financial_rows.map((row) => {
      const normalized = normalizeFinancialCategory(row.category, row.category_group, {
        categoryOriginal: row.category_original,
        documentType: record.document_type,
        rowType: row.row_type,
      });

      if (
        normalized.category === row.category &&
        normalized.categoryGroup === row.category_group
      ) {
        return row;
      }

      return {
        ...row,
        category: normalized.category,
        category_group: normalized.categoryGroup,
      };
    }),
  };
}

function normalizeCategoryFromLabel(
  rawLabel: string,
  documentType: DocumentType | undefined,
  rowType: FinancialRowType | undefined,
): NormalizedFinancialCategory | null {
  const label = normalizeCategoryText(rawLabel);
  const isMonthlyCharge = documentType === 'monthly_charges' && rowType === 'charge';
  const isMediaSettlement = documentType === 'media_settlement';

  if (isMonthlyCharge) {
    const monthlyCategory = monthlyChargeCategory(label);

    if (monthlyCategory) {
      return monthlyCategory;
    }
  }

  if (!isMediaSettlement) {
    return null;
  }

  if (hasAllTokens(label, ['energia', 'cieplna'])) {
    return settlementCategory(label, 'central_heating');
  }

  if (
    hasAllTokens(label, ['podgrzanie', 'wody']) ||
    hasAllTokens(label, ['ciepla', 'woda'])
  ) {
    return settlementCategory(label, 'hot_water');
  }

  if (hasAllTokens(label, ['woda', 'scieki'])) {
    if (label.includes('abonament')) {
      return settlementCategory(label, 'water_and_sewage_subscription');
    }

    return settlementCategory(label, 'water_and_sewage');
  }

  if (hasAllTokens(label, ['zamowiona', 'moc', 'cieplna'])) {
    return settlementCategory(label, 'ordered_heat_power');
  }

  if (label.includes('e kartoteki') || label.includes('ekartoteki')) {
    return settlementCategory(label, 'e_kartoteka_access');
  }

  if (hasAllTokens(label, ['razem', 'rozliczenie', 'media'])) {
    if (isUnderpaymentLabel(label)) {
      return { category: 'media_settlement_net_underpayment', categoryGroup: 'media_settlement' };
    }

    if (isOverpaymentLabel(label)) {
      return { category: 'media_settlement_net_overpayment', categoryGroup: 'media_settlement' };
    }
  }

  return null;
}

function monthlyChargeCategory(label: string): NormalizedFinancialCategory | null {
  if (hasAllTokens(label, ['zaliczka', 'czesc', 'wspolna'])) {
    return { category: 'shared_property_advance', categoryGroup: 'shared_property' };
  }

  if (hasAllTokens(label, ['fundusz', 'remontowo']) || hasAllTokens(label, ['fundusz', 'remontowy'])) {
    return { category: 'renovation_investment_fund', categoryGroup: 'funds' };
  }

  if (label.includes('e kartoteki') || label.includes('ekartoteki')) {
    return { category: 'e_kartoteka_access', categoryGroup: 'individual' };
  }

  if (hasAllTokens(label, ['wywoz', 'odpadow'])) {
    return { category: 'municipal_waste', categoryGroup: 'media' };
  }

  if (hasAllTokens(label, ['zamowiona', 'moc', 'cieplna'])) {
    return { category: 'ordered_heating_power', categoryGroup: 'media' };
  }

  if (hasAllTokens(label, ['energia', 'cieplna']) || hasAllTokens(label, ['centralne', 'ogrzewanie'])) {
    return { category: 'central_heating_energy', categoryGroup: 'media' };
  }

  if (
    hasAllTokens(label, ['podgrzanie', 'wody']) ||
    hasAllTokens(label, ['ciepla', 'woda'])
  ) {
    return { category: 'hot_water_heating', categoryGroup: 'media' };
  }

  if (hasAllTokens(label, ['woda', 'scieki'])) {
    return { category: 'cold_water_and_sewage', categoryGroup: 'media' };
  }

  return null;
}

function settlementCategory(
  label: string,
  baseCategory: string,
): NormalizedFinancialCategory | null {
  if (isAdvanceLabel(label)) {
    return { category: `${baseCategory}_advances`, categoryGroup: 'media_settlement' };
  }

  if (isCostLabel(label)) {
    return { category: `${baseCategory}_cost`, categoryGroup: 'media_settlement' };
  }

  if (isUnderpaymentLabel(label)) {
    return { category: `${baseCategory}_underpayment`, categoryGroup: 'media_settlement' };
  }

  if (isOverpaymentLabel(label)) {
    return { category: `${baseCategory}_overpayment`, categoryGroup: 'media_settlement' };
  }

  return null;
}

function normalizeCategoryText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\u0142/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasAllTokens(value: string, tokens: string[]): boolean {
  const words = new Set(value.split(' '));

  return tokens.every((token) => words.has(token));
}

function isAdvanceLabel(label: string): boolean {
  return label.includes('zaliczka') || label.includes('zaliczek');
}

function isCostLabel(label: string): boolean {
  return label.includes('koszt') || label.includes('kosztow');
}

function isUnderpaymentLabel(label: string): boolean {
  return label.includes('niedoplata') || label.includes('niedoplaty');
}

function isOverpaymentLabel(label: string): boolean {
  return label.includes('nadplata') || label.includes('nadplaty');
}
