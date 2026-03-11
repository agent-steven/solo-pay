'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Payment {
  id: number;
  merchant_id: number;
  amount: string;
  token_decimals: number;
  token_symbol: string;
  fiat_amount: string | null;
  currency_code: string | null;
  status: string;
  tx_hash: string | null;
  network_id: number;
  created_at: Date;
}

interface Merchant {
  id: number;
  name: string;
}

interface Chain {
  id: number;
  network_id: number;
  name: string;
}

interface Props {
  payments: Payment[];
  merchants: Merchant[];
  chains: Chain[];
}

type Period = 'weekly' | 'monthly';

const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
  137: 'https://polygonscan.com/tx/',
  80002: 'https://amoy.polygonscan.com/tx/',
  56: 'https://bscscan.com/tx/',
  97: 'https://testnet.bscscan.com/tx/',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthlySlots(year: number): { key: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { key, label: MONTHS[i] };
  });
}

/** Returns Sunday-based week slots that overlap the given year/month. */
function buildWeeklySlots(year: number, month: number): { key: string; label: string }[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const daysBack = firstOfMonth.getDay();
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);

  const slots: { key: string; label: string }[] = [];
  let weekNum = 1;
  const d = new Date(start);
  while (d <= lastOfMonth) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    slots.push({ key, label: `W${weekNum}` });
    weekNum++;
    d.setDate(d.getDate() + 7);
  }
  return slots;
}

function getPeriodKey(date: Date, period: Period): string {
  const d = new Date(date);
  if (period === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

function getAvailableYears(payments: Payment[]): number[] {
  if (payments.length === 0) return [new Date().getFullYear()];
  const years = new Set(payments.map((p) => new Date(p.created_at).getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

function getPaginationItems(current: number, total: number): number[] {
  const groupStart = Math.floor((current - 1) / 10) * 10 + 1;
  const groupEnd = Math.min(groupStart + 9, total);
  return Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);
}

function ExternalLinkIcon() {
  return (
    <svg
      className="inline-block ml-1 h-3 w-3"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" />
      <path d="M8 1h3m0 0v3m0-3L5.5 6.5" />
    </svg>
  );
}

function Select({
  value,
  onChange,
  className,
  children,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={onChange}
        className={`appearance-none pr-7 ${className ?? ''}`}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg
          className="h-3 w-3 text-gray-500"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function PaymentsClient({ payments, merchants, chains }: Props) {
  const latestDataYear =
    payments.length > 0
      ? Math.max(...payments.map((p) => new Date(p.created_at).getFullYear()))
      : new Date().getFullYear();
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(latestDataYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [merchantFilter, setMerchantFilter] = useState<string>('all');
  const [historyYear, setHistoryYear] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const PAGE_SIZE = 20;

  const merchantMap = useMemo(() => new Map(merchants.map((m) => [m.id, m.name])), [merchants]);
  const chainMap = useMemo(() => new Map(chains.map((c) => [c.network_id, c.name])), [chains]);
  const availableYears = useMemo(() => getAvailableYears(payments), [payments]);

  const chartData = useMemo(() => {
    const slots =
      period === 'monthly'
        ? buildMonthlySlots(selectedYear)
        : buildWeeklySlots(selectedYear, selectedMonth);
    const slotKeys = new Set(slots.map((s) => s.key));
    const grouped: Record<string, number> = {};
    for (const p of payments) {
      if (period === 'monthly' && new Date(p.created_at).getFullYear() !== selectedYear) continue;
      const key = getPeriodKey(new Date(p.created_at), period);
      if (!slotKeys.has(key)) continue;
      grouped[key] = (grouped[key] ?? 0) + 1;
    }
    return slots.map(({ key, label }) => ({ label, count: grouped[key] ?? 0 }));
  }, [payments, period, selectedYear, selectedMonth]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (merchantFilter !== 'all' && p.merchant_id !== Number(merchantFilter)) return false;
      if (historyYear !== 'all' && new Date(p.created_at).getFullYear() !== Number(historyYear))
        return false;
      return true;
    });
  }, [payments, merchantFilter, historyYear]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPayments = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPayments.slice(start, start + PAGE_SIZE);
  }, [filteredPayments, safePage, PAGE_SIZE]);

  const selectBase =
    'text-xs border border-gray-300 rounded-md pl-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between h-8 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Payment Count</h2>
          <div className="flex items-center gap-3">
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={selectBase}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            {period === 'weekly' && (
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={selectBase}
              >
                {MONTHS.map((label, i) => (
                  <option key={i + 1} value={i + 1}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex gap-1">
              {(['monthly', 'weekly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="[&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  padding: '4px 10px',
                }}
                formatter={(value) => [value, 'Payments']}
              />
              <Bar
                dataKey="count"
                radius={[3, 3, 0, 0]}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={hoveredIndex === index ? '#1f2937' : '#111827'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Select
              value={historyYear}
              onChange={(e) => {
                setHistoryYear(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-gray-300 rounded-md pl-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Merchant</label>
              <Select
                value={merchantFilter}
                onChange={(e) => {
                  setMerchantFilter(e.target.value);
                  setPage(1);
                }}
                className="text-sm border border-gray-300 rounded-md pl-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="all">All</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <span className="text-xs text-gray-400">{filteredPayments.length} payments</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Merchant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Token</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Chain</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tx Hash</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No payments
                </td>
              </tr>
            ) : (
              pagedPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {merchantMap.get(p.merchant_id) ?? `#${p.merchant_id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.fiat_amount
                      ? `${parseFloat(p.fiat_amount).toLocaleString()} ${p.currency_code}`
                      : `${p.token_symbol}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.token_symbol}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {chainMap.get(p.network_id) ?? `#${p.network_id}`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {p.tx_hash ? (
                      EXPLORER_URLS[p.network_id] ? (
                        <a
                          href={`${EXPLORER_URLS[p.network_id]}${p.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline inline-flex items-center"
                        >
                          {p.tx_hash.slice(0, 10)}…{p.tx_hash.slice(-6)}
                          <ExternalLinkIcon />
                        </a>
                      ) : (
                        <span>
                          {p.tx_hash.slice(0, 10)}…{p.tx_hash.slice(-6)}
                        </span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDateTime(p.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="First page"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            {getPaginationItems(page, totalPages).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`min-w-[28px] px-2 py-1 text-xs rounded-md transition-colors ${
                  page === n ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Last page"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-600',
  PAID: 'bg-green-50 text-green-700',
  REFUND_SUBMITTED: 'bg-purple-50 text-purple-400',
  REFUNDED: 'bg-purple-50 text-purple-600',
  EXPIRED: 'bg-orange-50 text-orange-600',
  FAILED: 'bg-red-50 text-red-700',
  INVALID: 'bg-red-50 text-red-500',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
    </span>
  );
}
