export interface CreditPackage {
  priceId: string;
  name: string;
  description: string;
  credits: number;
  mode: 'payment';
  price: number;
  currency: string;
  currencySymbol: string;
  popular?: boolean;
}

const isLiveMode = import.meta.env.VITE_STRIPE_MODE === 'live';

const testCreditPackages: CreditPackage[] = [
  {
    priceId: 'price_test_single_chf',
    name: 'Starter',
    description: '1 comic generation',
    credits: 100,
    mode: 'payment',
    price: 9.90,
    currency: 'eur',
    currencySymbol: '€'
  },
  {
    priceId: 'price_test_editor_chf',
    name: 'Creator',
    description: '2 comic generations',
    credits: 200,
    mode: 'payment',
    price: 17.90,
    currency: 'eur',
    currencySymbol: '€',
    popular: true
  },
  {
    priceId: 'price_test_fan_chf',
    name: 'Studio',
    description: '4 comic generations',
    credits: 400,
    mode: 'payment',
    price: 29.90,
    currency: 'eur',
    currencySymbol: '€'
  }
];

const liveCreditPackages: CreditPackage[] = [
  {
    priceId: 'price_1SOwgMDWkrplu452SjkeNJJI',
    name: 'Starter',
    description: '1 comic generation',
    credits: 100,
    mode: 'payment',
    price: 9.90,
    currency: 'eur',
    currencySymbol: '€'
  },
  {
    priceId: 'price_1SOwhZDWkrplu4522iTCqUDW',
    name: 'Creator',
    description: '2 comic generations',
    credits: 200,
    mode: 'payment',
    price: 17.90,
    currency: 'eur',
    currencySymbol: '€',
    popular: true
  },
  {
    priceId: 'price_1SOwiYDWkrplu452NbuhaRVF',
    name: 'Studio',
    description: '4 comic generations',
    credits: 400,
    mode: 'payment',
    price: 29.90,
    currency: 'eur',
    currencySymbol: '€'
  }
];

export const creditPackages: CreditPackage[] = isLiveMode ? liveCreditPackages : testCreditPackages;
export const stripeMode = isLiveMode ? 'live' : 'test';

// Credit costs
export const CREDIT_COSTS = {
  FULL_COMIC: 100,
  PAGE_REGENERATION: 10
} as const;

// Physical print product (separate from credit system)
export interface PhysicalProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment';
  price: number;
  currency: string;
  currencySymbol: string;
}

const physicalPrintTest: PhysicalProduct = {
  priceId: 'price_test_physical_print',
  name: 'Physical Comic Book',
  description: 'Premium printed comic book',
  mode: 'payment',
  price: 39.00,
  currency: 'eur',
  currencySymbol: '€'
};

const physicalPrintLive: PhysicalProduct = {
  priceId: 'price_1QPoYdDWkrplu452YrHqvdO3',
  name: 'Physical Comic Book',
  description: 'Premium printed comic book',
  mode: 'payment',
  price: 39.00,
  currency: 'eur',
  currencySymbol: '€'
};

export const physicalProduct: PhysicalProduct = isLiveMode ? physicalPrintLive : physicalPrintTest;