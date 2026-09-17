// Pure retirement math. No UI in here, so it's easy to read, reason about, and test later.

export function computeProjection({
  monthlySpendToday,
  yearsToRetirement,
  inflationPct,
  returnPct,
  withdrawalPct,
}) {
  const i = inflationPct / 100
  const r = returnPct / 100
  const w = withdrawalPct / 100
  const Y = Math.max(0, yearsToRetirement)

  // What your desired monthly spend will cost by the time you retire (inflation grows it).
  const futureMonthly = monthlySpendToday * Math.pow(1 + i, Y)

  // The nest egg that spend requires, using the withdrawal-rate rule of thumb.
  const targetNominal = (futureMonthly * 12) / w

  // That same target expressed in today's buying power (what it "feels like" now).
  const targetToday = targetNominal / Math.pow(1 + i, Y)

  // How much you'd need invested TODAY to coast to the target with no more saving.
  const neededToday = targetNominal / Math.pow(1 + r, Y)

  return { futureMonthly, targetNominal, targetToday, neededToday }
}

// Step 2: are you on track? Projects what you'll actually have at retirement
// (current savings grown, plus the future value of your ongoing contributions)
// and compares it to the target from Step 1. Everything here is in future
// (retirement-year) dollars, so it compares like-for-like with targetNominal.
export function computeOnTrack({
  currentAssets,
  monthlyContribution,
  yearsToRetirement,
  returnPct,
  targetNominal,
}) {
  const r = returnPct / 100
  const Y = Math.max(0, yearsToRetirement)

  // Your current pile, grown at the return rate.
  const grownAssets = currentAssets * Math.pow(1 + r, Y)

  // The future value of contributing every year until retirement.
  const annualContribution = monthlyContribution * 12
  const fvContributions =
    r === 0 ? annualContribution * Y : annualContribution * ((Math.pow(1 + r, Y) - 1) / r)

  const projected = grownAssets + fvContributions
  const gap = projected - targetNominal // positive = surplus, negative = shortfall
  const ratio = targetNominal > 0 ? projected / targetNominal : 0

  let status = 'shortfall'
  if (ratio >= 1) status = 'on-track'
  else if (ratio >= 0.85) status = 'close'

  return { projected, gap, ratio, status }
}

// Convert a retirement horizon (how many years the money must last) into a
// safe withdrawal rate. Anchored to common planning guidance, then interpolated
// so the rate moves smoothly as the horizon changes. Longer horizon = safer
// (lower) rate = you need a bigger nest egg.
export function withdrawalRateForYears(years) {
  const anchors = [
    [10, 6.0],
    [20, 5.0],
    [30, 4.0],
    [40, 3.5],
    [50, 3.25],
  ]
  if (years <= anchors[0][0]) return anchors[0][1]
  const last = anchors[anchors.length - 1]
  if (years >= last[0]) return last[1]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, r0] = anchors[i]
    const [y1, r1] = anchors[i + 1]
    if (years >= y0 && years <= y1) {
      const t = (years - y0) / (y1 - y0)
      return Math.round((r0 + t * (r1 - r0)) * 100) / 100
    }
  }
  return 4.0
}

// Estimate a monthly Social Security benefit (in today's dollars) from a
// career-average income. Social Security replaces a bigger share of income for
// lower earners (it's progressive), so we interpolate a replacement rate, cap
// at the rough maximum benefit, adjust for the claim age, and add a spousal
// bump for couples. A ballpark; the exact figure comes from ssa.gov.
export function estimateSocialSecurity({ careerAvgIncome, claimAge, isCouple }) {
  if (!careerAvgIncome || careerAvgIncome <= 0) return 0

  // Share of income Social Security covers, by career-average income.
  const anchors = [
    [25000, 0.55],
    [65000, 0.4],
    [130000, 0.28],
    [200000, 0.22],
  ]
  let rate = anchors[anchors.length - 1][1]
  if (careerAvgIncome <= anchors[0][0]) rate = anchors[0][1]
  else if (careerAvgIncome < anchors[anchors.length - 1][0]) {
    for (let i = 0; i < anchors.length - 1; i++) {
      const [x0, y0] = anchors[i]
      const [x1, y1] = anchors[i + 1]
      if (careerAvgIncome >= x0 && careerAvgIncome <= x1) {
        rate = y0 + ((careerAvgIncome - x0) / (x1 - x0)) * (y1 - y0)
        break
      }
    }
  }

  // Monthly benefit at full retirement age, capped at the rough maximum (~$3,800).
  const monthlyAtFRA = Math.min((careerAvgIncome * rate) / 12, 3800)

  // Claim-age adjustment relative to full retirement age (67).
  const claimFactor = claimAge === 62 ? 0.7 : claimAge === 70 ? 1.24 : 1.0
  let monthly = monthlyAtFRA * claimFactor

  // Couples get a rough spousal boost.
  if (isCouple) monthly *= 1.5

  return Math.round(monthly)
}

// Short, friendly currency: $1.98M, $628K, $4,000.
export function formatMoney(value) {
  if (!isFinite(value) || value <= 0) return '$0'
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M'
  if (value >= 10_000) return '$' + Math.round(value / 1000) + 'K'
  return '$' + Math.round(value).toLocaleString('en-US')
}
