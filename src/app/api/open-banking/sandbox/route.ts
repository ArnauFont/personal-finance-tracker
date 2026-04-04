import { NextRequest, NextResponse } from 'next/server';

type SandboxProvider = 'caixabank' | 'bbva' | 'revolut';

type ExternalBalanceSnapshot = {
  accountName: string;
  amount: number;
  currency?: string;
  date: string;
};

const isNonNull = <T>(value: T | null): value is T => value !== null;

const PROVIDER_ENV_MAP: Record<SandboxProvider, string> = {
  caixabank: 'OPEN_BANKING_CAIXABANK_SANDBOX_URL',
  bbva: 'OPEN_BANKING_BBVA_SANDBOX_URL',
  revolut: 'OPEN_BANKING_REVOLUT_SANDBOX_URL',
};

const isProvider = (value: string): value is SandboxProvider => {
  return value === 'caixabank' || value === 'bbva' || value === 'revolut';
};

const toSafeDateIso = (rawDate: unknown): string => {
  if (typeof rawDate !== 'string') {
    return new Date().toISOString();
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

const normalizeFromOpenBankingPayload = (payload: unknown): ExternalBalanceSnapshot[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as {
    Data?: {
      Account?: Array<{ AccountId?: string; Nickname?: string; Name?: string; Currency?: string }>;
      Balance?: Array<{
        AccountId?: string;
        Amount?: { Amount?: string; Currency?: string };
        CreditDebitIndicator?: 'Credit' | 'Debit';
        DateTime?: string;
      }>;
      Accounts?: Array<{ AccountId?: string; Nickname?: string; Name?: string; Currency?: string }>;
      Balances?: Array<{
        AccountId?: string;
        Amount?: { Amount?: string; Currency?: string };
        CreditDebitIndicator?: 'Credit' | 'Debit';
        DateTime?: string;
      }>;
    };
    accounts?: Array<{
      id?: string;
      accountId?: string;
      name?: string;
      nickname?: string;
      currency?: string;
      balance?: number | string;
      currentBalance?: number | string;
      amount?: number | string;
      date?: string;
      dateTime?: string;
    }>;
  };

  const data = root.Data;
  const accountList = data?.Account ?? data?.Accounts ?? [];
  const balanceList = data?.Balance ?? data?.Balances ?? [];

  const accountNameMap = new Map<string, { name: string; currency?: string }>();

  accountList.forEach((account) => {
    const accountId = account.AccountId?.trim();
    if (!accountId) return;

    const name = account.Nickname?.trim() || account.Name?.trim() || accountId;
    accountNameMap.set(accountId, {
      name,
      currency: account.Currency,
    });
  });

  const normalizedFromBalances: ExternalBalanceSnapshot[] = balanceList.reduce<ExternalBalanceSnapshot[]>(
    (acc, balance) => {
      const accountId = balance.AccountId?.trim();
      if (!accountId) return acc;

      const amountString = balance.Amount?.Amount;
      const rawAmount = typeof amountString === 'string' ? Number.parseFloat(amountString) : NaN;
      if (Number.isNaN(rawAmount)) return acc;

      const signAdjustedAmount = balance.CreditDebitIndicator === 'Debit' ? -Math.abs(rawAmount) : rawAmount;
      const accountMeta = accountNameMap.get(accountId);

      acc.push({
        accountName: accountMeta?.name ?? accountId,
        amount: signAdjustedAmount,
        currency: balance.Amount?.Currency ?? accountMeta?.currency,
        date: toSafeDateIso(balance.DateTime),
      });

      return acc;
    },
    []
  );

  if (normalizedFromBalances.length > 0) {
    return normalizedFromBalances;
  }

  const normalizedFromAccounts: ExternalBalanceSnapshot[] = (root.accounts ?? [])
    .map((account) => {
      const name = account.nickname?.trim() || account.name?.trim() || account.accountId?.trim() || account.id?.trim();
      if (!name) return null;

      const rawBalanceCandidate = account.currentBalance ?? account.balance ?? account.amount;
      const amount =
        typeof rawBalanceCandidate === 'number'
          ? rawBalanceCandidate
          : typeof rawBalanceCandidate === 'string'
            ? Number.parseFloat(rawBalanceCandidate)
            : NaN;

      if (Number.isNaN(amount)) return null;

      return {
        accountName: name,
        amount,
        currency: account.currency,
        date: toSafeDateIso(account.dateTime ?? account.date),
      };
    })
    .filter(isNonNull);

  return normalizedFromAccounts;
};

const withPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${path}`;
};

const isLocalHttpUrl = (url: URL) => {
  if (url.protocol !== 'http:') return false;
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
};

const isProduction = process.env.NODE_ENV === 'production';

const isTrustedProviderHost = (provider: SandboxProvider, hostname: string) => {
  const normalizedHost = hostname.toLowerCase();
  const trustedHostMatchers: Record<SandboxProvider, string[]> = {
    caixabank: ['caixabank', 'caixa', 'imagin'],
    bbva: ['bbva'],
    revolut: ['revolut'],
  };

  return trustedHostMatchers[provider].some((matcher) => normalizedHost.includes(matcher));
};

const fetchFirstSuccessfulPayload = async (baseUrl: string, token?: string) => {
  const candidatePaths = [
    '/accounts',
    '/v1/accounts',
    '/open-banking/v3.1/aisp/accounts',
    '/open-banking/v3.1/aisp/balances',
    '/balances',
  ];

  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (const path of candidatePaths) {
    try {
      const response = await fetch(withPath(baseUrl, path), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const json = await response.json();
      const normalized = normalizeFromOpenBankingPayload(json);

      if (normalized.length > 0) {
        return {
          sourcePath: path,
          entries: normalized,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
};

export async function GET(request: NextRequest) {
  const providerQuery = request.nextUrl.searchParams.get('provider')?.trim().toLowerCase();

  if (!providerQuery || !isProvider(providerQuery)) {
    return NextResponse.json(
      { error: 'Missing or invalid provider. Use caixabank, bbva, or revolut.' },
      { status: 400 }
    );
  }

  const envKey = PROVIDER_ENV_MAP[providerQuery];
  const sandboxBaseUrl = process.env[envKey]?.trim();

  if (!sandboxBaseUrl) {
    return NextResponse.json(
      {
        error: `Sandbox URL not configured for ${providerQuery}. Set ${envKey} in environment variables.`,
      },
      { status: 503 }
    );
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(sandboxBaseUrl);
  } catch {
    return NextResponse.json(
      { error: `Invalid URL configured in ${envKey}.` },
      { status: 500 }
    );
  }

  if (parsedBaseUrl.protocol !== 'https:' && (!isLocalHttpUrl(parsedBaseUrl) || isProduction)) {
    return NextResponse.json(
      { error: `${envKey} must use https (http localhost is only allowed in non-production).` },
      { status: 500 }
    );
  }

  const configuredToken = process.env.OPEN_BANKING_SANDBOX_TOKEN?.trim();
  const token =
    configuredToken && isTrustedProviderHost(providerQuery, parsedBaseUrl.hostname)
      ? configuredToken
      : undefined;
  const fetchResult = await fetchFirstSuccessfulPayload(parsedBaseUrl.toString(), token);

  if (!fetchResult) {
    return NextResponse.json(
      {
        error: `Could not fetch/normalize account data for ${providerQuery} from configured sandbox URL.`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      provider: providerQuery,
      sandboxBaseUrl: parsedBaseUrl.toString(),
      sourcePath: fetchResult.sourcePath,
      accounts: fetchResult.entries,
      importedAt: new Date().toISOString(),
    },
    { status: 200 }
  );
}
