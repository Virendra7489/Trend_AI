export interface SampleDatasetDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  defaultX: string;
  defaultY: string;
  defaultGroupBy?: string;
  csv: string;
}

// Generate rich SaaS Subscription & MRR Growth Data (120 days)
function generateSaasData(): string {
  const headers = ['Date', 'MRR', 'NewSignups', 'ChurnCount', 'ActiveSubscriptions', 'CAC', 'PlanTier', 'Region', 'NetGrowthPct'];
  const rows: string[] = [headers.join(',')];
  
  let mrr = 48500;
  let activeSubs = 1120;
  const tiers = ['Starter', 'Professional', 'Enterprise'];
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];

  const startDate = new Date('2024-06-01');
  for (let i = 0; i < 90; i++) {
    const curDate = new Date(startDate.getTime() + i * 86400000);
    const dateStr = curDate.toISOString().split('T')[0];

    // Weekly seasonality (lower on weekends)
    const dayOfWeek = curDate.getDay();
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.1;

    // Gradual upward trend with some market dips and spike anomalies
    const isSpike = i === 42 || i === 78;
    const isDip = i === 25;

    const signups = Math.round((Math.floor(Math.random() * 25) + 35) * weekendFactor * (isSpike ? 2.4 : isDip ? 0.4 : 1.0));
    const churn = Math.round(Math.floor(Math.random() * 8) + 4 * (isDip ? 2.8 : 1.0));
    activeSubs += (signups - churn);

    const avgPrice = 49 + Math.sin(i / 10) * 8;
    mrr = Math.round(activeSubs * avgPrice + (isSpike ? 8500 : 0));
    const cac = Math.round(180 + Math.random() * 45 - (signups > 50 ? 25 : 0));
    const tier = tiers[i % tiers.length];
    const region = regions[(i + 1) % regions.length];
    const growth = Number(((signups - churn) / activeSubs * 100).toFixed(2));

    rows.push([dateStr, mrr, signups, churn, activeSubs, cac, tier, region, growth].join(','));
  }
  return rows.join('\n');
}

// Generate E-Commerce Sales & Profit Data
function generateEcommerceData(): string {
  const headers = ['OrderDate', 'Category', 'Region', 'Sales', 'Profit', 'Discount', 'Quantity', 'ShippingCost', 'CustomerSegment'];
  const rows: string[] = [headers.join(',')];

  const categories = ['Electronics', 'Furniture', 'Office Supplies', 'Apparel', 'Smart Home'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const segments = ['Consumer', 'Corporate', 'Home Office', 'Small Business'];

  const startDate = new Date('2024-07-01');
  for (let i = 0; i < 110; i++) {
    const curDate = new Date(startDate.getTime() + i * 86400000);
    const dateStr = curDate.toISOString().split('T')[0];
    const cat = categories[i % categories.length];
    const reg = regions[(i * 2) % regions.length];
    const seg = segments[(i * 3) % segments.length];

    const baseSales = cat === 'Electronics' ? 1200 : cat === 'Furniture' ? 850 : 340;
    const randomMultiplier = 0.7 + Math.random() * 0.9;
    const isPromoDay = i % 14 === 0;

    const sales = Math.round(baseSales * randomMultiplier * (isPromoDay ? 2.2 : 1.0));
    const discount = isPromoDay ? 0.25 : Number((Math.random() * 0.15).toFixed(2));
    const profitMargin = 0.18 + (Math.random() * 0.12) - (discount * 0.5);
    const profit = Math.round(sales * profitMargin);
    const quantity = Math.floor(Math.random() * 6) + 1;
    const shipping = Math.round(15 + Math.random() * 35);

    rows.push([dateStr, cat, reg, sales, profit, discount, quantity, shipping, seg].join(','));
  }
  return rows.join('\n');
}

// Generate IoT Sensor Telemetry Data
function generateTelemetryData(): string {
  const headers = ['Timestamp', 'HostID', 'CPU_Percent', 'Memory_MB', 'RequestsPerSec', 'ErrorRate_Pct', 'Temperature_C', 'Status'];
  const rows: string[] = [headers.join(',')];

  const hosts = ['prod-web-01', 'prod-web-02', 'prod-db-master', 'prod-cache-01'];
  const statuses = ['Healthy', 'Healthy', 'Healthy', 'Warning', 'Healthy'];

  const startTime = new Date('2024-10-01T00:00:00Z');
  for (let i = 0; i < 96; i++) {
    const time = new Date(startTime.getTime() + i * 900000); // 15-min intervals
    const timeStr = time.toISOString().replace('T', ' ').substring(0, 19);
    const host = hosts[i % hosts.length];

    // Day/night load curve
    const hour = time.getUTCHours();
    const loadFactor = Math.sin((hour / 24) * Math.PI) * 0.4 + 0.6;

    const isSpike = i === 36 || i === 71;
    const cpu = Number(Math.min(99.4, Math.max(12.0, (38 * loadFactor + Math.random() * 15 + (isSpike ? 42 : 0)))).toFixed(1));
    const memory = Math.round(4200 + cpu * 35 + Math.random() * 200);
    const rps = Math.round(350 * loadFactor + Math.random() * 80 + (isSpike ? 300 : 0));
    const errorRate = Number((isSpike ? (3.8 + Math.random() * 2.5) : (Math.random() * 0.35)).toFixed(2));
    const temp = Number((45 + cpu * 0.28 + Math.random() * 3).toFixed(1));
    const status = isSpike ? 'Critical' : cpu > 75 ? 'Warning' : 'Healthy';

    rows.push([timeStr, host, cpu, memory, rps, errorRate, temp, status].join(','));
  }
  return rows.join('\n');
}

// Generate Marketing Ad Spend & ROAS Data
function generateMarketingData(): string {
  const headers = ['Date', 'Channel', 'AdSpend', 'Impressions', 'Clicks', 'CTR_Pct', 'Conversions', 'Revenue', 'ROAS'];
  const rows: string[] = [headers.join(',')];

  const channels = ['Google Search', 'Meta Ads', 'LinkedIn B2B', 'YouTube Video', 'TikTok Ads'];
  const startDate = new Date('2024-08-01');

  for (let i = 0; i < 90; i++) {
    const curDate = new Date(startDate.getTime() + i * 86400000);
    const dateStr = curDate.toISOString().split('T')[0];
    const channel = channels[i % channels.length];

    const baseSpend = channel === 'Google Search' ? 2400 : channel === 'Meta Ads' ? 1800 : 1100;
    const spend = Math.round(baseSpend + Math.random() * 600 - 300);
    const cpc = channel === 'Google Search' ? 2.8 : channel === 'LinkedIn B2B' ? 6.5 : 1.2;
    const clicks = Math.round(spend / cpc);
    const ctr = Number((1.8 + Math.random() * 2.2).toFixed(2));
    const impressions = Math.round((clicks / (ctr / 100)));
    const convRate = channel === 'Google Search' ? 0.048 : 0.024;
    const conversions = Math.round(clicks * convRate * (0.8 + Math.random() * 0.4));
    const aov = 145 + Math.random() * 40;
    const revenue = Math.round(conversions * aov);
    const roas = Number((revenue / spend).toFixed(2));

    rows.push([dateStr, channel, spend, impressions, clicks, ctr, conversions, revenue, roas].join(','));
  }
  return rows.join('\n');
}

export const SAMPLE_DATASETS: SampleDatasetDefinition[] = [
  {
    id: 'saas-growth',
    name: 'SaaS MRR & Subscription Growth',
    category: 'Finance & SaaS',
    description: '90 days of daily recurring revenue, customer acquisition cost, new signups, churn, and net growth trends.',
    icon: 'TrendingUp',
    defaultX: 'Date',
    defaultY: 'MRR',
    defaultGroupBy: 'PlanTier',
    csv: generateSaasData(),
  },
  {
    id: 'ecommerce-sales',
    name: 'Global E-Commerce Sales & Profit',
    category: 'Retail & Commerce',
    description: 'Multi-category retail orders across 5 regions tracking sales volume, profit margins, discounts, and customer segments.',
    icon: 'ShoppingBag',
    defaultX: 'OrderDate',
    defaultY: 'Sales',
    defaultGroupBy: 'Category',
    csv: generateEcommerceData(),
  },
  {
    id: 'server-telemetry',
    name: 'IoT & Data Center Telemetry',
    category: 'DevOps & Infrastructure',
    description: 'Real-time 15-minute sensor logs tracking CPU utilization, memory, throughput RPS, latency, and temperature spikes.',
    icon: 'Activity',
    defaultX: 'Timestamp',
    defaultY: 'CPU_Percent',
    defaultGroupBy: 'HostID',
    csv: generateTelemetryData(),
  },
  {
    id: 'marketing-roas',
    name: 'Omnichannel Marketing & ROAS',
    category: 'Growth & Marketing',
    description: 'Campaign performance metrics across Google, Meta, and LinkedIn tracking ad spend, clicks, conversions, and return on ad spend.',
    icon: 'Target',
    defaultX: 'Date',
    defaultY: 'Revenue',
    defaultGroupBy: 'Channel',
    csv: generateMarketingData(),
  },
];
