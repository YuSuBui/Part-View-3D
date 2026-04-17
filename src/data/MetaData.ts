export type PartMetadata = {
  category: string
  finish: string
  notes: string
}

const keywordMetadata: Array<{ keyword: string; metadata: PartMetadata }> = [
  {
    keyword: 'wheel',
    metadata: {
      category: 'Mobility',
      finish: 'Rubber composite',
      notes: 'High contact component',
    },
  },
  {
    keyword: 'door',
    metadata: {
      category: 'Body',
      finish: 'Painted metal',
      notes: 'User interaction surface',
    },
  },
  {
    keyword: 'glass',
    metadata: {
      category: 'Visibility',
      finish: 'Tempered glass',
      notes: 'Transparent part',
    },
  },
  {
    keyword: 'light',
    metadata: {
      category: 'Electrical',
      finish: 'Polycarbonate lens',
      notes: 'Illumination component',
    },
  },
]

const fallbackMetadata: PartMetadata = {
  category: 'General',
  finish: 'Default material',
  notes: 'No custom metadata mapping',
}

export function getMetadataForPart(partName: string): PartMetadata {
  const normalizedName = partName.toLowerCase()
  const mappedPart = keywordMetadata.find(({ keyword }) =>
    normalizedName.includes(keyword),
  )

  return mappedPart?.metadata ?? fallbackMetadata
}

