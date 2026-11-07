import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_ASSET_TYPES = [
  'Złotówki w gotówce',
  'Euro w gotówce',
  'Dolary w gotówce',
  'Złotówki na koncie',
  'Funty na koncie',
  'Mieszkanie (m2)',
  'Złoto w uncjach',
  'Złoto w gramach',
  'Srebro w uncjach',
  'Bitcoin',
  'Akcje',
]

const DEFAULT_ASSET_GROUPS = [
  'Gotówka',
  'Kruszcze',
  'Nieruchomości',
  'Krypto',
  'Giełda',
]

const DEFAULT_EXPENSE_CATEGORIES = [
  'Jedzenie',
  'Rozrywka',
  'Zdrowie',
  'Transport',
  'Mieszkanie',
  'Rachunki',
  'Edukacja',
  'Ubrania',
  'Inne',
]

type AssetType = string
type AssetGroup = string
type ExpenseCategory = string

const ASSET_ICONS: Record<string, string> = {
  'Złotówki w gotówce': '💵',
  'Euro w gotówce': '💶',
  'Dolary w gotówce': '💵',
  'Złotówki na koncie': '🏦',
  'Funty na koncie': '💷',
  'Mieszkanie (m2)': '🏠',
  'Złoto w uncjach': '🥇',
  'Złoto w gramach': '🥇',
  'Srebro w uncjach': '⚪',
  Bitcoin: '🪙',
  Akcje: '📈',
}

const GROUP_COLORS: Record<string, string> = {
  Gotówka: '#2f6fed',
  Kruszcze: '#c9a227',
  Nieruchomości: '#2f9e6b',
  Krypto: '#e07a2f',
  Giełda: '#7c3aed',
}

const GROUP_ICONS: Record<string, string> = {
  Gotówka: '💵',
  Kruszcze: '🥇',
  Nieruchomości: '🏠',
  Krypto: '🪙',
  Giełda: '📊',
}

const FALLBACK_GROUP_COLORS = [
  '#2f6fed',
  '#c9a227',
  '#2f9e6b',
  '#e07a2f',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#ea580c',
]

const GROUP_BY_TYPE: Record<string, string> = {
  'Złotówki w gotówce': 'Gotówka',
  'Euro w gotówce': 'Gotówka',
  'Dolary w gotówce': 'Gotówka',
  'Złotówki na koncie': 'Gotówka',
  'Funty na koncie': 'Gotówka',
  'Mieszkanie (m2)': 'Nieruchomości',
  'Złoto w uncjach': 'Kruszcze',
  'Złoto w gramach': 'Kruszcze',
  'Srebro w uncjach': 'Kruszcze',
  Bitcoin: 'Krypto',
  Akcje: 'Giełda',
}

function formatAssetLabel(type: string): string {
  return `${ASSET_ICONS[type] ?? '📦'} ${type}`
}

function formatGroupLabel(group: string): string {
  return `${GROUP_ICONS[group] ?? '📁'} ${group}`
}

function groupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group]
  let hash = 0
  for (let i = 0; i < group.length; i++) {
    hash = (hash + group.charCodeAt(i) * (i + 1)) % 997
  }
  return FALLBACK_GROUP_COLORS[hash % FALLBACK_GROUP_COLORS.length]
}

function parseOptionsText(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const item = line.trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function optionsToText(options: string[]): string {
  return options.join('\n')
}

function normalizeOptionList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const parsed = parseOptionsText(value.map((item) => String(item ?? '')).join('\n'))
  return parsed.length > 0 ? parsed : [...fallback]
}

function optionsWithCurrent(options: string[], current: string): string[] {
  if (!current || options.includes(current)) return options
  return [current, ...options]
}

function suggestGroup(type: string, groups: string[]): string {
  const suggested = GROUP_BY_TYPE[type]
  if (suggested && groups.includes(suggested)) return suggested
  return groups[0] ?? DEFAULT_ASSET_GROUPS[0]
}

function migrateAssetType(value: unknown, types: string[]): string {
  if (typeof value === 'string' && value.trim()) {
    if (types.includes(value)) return value
    if (value === 'Giełda' && types.includes('Akcje')) return 'Akcje'
    return value
  }
  return types[0] ?? DEFAULT_ASSET_TYPES[0]
}

function migrateAssetGroup(
  value: unknown,
  type: string,
  groups: string[],
): string {
  if (typeof value === 'string' && value.trim()) {
    if (groups.includes(value)) return value
    if (value === 'Akcje' && groups.includes('Giełda')) return 'Giełda'
    return value
  }
  return suggestGroup(type, groups)
}

type AssetRow = {
  id: string
  type: AssetType
  quantity: number
  unitValue: number
  location: string
  group: AssetGroup
}

type Snapshot = {
  id: string
  dateLabel: string
  createdAt: string
  rows: AssetRow[]
}

type SortKey =
  | 'type'
  | 'quantity'
  | 'unitValue'
  | 'total'
  | 'location'
  | 'group'

type SortDir = 'asc' | 'desc'

const EXPENSE_FREQUENCIES = ['miesięcznie', 'rocznie'] as const
type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number]

type ExpenseRow = {
  id: string
  description: string
  frequency: ExpenseFrequency
  amount: number
  category: ExpenseCategory
}

type RunwayScenarioKey = 'optimistic' | 'pessimistic'

type RunwayScenario = {
  expenses: number
  income: number
}

type Store = {
  snapshots: Snapshot[]
  activeSnapshotId: string
  sortKey: SortKey | null
  sortDir: SortDir | null
  availableCapital: number
  optimistic: RunwayScenario
  pessimistic: RunwayScenario
  expenses: ExpenseRow[]
  assetTypes: string[]
  assetGroups: string[]
  expenseCategories: string[]
}

const RUNWAY_GROUPS: readonly string[] = [
  'Gotówka',
  'Kruszcze',
  'Krypto',
  'Giełda',
]

const DEFAULT_EXPENSE_FREQUENCY: ExpenseFrequency = 'miesięcznie'

const STORAGE_KEY = 'mana-assets'
const SORT_KEYS: readonly SortKey[] = [
  'type',
  'quantity',
  'unitValue',
  'total',
  'location',
  'group',
]

const pln = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

/** Round PLN to grosze (2 decimal places). */
function roundPln(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function parseQuantity(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function createRow(
  partial?: Partial<Omit<AssetRow, 'id'>>,
  lists?: { types?: string[]; groups?: string[] },
): AssetRow {
  const types = lists?.types?.length ? lists.types : DEFAULT_ASSET_TYPES
  const groups = lists?.groups?.length ? lists.groups : DEFAULT_ASSET_GROUPS
  const type = partial?.type ?? types[0]
  return {
    id: crypto.randomUUID(),
    type,
    quantity: Number(partial?.quantity) || 0,
    unitValue: roundPln(partial?.unitValue ?? 0),
    location: partial?.location ?? '',
    group: partial?.group ?? suggestGroup(type, groups),
  }
}

function normalizeRow(
  row: Partial<AssetRow>,
  lists?: { types?: string[]; groups?: string[] },
): AssetRow {
  const types = lists?.types?.length ? lists.types : DEFAULT_ASSET_TYPES
  const groups = lists?.groups?.length ? lists.groups : DEFAULT_ASSET_GROUPS
  const type = migrateAssetType(row.type, types)
  const quantity = Number(row.quantity)
  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    type,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unitValue: roundPln(Number(row.unitValue) || 0),
    location: typeof row.location === 'string' ? row.location : '',
    group: migrateAssetGroup(row.group, type, groups),
  }
}

function cloneRows(rows: AssetRow[]): AssetRow[] {
  return rows.map((row) =>
    createRow({
      type: row.type,
      quantity: row.quantity,
      unitValue: row.unitValue,
      location: row.location,
      group: row.group,
    }),
  )
}

function ensureRows(rows: AssetRow[]): AssetRow[] {
  return rows.length > 0 ? rows : [createRow()]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateLabel(date: Date, withTime: boolean): string {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  if (!withTime) return day
  return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function nextDateLabel(existing: Snapshot[], now = new Date()): string {
  const today = formatDateLabel(now, false)
  const taken = new Set(existing.map((s) => s.dateLabel))
  if (!taken.has(today)) return today
  let label = formatDateLabel(now, true)
  if (!taken.has(label)) return label
  // Collision within the same minute — append seconds
  label = `${label}:${pad2(now.getSeconds())}`
  if (!taken.has(label)) return label
  return `${label}-${crypto.randomUUID().slice(0, 4)}`
}

function createSnapshot(rows: AssetRow[], dateLabel: string): Snapshot {
  return {
    id: crypto.randomUUID(),
    dateLabel,
    createdAt: new Date().toISOString(),
    rows: ensureRows(rows),
  }
}

function createInitialStore(rows?: AssetRow[]): Store {
  const snapshot = createSnapshot(
    ensureRows(rows ?? [createRow()]),
    formatDateLabel(new Date(), false),
  )
  return {
    snapshots: [snapshot],
    activeSnapshotId: snapshot.id,
    sortKey: null,
    sortDir: null,
    availableCapital: 0,
    optimistic: { expenses: 0, income: 0 },
    pessimistic: { expenses: 0, income: 0 },
    expenses: [createExpenseRow()],
    assetTypes: [...DEFAULT_ASSET_TYPES],
    assetGroups: [...DEFAULT_ASSET_GROUPS],
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
  }
}

function normalizeRunwayScenario(value: unknown, fallback: RunwayScenario): RunwayScenario {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<RunwayScenario>
  return {
    expenses: roundPln(Number(candidate.expenses) || 0),
    income: roundPln(Number(candidate.income) || 0),
  }
}

function isExpenseFrequency(value: unknown): value is ExpenseFrequency {
  return (
    typeof value === 'string' &&
    (EXPENSE_FREQUENCIES as readonly string[]).includes(value)
  )
}

function createExpenseRow(
  partial?: Partial<Omit<ExpenseRow, 'id'>>,
  categories: string[] = DEFAULT_EXPENSE_CATEGORIES,
): ExpenseRow {
  return {
    id: crypto.randomUUID(),
    description: partial?.description ?? '',
    frequency: partial?.frequency ?? DEFAULT_EXPENSE_FREQUENCY,
    amount: roundPln(partial?.amount ?? 0),
    category: partial?.category ?? categories[0] ?? 'Inne',
  }
}

function normalizeExpenseRow(
  row: Partial<ExpenseRow>,
  categories: string[] = DEFAULT_EXPENSE_CATEGORIES,
): ExpenseRow {
  const category =
    typeof row.category === 'string' && row.category.trim()
      ? row.category
      : categories[0] ?? 'Inne'
  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    description: typeof row.description === 'string' ? row.description : '',
    frequency: isExpenseFrequency(row.frequency)
      ? row.frequency
      : DEFAULT_EXPENSE_FREQUENCY,
    amount: roundPln(Number(row.amount) || 0),
    category,
  }
}

function expensesMonthlyTotal(expenses: ExpenseRow[]): number {
  return roundPln(
    expenses.reduce((sum, row) => sum + monthlyEquivalent(row), 0),
  )
}

function ensureExpenses(rows: ExpenseRow[]): ExpenseRow[] {
  return rows.length > 0 ? rows : [createExpenseRow()]
}

function monthlyEquivalent(row: ExpenseRow): number {
  return roundPln(
    row.frequency === 'rocznie' ? row.amount / 12 : row.amount,
  )
}

function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value)
}

function isStore(value: unknown): value is Partial<Store> & Pick<Store, 'snapshots' | 'activeSnapshotId'> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Store
  return (
    Array.isArray(candidate.snapshots) &&
    typeof candidate.activeSnapshotId === 'string'
  )
}

function rowTotal(row: AssetRow): number {
  return roundPln(row.quantity * row.unitValue)
}

function compareRows(a: AssetRow, b: AssetRow, key: SortKey): number {
  switch (key) {
    case 'quantity':
      return a.quantity - b.quantity
    case 'unitValue':
      return a.unitValue - b.unitValue
    case 'total':
      return rowTotal(a) - rowTotal(b)
    case 'type':
      return a.type.localeCompare(b.type, 'pl')
    case 'location':
      return a.location.localeCompare(b.location, 'pl')
    case 'group':
      return a.group.localeCompare(b.group, 'pl')
  }
}

function nextSortState(
  currentKey: SortKey | null,
  currentDir: SortDir | null,
  clicked: SortKey,
): Pick<Store, 'sortKey' | 'sortDir'> {
  if (currentKey !== clicked) return { sortKey: clicked, sortDir: 'asc' }
  if (currentDir === 'asc') return { sortKey: clicked, sortDir: 'desc' }
  if (currentDir === 'desc') return { sortKey: null, sortDir: null }
  return { sortKey: clicked, sortDir: 'asc' }
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialStore()

    const parsed: unknown = JSON.parse(raw)

    // Legacy flat row list → one snapshot
    if (Array.isArray(parsed)) {
      const rows = ensureRows(
        parsed.map((row) =>
          normalizeRow(row as Partial<AssetRow>, {
            types: DEFAULT_ASSET_TYPES,
            groups: DEFAULT_ASSET_GROUPS,
          }),
        ),
      )
      return createInitialStore(rows)
    }

    if (!isStore(parsed) || parsed.snapshots.length === 0) {
      return createInitialStore()
    }

    const assetTypes = normalizeOptionList(
      parsed.assetTypes,
      DEFAULT_ASSET_TYPES,
    )
    const assetGroups = normalizeOptionList(
      parsed.assetGroups,
      DEFAULT_ASSET_GROUPS,
    )
    const expenseCategories = normalizeOptionList(
      parsed.expenseCategories,
      DEFAULT_EXPENSE_CATEGORIES,
    )
    const optionLists = { types: assetTypes, groups: assetGroups }

    const snapshots = parsed.snapshots.map((snapshot) => {
      const rows = ensureRows(
        Array.isArray(snapshot.rows)
          ? snapshot.rows.map((row) => normalizeRow(row, optionLists))
          : [createRow(undefined, optionLists)],
      )
      return {
        id: typeof snapshot.id === 'string' ? snapshot.id : crypto.randomUUID(),
        dateLabel:
          typeof snapshot.dateLabel === 'string' && snapshot.dateLabel
            ? snapshot.dateLabel
            : formatDateLabel(new Date(), false),
        createdAt:
          typeof snapshot.createdAt === 'string'
            ? snapshot.createdAt
            : new Date().toISOString(),
        rows,
      }
    })

    const activeSnapshotId = snapshots.some((s) => s.id === parsed.activeSnapshotId)
      ? parsed.activeSnapshotId
      : snapshots[0].id

    const sortKey = isSortKey(parsed.sortKey) ? parsed.sortKey : null
    const sortDir =
      parsed.sortDir === 'asc' || parsed.sortDir === 'desc' ? parsed.sortDir : null

    const legacyRaw = parsed as Partial<Store> & {
      monthlyExpenses?: unknown
      monthlyIncome?: unknown
    }
    const legacyExpenses = roundPln(Number(legacyRaw.monthlyExpenses) || 0)
    const legacyIncome = roundPln(Number(legacyRaw.monthlyIncome) || 0)
    const legacyScenario: RunwayScenario = {
      expenses: legacyExpenses,
      income: legacyIncome,
    }
    const activeRows =
      snapshots.find((s) => s.id === activeSnapshotId)?.rows ??
      snapshots[0]?.rows ??
      []
    const availableCapital =
      parsed.availableCapital === undefined || parsed.availableCapital === null
        ? runwayCapital(activeRows)
        : roundPln(Number(parsed.availableCapital) || 0)
    const optimistic = normalizeRunwayScenario(
      parsed.optimistic,
      legacyScenario,
    )
    const pessimistic = normalizeRunwayScenario(
      parsed.pessimistic,
      legacyScenario,
    )
    const expenses = Array.isArray(parsed.expenses)
      ? ensureExpenses(
          parsed.expenses.map((row) =>
            normalizeExpenseRow(row, expenseCategories),
          ),
        )
      : [createExpenseRow(undefined, expenseCategories)]

    return {
      snapshots,
      activeSnapshotId,
      sortKey: sortKey && sortDir ? sortKey : null,
      sortDir: sortKey && sortDir ? sortDir : null,
      availableCapital,
      optimistic,
      pessimistic,
      expenses,
      assetTypes,
      assetGroups,
      expenseCategories,
    }
  } catch {
    return createInitialStore()
  }
}

function parseNumber(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  return roundPln(Number(normalized) || 0)
}

function parseMoneyInput(value: string): number {
  return parseNumber(value)
}

type GroupSlice = {
  group: AssetGroup
  amount: number
  count: number
  pct: number
}

function buildExpenseGroupSlices(
  expenses: ExpenseRow[],
  categories: string[],
): { slices: GroupSlice[]; total: number } {
  const categoryList =
    categories.length > 0
      ? [...categories]
      : [...new Set(expenses.map((row) => row.category).filter(Boolean))]
  const amounts = Object.fromEntries(categoryList.map((c) => [c, 0])) as Record<
    string,
    number
  >
  const counts = Object.fromEntries(categoryList.map((c) => [c, 0])) as Record<
    string,
    number
  >
  for (const row of expenses) {
    if (!(row.category in amounts)) {
      amounts[row.category] = 0
      counts[row.category] = 0
      categoryList.push(row.category)
    }
    amounts[row.category] += monthlyEquivalent(row)
    counts[row.category] += 1
  }
  const total = categoryList.reduce((sum, category) => sum + amounts[category], 0)
  const roundedTotal = roundPln(total)
  const slices = categoryList.map((group) => ({
    group,
    amount: roundPln(amounts[group]),
    count: counts[group],
    pct: roundedTotal > 0 ? (roundPln(amounts[group]) / roundedTotal) * 100 : 0,
  }))
  return { slices, total: roundedTotal }
}

type ExpenseSortKey =
  | 'description'
  | 'amount'
  | 'frequency'
  | 'category'
  | 'monthly'

function compareExpenses(
  a: ExpenseRow,
  b: ExpenseRow,
  key: ExpenseSortKey,
): number {
  switch (key) {
    case 'amount':
      return a.amount - b.amount
    case 'monthly':
      return monthlyEquivalent(a) - monthlyEquivalent(b)
    case 'description':
      return a.description.localeCompare(b.description, 'pl')
    case 'frequency':
      return a.frequency.localeCompare(b.frequency, 'pl')
    case 'category':
      return a.category.localeCompare(b.category, 'pl')
  }
}

function SortableHeader({
  label,
  columnKey,
  activeKey,
  activeDir,
  onCycle,
  className,
}: {
  label: string
  columnKey: string
  activeKey: string | null
  activeDir: SortDir | null
  onCycle: (key: string) => void
  className?: string
}) {
  const active = activeKey === columnKey
  const ariaSort =
    active && activeDir === 'asc'
      ? 'ascending'
      : active && activeDir === 'desc'
        ? 'descending'
        : 'none'

  return (
    <th scope="col" className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onCycle(columnKey)}
        aria-label={`Sortuj: ${label}`}
      >
        <span>{label}</span>
        <span className="sort-icons" aria-hidden="true">
          <span
            className={`sort-arrow${active && activeDir === 'asc' ? ' is-on' : ''}`}
          >
            ▲
          </span>
          <span
            className={`sort-arrow${active && activeDir === 'desc' ? ' is-on' : ''}`}
          >
            ▼
          </span>
        </span>
      </button>
    </th>
  )
}

function buildGroupSlices(
  rows: AssetRow[],
  groups: string[],
): { slices: GroupSlice[]; total: number } {
  const groupList =
    groups.length > 0
      ? groups
      : [...new Set(rows.map((row) => row.group).filter(Boolean))]
  const amounts = Object.fromEntries(groupList.map((g) => [g, 0])) as Record<
    string,
    number
  >
  const counts = Object.fromEntries(groupList.map((g) => [g, 0])) as Record<
    string,
    number
  >
  for (const row of rows) {
    if (!(row.group in amounts)) {
      amounts[row.group] = 0
      counts[row.group] = 0
      groupList.push(row.group)
    }
    amounts[row.group] += rowTotal(row)
    counts[row.group] += 1
  }
  const total = groupList.reduce((sum, group) => sum + amounts[group], 0)
  const roundedTotal = roundPln(total)
  const slices = groupList.map((group) => ({
    group,
    amount: roundPln(amounts[group]),
    count: counts[group],
    pct: roundedTotal > 0 ? (roundPln(amounts[group]) / roundedTotal) * 100 : 0,
  }))
  return { slices, total: roundedTotal }
}

function runwayCapital(rows: AssetRow[]): number {
  return roundPln(
    rows.reduce(
      (sum, row) =>
        RUNWAY_GROUPS.includes(row.group) ? sum + rowTotal(row) : sum,
      0,
    ),
  )
}

function formatYears(years: number): string {
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(years)
}

function scenarioYears(capital: number, scenario: RunwayScenario): number | null {
  const burn = scenario.expenses - scenario.income
  if (burn <= 0) return null
  return capital / (burn * 12)
}

function formatBurn(burn: number): string {
  if (burn > 0) return pln.format(burn)
  if (burn === 0) return '0 zł (bilans zerowy)'
  return `nadwyżka ${pln.format(-burn)}`
}

function formatYearsLabel(years: number | null): string {
  if (years === null) return 'nie wyczerpią się'
  if (!Number.isFinite(years)) return '—'
  return `${formatYears(years)} lat`
}

function RunwayPanel({
  availableCapital,
  optimistic,
  pessimistic,
  onCapitalChange,
  onScenarioChange,
  onPullCapital,
  onPullExpenses,
}: {
  availableCapital: number
  optimistic: RunwayScenario
  pessimistic: RunwayScenario
  onCapitalChange: (value: number) => void
  onScenarioChange: (
    key: RunwayScenarioKey,
    patch: Partial<RunwayScenario>,
  ) => void
  onPullCapital: () => void
  onPullExpenses: () => void
}) {
  const [selected, setSelected] = useState<RunwayScenarioKey>('optimistic')
  const capital = Math.max(0, roundPln(availableCapital))
  const incomeAdjustments = [100, -100, 1000, -1000] as const
  const scenarios: { key: RunwayScenarioKey; label: string; data: RunwayScenario }[] =
    [
      { key: 'optimistic', label: 'Optymistyczny', data: optimistic },
      { key: 'pessimistic', label: 'Pesymistyczny', data: pessimistic },
    ]

  function adjustSelectedIncome(delta: number) {
    const current = selected === 'optimistic' ? optimistic : pessimistic
    onScenarioChange(selected, {
      income: Math.max(0, roundPln(current.income + delta)),
    })
  }

  return (
    <section className="runway-panel" aria-label="Szacunek wystarczalności środków">
      <h2 className="runway-title">Na ile starczy środków</h2>
      <p className="runway-hint">
        Wspólny kapitał (Gotówka, Kruszcze, Krypto, Giełda). Scenariusze mają
        osobne wydatki i wpływy. Korekty +100/−100… zmieniają wpływy w
        zaznaczonym scenariuszu.
      </p>

      <div className="runway-fields">
        <label className="runway-field">
          <span>Dostępny kapitał</span>
          <input
            type="number"
            inputMode="decimal"
            step="10"
            min="0"
            value={capital}
            onChange={(e) =>
              onCapitalChange(Math.max(0, parseNumber(e.target.value)))
            }
            aria-label="Dostępny kapitał w PLN"
          />
          <span className="runway-unit">PLN</span>
        </label>
        <div className="runway-pull-row">
          <button
            type="button"
            className="btn-secondary runway-pull"
            onClick={onPullCapital}
          >
            pobierz z tabeli assetów
          </button>
          <button
            type="button"
            className="btn-secondary runway-pull"
            onClick={onPullExpenses}
          >
            pobierz z tabeli wydatków
          </button>
        </div>
      </div>

      <div className="table-wrap runway-table-wrap">
        <table className="runway-table">
          <thead>
            <tr>
              <th scope="col" />
              {scenarios.map((scenario) => (
                <th key={scenario.key} scope="col">
                  <button
                    type="button"
                    className={`runway-scenario-tab${selected === scenario.key ? ' is-selected' : ''}`}
                    onClick={() => setSelected(scenario.key)}
                    aria-pressed={selected === scenario.key}
                  >
                    {scenario.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Wydatki</th>
              {scenarios.map((scenario) => (
                <td key={`${scenario.key}-expenses`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="10"
                    min="0"
                    aria-label={`Wydatki — ${scenario.label}`}
                    value={scenario.data.expenses}
                    onFocus={() => setSelected(scenario.key)}
                    onChange={(e) =>
                      onScenarioChange(scenario.key, {
                        expenses: parseNumber(e.target.value),
                      })
                    }
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Wpływy</th>
              {scenarios.map((scenario) => (
                <td key={`${scenario.key}-income`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="10"
                    min="0"
                    aria-label={`Wpływy — ${scenario.label}`}
                    value={scenario.data.income}
                    onFocus={() => setSelected(scenario.key)}
                    onChange={(e) =>
                      onScenarioChange(scenario.key, {
                        income: parseNumber(e.target.value),
                      })
                    }
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Zużycie netto</th>
              {scenarios.map((scenario) => (
                <td key={`${scenario.key}-burn`} className="money">
                  {formatBurn(scenario.data.expenses - scenario.data.income)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Szacunek lat</th>
              {scenarios.map((scenario) => (
                <td
                  key={`${scenario.key}-years`}
                  className="money runway-years-cell"
                >
                  {formatYearsLabel(scenarioYears(capital, scenario.data))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="runway-adjust" role="group" aria-label="Szybka korekta wpływów zaznaczonego scenariusza">
        <span className="runway-adjust-label">
          Wpływy ({selected === 'optimistic' ? 'optymistyczny' : 'pesymistyczny'}):
        </span>
        {incomeAdjustments.map((delta) => (
          <button
            key={delta}
            type="button"
            className="runway-adjust-btn"
            onClick={() => adjustSelectedIncome(delta)}
          >
            {delta > 0 ? `+${delta}` : String(delta)}
          </button>
        ))}
      </div>
    </section>
  )
}

function ExpensesPanel({
  expenses,
  categories,
  onChange,
}: {
  expenses: ExpenseRow[]
  categories: string[]
  onChange: (rows: ExpenseRow[]) => void
}) {
  const [sortKey, setSortKey] = useState<ExpenseSortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir | null>(null)

  const monthlyTotal = useMemo(
    () => expensesMonthlyTotal(expenses),
    [expenses],
  )

  const displayExpenses = useMemo(() => {
    if (!sortKey || !sortDir) return expenses
    const dir = sortDir === 'asc' ? 1 : -1
    return [...expenses].sort(
      (a, b) => compareExpenses(a, b, sortKey) * dir,
    )
  }, [expenses, sortKey, sortDir])

  function cycleExpenseSort(key: string) {
    const column = key as ExpenseSortKey
    if (sortKey !== column) {
      setSortKey(column)
      setSortDir('asc')
      return
    }
    if (sortDir === 'asc') {
      setSortDir('desc')
      return
    }
    setSortKey(null)
    setSortDir(null)
  }

  function updateExpense(
    id: string,
    patch: Partial<Omit<ExpenseRow, 'id'>>,
  ) {
    onChange(
      expenses.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  function removeExpense(id: string) {
    const next = expenses.filter((row) => row.id !== id)
    onChange(ensureExpenses(next))
  }

  return (
    <section className="expenses-panel" aria-label="Tabela wydatków">
      <h2 className="expenses-title">Wydatki</h2>
      <div className="expenses-layout">
        <div className="expenses-main">
          <div className="table-wrap expenses-table-wrap">
            <table className="assets expenses">
              <thead>
                <tr>
                  <SortableHeader
                    label="Opis"
                    columnKey="description"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onCycle={cycleExpenseSort}
                  />
                  <SortableHeader
                    label="wartość"
                    columnKey="amount"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onCycle={cycleExpenseSort}
                    className="col-unit"
                  />
                  <SortableHeader
                    label="Częstotliwość"
                    columnKey="frequency"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onCycle={cycleExpenseSort}
                  />
                  <SortableHeader
                    label="Grupa"
                    columnKey="category"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onCycle={cycleExpenseSort}
                  />
                  <th scope="col" className="col-actions">
                    <span className="sr-only">Operacje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayExpenses.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        aria-label={`Opis wydatku, wiersz ${index + 1}`}
                        value={row.description}
                        onChange={(e) =>
                          updateExpense(row.id, { description: e.target.value })
                        }
                      />
                    </td>
                    <td className="col-unit">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="10"
                        min="0"
                        aria-label={`wartość wydatku, wiersz ${index + 1}`}
                        value={row.amount}
                        onChange={(e) =>
                          updateExpense(row.id, {
                            amount: parseNumber(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Częstotliwość, wiersz ${index + 1}`}
                        value={row.frequency}
                        onChange={(e) =>
                          updateExpense(row.id, {
                            frequency: e.target.value as ExpenseFrequency,
                          })
                        }
                      >
                        {EXPENSE_FREQUENCIES.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Grupa wydatku, wiersz ${index + 1}`}
                        value={row.category}
                        onChange={(e) =>
                          updateExpense(row.id, {
                            category: e.target.value as ExpenseCategory,
                          })
                        }
                      >
                        {optionsWithCurrent(categories, row.category).map(
                          (category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="btn-danger btn-icon"
                        onClick={() => removeExpense(row.id)}
                        aria-label="Usuń"
                        title="Usuń"
                      >
                        <svg
                          className="icon-trash"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            fill="currentColor"
                            d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-2 4h2v10H8V9Zm4 0h2v10h-2V9Zm4 0h2v10h-2V9Z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Suma miesięczna (równoważnik)</td>
                  <td className="money total" colSpan={2}>
                    {pln.format(monthlyTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="expenses-toolbar">
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onChange([...expenses, createExpenseRow(undefined, categories)])
              }
            >
              Dodaj wydatek
            </button>
          </div>
        </div>
        <ExpenseDonutChart expenses={expenses} categories={categories} />
      </div>
    </section>
  )
}

function SettingsModal({
  assetTypes,
  assetGroups,
  expenseCategories,
  onSave,
  onClose,
}: {
  assetTypes: string[]
  assetGroups: string[]
  expenseCategories: string[]
  onSave: (next: {
    assetTypes: string[]
    assetGroups: string[]
    expenseCategories: string[]
  }) => void
  onClose: () => void
}) {
  const [typesText, setTypesText] = useState(optionsToText(assetTypes))
  const [groupsText, setGroupsText] = useState(optionsToText(assetGroups))
  const [categoriesText, setCategoriesText] = useState(
    optionsToText(expenseCategories),
  )

  function handleSave() {
    const nextTypes = normalizeOptionList(
      parseOptionsText(typesText),
      DEFAULT_ASSET_TYPES,
    )
    const nextGroups = normalizeOptionList(
      parseOptionsText(groupsText),
      DEFAULT_ASSET_GROUPS,
    )
    const nextCategories = normalizeOptionList(
      parseOptionsText(categoriesText),
      DEFAULT_EXPENSE_CATEGORIES,
    )
    onSave({
      assetTypes: nextTypes,
      assetGroups: nextGroups,
      expenseCategories: nextCategories,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="settings-title">Ustawienia list</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            aria-label="Zamknij"
          >
            Zamknij
          </button>
        </header>
        <p className="modal-hint">
          Jedna opcja w wierszu. Puste linie są pomijane. Listy trafiają do
          selectów Typ assetu, Grupa assetów i Grupa wydatków.
        </p>
        <label className="settings-field">
          <span>Typ assetu</span>
          <textarea
            rows={10}
            value={typesText}
            onChange={(e) => setTypesText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="settings-field">
          <span>Grupa assetów</span>
          <textarea
            rows={8}
            value={groupsText}
            onChange={(e) => setGroupsText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="settings-field">
          <span>Grupa wydatków</span>
          <textarea
            rows={8}
            value={categoriesText}
            onChange={(e) => setCategoriesText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Zapisz
          </button>
        </div>
      </div>
    </div>
  )
}

function DonutChart({
  title,
  ariaLabel,
  slices,
  total,
  formatLabel = formatGroupLabel,
}: {
  title: string
  ariaLabel: string
  slices: GroupSlice[]
  total: number
  formatLabel?: (group: string) => string
}) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let dashOffset = 0

  const arcs = slices.map((slice) => {
    const length = total > 0 ? (slice.amount / total) * circumference : 0
    const arc = {
      ...slice,
      dashArray: `${length} ${circumference - length}`,
      dashOffset,
    }
    dashOffset -= length
    return arc
  })

  const pctLabel = new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })

  return (
    <section className="group-chart" aria-label={ariaLabel}>
      <h2 className="group-chart-title">{title}</h2>
      <div className="group-chart-body">
        <div className="group-chart-visual">
          <svg
            className="group-donut"
            viewBox="0 0 140 140"
            role="img"
            aria-label={
              total > 0
                ? `Suma ${pln.format(total)} według grup`
                : 'Brak wartości do wyświetlenia'
            }
          >
            <circle
              className="group-donut-track"
              cx="70"
              cy="70"
              r={radius}
              fill="none"
            />
            {total > 0 &&
              arcs.map(
                (arc) =>
                  arc.amount > 0 && (
                    <circle
                      key={arc.group}
                      className="group-donut-slice"
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke={groupColor(arc.group)}
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                    />
                  ),
              )}
            <text
              x="70"
              y="66"
              textAnchor="middle"
              className="group-donut-center-label"
            >
              Suma
            </text>
            <text
              x="70"
              y="84"
              textAnchor="middle"
              className="group-donut-center-value"
            >
              {pln.format(total)}
            </text>
          </svg>
        </div>
        <ul className="group-legend">
          {slices.map((slice) => (
            <li key={slice.group}>
              <span
                className="group-legend-swatch"
                style={{ background: groupColor(slice.group) }}
                aria-hidden="true"
              />
              <span className="group-legend-name">
                {formatLabel(slice.group)} ({slice.count})
              </span>
              <span className="group-legend-meta">
                {pln.format(slice.amount)}
                <span className="group-legend-pct">
                  {pctLabel.format(slice.pct)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function GroupDonutChart({
  rows,
  groups,
}: {
  rows: AssetRow[]
  groups: string[]
}) {
  const { slices, total } = useMemo(
    () => buildGroupSlices(rows, groups),
    [rows, groups],
  )
  return (
    <DonutChart
      title="Podział według grupy"
      ariaLabel="Podział łącznie według grupy"
      slices={slices}
      total={total}
    />
  )
}

function ExpenseDonutChart({
  expenses,
  categories,
}: {
  expenses: ExpenseRow[]
  categories: string[]
}) {
  const { slices, total } = useMemo(
    () => buildExpenseGroupSlices(expenses, categories),
    [expenses, categories],
  )
  return (
    <DonutChart
      title="Wydatki według grupy"
      ariaLabel="Podział wydatków miesięcznych według grupy"
      slices={slices}
      total={total}
      formatLabel={(group) => group}
    />
  )
}

function App() {
  const [store, setStore] = useState<Store>(loadStore)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }, [store])

  const sortedSnapshots = useMemo(
    () =>
      [...store.snapshots].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [store.snapshots],
  )

  const activeSnapshot =
    store.snapshots.find((s) => s.id === store.activeSnapshotId) ??
    sortedSnapshots[0]

  const rows = activeSnapshot?.rows ?? [createRow()]

  const grandTotal = useMemo(
    () => rows.reduce((sum, row) => sum + rowTotal(row), 0),
    [rows],
  )

  function updateActiveRows(updater: (prev: AssetRow[]) => AssetRow[]) {
    setStore((prev) => {
      const activeId = prev.snapshots.some((s) => s.id === prev.activeSnapshotId)
        ? prev.activeSnapshotId
        : prev.snapshots[0]?.id
      if (!activeId) return createInitialStore()

      return {
        ...prev,
        activeSnapshotId: activeId,
        snapshots: prev.snapshots.map((snapshot) =>
          snapshot.id === activeId
            ? { ...snapshot, rows: ensureRows(updater(snapshot.rows)) }
            : snapshot,
        ),
      }
    })
  }

  function updateRow(id: string, patch: Partial<Omit<AssetRow, 'id'>>) {
    updateActiveRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(id: string) {
    updateActiveRows((prev) => {
      const next = prev.filter((row) => row.id !== id)
      return next.length === 0 ? [createRow()] : next
    })
  }

  function selectSnapshot(id: string) {
    setStore((prev) =>
      prev.snapshots.some((s) => s.id === id)
        ? { ...prev, activeSnapshotId: id }
        : prev,
    )
  }

  function addSnapshot() {
    setStore((prev) => {
      const source =
        prev.snapshots.find((s) => s.id === prev.activeSnapshotId) ??
        prev.snapshots[0]
      const sourceRows = source?.rows ?? [createRow()]
      const snapshot = createSnapshot(
        cloneRows(sourceRows),
        nextDateLabel(prev.snapshots),
      )
      return {
        ...prev,
        snapshots: [...prev.snapshots, snapshot],
        activeSnapshotId: snapshot.id,
      }
    })
  }

  function cycleSort(key: SortKey) {
    setStore((prev) => ({
      ...prev,
      ...nextSortState(prev.sortKey, prev.sortDir, key),
    }))
  }

  const displayRows = useMemo(() => {
    if (!store.sortKey || !store.sortDir) return rows
    const dir = store.sortDir === 'asc' ? 1 : -1
    const key = store.sortKey
    return [...rows].sort((a, b) => compareRows(a, b, key) * dir)
  }, [rows, store.sortKey, store.sortDir])

  function SortableTh({
    label,
    sortKey,
    className,
  }: {
    label: string
    sortKey: SortKey
    className?: string
  }) {
    return (
      <SortableHeader
        label={label}
        columnKey={sortKey}
        activeKey={store.sortKey}
        activeDir={store.sortDir}
        onCycle={(key) => cycleSort(key as SortKey)}
        className={className}
      />
    )
  }

  return (
    <div className="app">
      <div className="snapshot-bar">
        <label className="snapshot-label" htmlFor="snapshot-select">
          Stan na dzień
        </label>
        <select
          id="snapshot-select"
          className="snapshot-select"
          aria-label="Data snapshota"
          value={activeSnapshot?.id ?? ''}
          onChange={(e) => selectSnapshot(e.target.value)}
        >
          {sortedSnapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {snapshot.dateLabel}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-add-snapshot"
          onClick={addSnapshot}
          aria-label="Dodaj snapshot"
          title="Dodaj snapshot (kopia bieżącego)"
        >
          +
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setSettingsOpen(true)}
        >
          Ustawienia
        </button>
      </div>

      <div className="table-wrap">
        <table className="assets">
          <thead>
            <tr>
              <SortableTh label="Typ assetu" sortKey="type" className="col-type" />
              <SortableTh label="Ilość" sortKey="quantity" className="col-qty" />
              <SortableTh label="wartość" sortKey="unitValue" className="col-unit" />
              <SortableTh label="Łącznie" sortKey="total" className="money" />
              <SortableTh label="Lokalizacja" sortKey="location" />
              <SortableTh label="Grupa" sortKey="group" className="col-group" />
              <th scope="col" className="col-actions">
                <span className="sr-only">Operacje</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr key={row.id}>
                <td className="col-type">
                  <select
                    aria-label={`Typ assetu, wiersz ${index + 1}`}
                    value={row.type}
                    onChange={(e) => {
                      const type = e.target.value
                      updateRow(row.id, {
                        type,
                        group: suggestGroup(type, store.assetGroups),
                      })
                    }}
                  >
                    {optionsWithCurrent(store.assetTypes, row.type).map(
                      (type) => (
                        <option key={type} value={type}>
                          {formatAssetLabel(type)}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td className="col-qty">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    aria-label={`Ilość, wiersz ${index + 1}`}
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(row.id, {
                        quantity: parseQuantity(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="col-unit">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="10"
                    aria-label={`wartość, wiersz ${index + 1}`}
                    value={row.unitValue}
                    onChange={(e) =>
                      updateRow(row.id, {
                        unitValue: parseMoneyInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="money">{pln.format(rowTotal(row))}</td>
                <td>
                  <input
                    type="text"
                    aria-label={`Lokalizacja, wiersz ${index + 1}`}
                    value={row.location}
                    onChange={(e) =>
                      updateRow(row.id, { location: e.target.value })
                    }
                  />
                </td>
                <td className="col-group">
                  <select
                    aria-label={`Grupa, wiersz ${index + 1}`}
                    value={row.group}
                    onChange={(e) =>
                      updateRow(row.id, {
                        group: e.target.value,
                      })
                    }
                  >
                    {optionsWithCurrent(store.assetGroups, row.group).map(
                      (group) => (
                        <option key={group} value={group}>
                          {formatGroupLabel(group)}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td className="col-actions">
                  <button
                    type="button"
                    className="btn-danger btn-icon"
                    onClick={() => removeRow(row.id)}
                    aria-label="Usuń"
                    title="Usuń"
                  >
                    <svg
                      className="icon-trash"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-2 4h2v10H8V9Zm4 0h2v10h-2V9Zm4 0h2v10h-2V9Z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Suma</td>
              <td className="money total">{pln.format(grandTotal)}</td>
              <td />
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="toolbar">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            updateActiveRows((prev) => [
              ...prev,
              createRow(undefined, {
                types: store.assetTypes,
                groups: store.assetGroups,
              }),
            ])
          }
        >
          Dodaj wiersz
        </button>
      </div>

      <div className="charts-row">
        <GroupDonutChart rows={rows} groups={store.assetGroups} />
        <RunwayPanel
          availableCapital={store.availableCapital}
          optimistic={store.optimistic}
          pessimistic={store.pessimistic}
          onCapitalChange={(value) =>
            setStore((prev) => ({ ...prev, availableCapital: value }))
          }
          onScenarioChange={(key, patch) =>
            setStore((prev) => ({
              ...prev,
              [key]: { ...prev[key], ...patch },
            }))
          }
          onPullCapital={() =>
            setStore((prev) => {
              const active =
                prev.snapshots.find((s) => s.id === prev.activeSnapshotId) ??
                prev.snapshots[0]
              return {
                ...prev,
                availableCapital: runwayCapital(active?.rows ?? []),
              }
            })
          }
          onPullExpenses={() =>
            setStore((prev) => {
              const total = expensesMonthlyTotal(prev.expenses)
              return {
                ...prev,
                optimistic: { ...prev.optimistic, expenses: total },
                pessimistic: { ...prev.pessimistic, expenses: total },
              }
            })
          }
        />
      </div>

      <ExpensesPanel
        expenses={store.expenses}
        categories={store.expenseCategories}
        onChange={(expenses) => setStore((prev) => ({ ...prev, expenses }))}
      />

      {settingsOpen && (
        <SettingsModal
          assetTypes={store.assetTypes}
          assetGroups={store.assetGroups}
          expenseCategories={store.expenseCategories}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) =>
            setStore((prev) => ({
              ...prev,
              ...next,
            }))
          }
        />
      )}
    </div>
  )
}

export default App
