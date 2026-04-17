export const MEMORY_ITEM_TYPES = [
  "declared_fact",
  "preference",
  "goal",
  "constraint",
  "interaction_style",
  "inferred_trait",
] as const;

export const MEMORY_ITEM_STATUSES = [
  "candidate",
  "active",
  "archived",
  "contradicted",
  "deleted",
] as const;

export const MEMORY_AUDIT_ACTIONS = [
  "created",
  "promoted",
  "updated",
  "contradicted",
  "archived",
  "deleted",
] as const;

export const MEMORY_SENSITIVITY_LEVELS = ["low", "medium", "high", "blocked"] as const;

