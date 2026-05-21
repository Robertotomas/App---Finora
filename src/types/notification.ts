export interface Notification {
  id: string
  type: number
  message: string
  redirectUrl?: string | null
  isRead: boolean
  createdAt: string
}

export enum NotificationType {
  BudgetExceeded = 0,
  MonthClose = 1,
  MonthlyPlanReminder = 2,
  CoupleInviteAccepted = 3,
  SubscriptionExpired = 4,
}
