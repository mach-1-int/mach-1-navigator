/**
 * Re-export from initial-data.ts for backwards compatibility.
 * Components that import from mock-data.ts will continue to work.
 * 
 * @deprecated Import from './initial-data' instead for new code.
 */

export {
  initialUsers as users,
  initialSupervisors as supervisors,
  initialNavigators as navigators,
  initialPatients as patients,
  initialAdverseEvents as adverseEvents,
  healthPlanRevenue,
  referralSources,
  monthlyBillingData,
  kpiMetrics,
} from "./initial-data"

// Re-export performanceData computed from navigators
import { initialNavigators } from "./initial-data"
import type { PerformanceData } from "./types"

export const performanceData: PerformanceData[] = initialNavigators.map(nav => ({
  name: nav.name,
  units: nav.monthlyUnits,
  lengthOfService: nav.lengthOfService,
  tier: nav.monthlyUnits >= 280 ? "top" : nav.monthlyUnits >= 220 ? "standard" : "low"
}))
