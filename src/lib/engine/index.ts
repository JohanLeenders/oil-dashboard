/**
 * OIL Engine Exports
 *
 * Centrale export voor alle engine modules
 */

// SVASO Allocation
export {
  calculateSvasoAllocation,
  calculateBatchSvaso,
  validateSvasoResult,
  simulatePriceImpact,
  type SvasoInputItem,
  type SvasoAllocationResult,
  type SvasoCalculationOutput,
} from './svaso';

// Cherry-Picker Detection
export {
  analyzeCherryPicker,
  analyzeAllCustomers,
  ANATOMICAL_NORMS,
  MINIMUM_REVENUE_THRESHOLD,
  PREMIUM_CATEGORIES,
  type AnatomicalNorm,
  type CustomerProductMix,
  type CherryPickerAnalysis,
  type CategoryBreakdown,
  type CherryPickerAlert,
} from './cherry-picker';

// THT Status
export {
  calculateThtStatus,
  calculateBatchThtStatuses,
  filterBatchesByThtStatus,
  getThtColorClass,
  getThtColor,
  DEFAULT_THT_THRESHOLDS,
  type ThtCalculation,
  type ThtThresholds,
} from './tht';

// True-Up (Nacalculatie)
export {
  calculateYieldDelta,
  calculateCostDelta,
  calculateTrueUp,
  YIELD_TARGETS,
  type YieldDelta,
  type CostDelta,
  type TrueUpResult,
  type TrueUpSignal,
} from './true-up';

// Mass Balance Validation
export {
  validateMassBalance,
  validateAllMassBalances,
  generateNeedsReviewSignal,
  DEFAULT_VALIDATION_CONFIG,
  type MassBalanceValidation,
  type MassBalanceError,
  type MassBalanceWarning,
  type MassBalanceMetrics,
  type ValidationConfig,
} from './mass-balance';

// Sankey Diagram Data
export {
  generateMassBalanceSankey,
  generateAggregatedSankey,
  toVisxFormat,
  calculateMassLossPercentage,
  type SankeyNode,
  type SankeyLink,
  type SankeyData,
  type MassBalanceSankeyOptions,
} from './sankey';

// Customer Profitability
export {
  calculateCustomerProfitability,
  combineCustomerAnalysis,
  analyzeAllCustomerProfitability,
  calculateBalanceScoreHistory,
  getProfitabilityColorClass,
  getProfitabilityColor,
  getTrendColorClass,
  getTrendArrow,
  MARGIN_THRESHOLDS,
  RECENT_DAYS,
  PRIOR_DAYS_START,
  PRIOR_DAYS_END,
  type CustomerSalesLine,
  type CategoryMargin,
  type CustomerProfitability,
  type ProfitabilityWarning,
  type BalanceScorePoint,
  type CustomerProfitabilityComplete,
} from './customer-profitability';

// NRV Cost Engine (Sprint 2)
export {
  calculateNrvCosts,
  validateNrvResult,
  generateCostExplanation,
  type ProcessingCostInput,
  type NrvInputItem,
  type NrvResult,
  type ProcessingCostBreakdown,
  type NrvCalculationOutput,
} from './nrv-cost';

// Sales Pressure Engine (Sprint 3)
export {
  calculateDsi,
  getPressureFlag,
  generatePressureExplanation,
  calculatePartPressure,
  calculateAllPressures,
  getPressureColorClass,
  getPressureLabel,
  getVelocityTrendArrow,
  getVelocityTrendColorClass,
  DEFAULT_PRESSURE_THRESHOLDS,
  type PressureFlag,
  type VelocityTrend,
  type InventoryInput,
  type VelocityInput,
  type ThtRiskInput,
  type PressureResult,
  type PressureThresholds,
} from './sales-pressure';

// Carcass Alignment Engine (Sprint 4)
export {
  getCarcassShare,
  calculateDeviation,
  categorizeDeviation,
  calculateAlignmentScore,
  calculateCustomerAlignment,
  calculateAllAlignments,
  generateAlignmentExplanation,
  getPartNameDutch,
  getAlignmentColorClass,
  getDeviationColorClass,
  getDeviationLabel,
  formatDeviation,
  JA757_CARCASS_REFERENCE,
  DEFAULT_DEVIATION_THRESHOLDS,
  type CarcassReference,
  type CustomerIntakeItem,
  type PartDeviation,
  type DeviationCategory,
  type AlignmentResult,
  type DeviationThresholds,
} from './carcass-alignment';

// Scenario Impact Engine (Sprint 4)
export {
  calculateVolumeChange,
  calculateProjectedVolume,
  determineBalanceEffect,
  calculatePartImpact,
  calculateScenarioImpact,
  calculateAllScenarioImpacts,
  getVolumeChangeColorClass,
  getPriceChangeColorClass,
  formatPercentageWithSign,
  getAssumptionSourceLabel,
  getAssumptionSourceColorClass,
  getBalanceEffectLabel,
  SCENARIO_DISCLAIMER,
  SCENARIO_DISCLAIMER_EN,
  type ElasticityAssumption,
  type AssumptionSource,
  type PartBaseline,
  type PartImpactProjection,
  type BalanceEffect,
  type ScenarioImpactResult,
} from './scenario-impact';

// Margin Context Engine (Sprint 5)
export {
  checkContractCompliance,
  calculateContractDeviation,
  generateContractDeviationExplanation,
  generateMarginExplanation,
  calculatePartMarginContext,
  calculateCustomerMarginContext,
  calculateAllCustomerMarginContexts,
  generateOverallExplanation,
  getMarginColorClass,
  getDeviationFlagColorClass,
  getDeviationFlagLabel,
  formatMargin,
  formatPercentage,
  MARGIN_CONTEXT_THRESHOLDS,
  type CustomerMarginByPart,
  type CustomerContract,
  type DeviationFlag,
  type ContractDeviation,
  type MarginContextResult,
  type CustomerMarginContext,
} from './margin-context';

// Historical Trends Engine (Sprint 6)
export {
  calculateTrendDirection,
  calculateAverage,
  summarizePartTrend,
  summarizeCustomerTrend,
  summarizeAllPartTrends,
  summarizeAllCustomerTrends,
  generatePartTrendExplanation,
  generateCustomerTrendExplanation,
  getTrendLabel,
  getTrendColorClass as getHistoricalTrendColorClass,
  getTrendArrow as getHistoricalTrendArrow,
  formatPeriodLabel,
  formatChange,
  TREND_THRESHOLDS,
  TREND_DISCLAIMER,
  TREND_DISCLAIMER_EN,
  type PeriodType,
  type TrendDirection,
  type PartTrendPoint,
  type CustomerTrendPoint,
  type PartTrendSummary,
  type CustomerTrendSummary,
} from './historical-trends';

// Canonical Cost Engine (Sprint 7 → Phase 1)
export {
  // New CANON functions (Phase 1)
  calculateLandedCost,
  calculateJointCostPool,
  calculateByProductCredit,
  calculateSVASOAllocation,
  calculateMiniSVASO,
  calculateABCCosts,
  calculateFullSKUCost,
  calculateNRV,
  assertJointProduct,
  isJointProduct,
  // New CANON constants
  JOINT_PRODUCT_CODES,
  BY_PRODUCT_RATE_PER_KG,
  // Legacy backward compatibility
  calculateGrillerCost,
  calculatePrimalAllocation,
  calculateSecondaryProcessingCost,
  calculateSkuCost,
  simulateScenarioImpact,
  generateCostWaterfall,
  calculateLiveToMeatMultiplier,
  getPartNameDutch as getCanonicalPartNameDutch,
  getKFactorBadgeClass,
  getKFactorInterpretation,
  formatCurrency,
  formatCostPerKg,
  DEFAULT_STD_PRICES,
  JA757_CARCASS_SHARES,
  CANONICAL_YIELDS,
  SCENARIO_DISCLAIMER as CANONICAL_SCENARIO_DISCLAIMER,
  SCENARIO_DISCLAIMER_EN as CANONICAL_SCENARIO_DISCLAIMER_EN,
  // New CANON types
  type CostObjectLevel,
  type ProductClassification,
  type JointProductCode,
  type JointProductInput,
  type ByProductPhysical,
  type SubJointCutInput,
  type ABCCostDriver,
  type SkuDefinition,
  type NRVInput,
  type LandedCostResult,
  type JointCostPoolResult,
  type NetJointCostResult,
  type ByProductCreditDetail,
  type SVASOAllocationResult,
  type JointProductAllocation,
  type MiniSVASOResult,
  type SubJointAllocation,
  type ABCCostResult,
  type ABCDriverResult,
  type FullSKUCostResult,
  type NRVAssessment,
  // Legacy types (backward compatibility)
  type LandedCostInput,
  type ByProductInput,
  type PrimalCutInput,
  type SecondaryProcessingInput,
  type SkuAssemblyInput,
  type ScenarioPriceVector,
  type GrillerCostResult,
  type PrimalAllocationResult,
  type PrimalAllocation,
  type SecondaryProcessingResult,
  type SkuCostResult,
  type CostWaterfall,
  type CostVariance,
  type AuditTrailEntry,
  type ScenarioSimulationResult,
  type ScenarioImpact,
  type LiveToMeatMultiplierResult,
} from './canonical-cost';

// Cost Validation Helpers (Phase 1.1 — opt-in)
export {
  validateByProductInputs,
  validateMiniSVASOInputs,
  type ValidationSeverity,
  type ValidationMessage,
} from './cost-validation';
