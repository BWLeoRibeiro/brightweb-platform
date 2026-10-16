// Presentation-only stand-ins for component lifecycle tests. Real state, requests,
// models and callbacks remain in the production components imported by the runner.
export const StyledSelect = 'StyledSelect', Badge = 'Badge', Button = 'Button', Card = 'Card', CardContent = 'CardContent';
export const Input = 'Input', Label = 'Label', Separator = 'Separator', Sheet = 'Sheet', SheetContent = 'SheetContent';
export const SheetDescription = 'SheetDescription', SheetHeader = 'SheetHeader', SheetTitle = 'SheetTitle', Skeleton = 'Skeleton';
export const AppSheetBody = 'AppSheetBody', AppSheetHeader = 'AppSheetHeader', PillTabs = 'PillTabs', SheetSection = 'SheetSection';
export function useShellAction(name, handler) {
  (globalThis.marketingTestActions ??= new Map()).set(name, handler);
}
export function useMarketingUiClient() { return globalThis.marketingTestClient; }
export const toast = { success(message) { globalThis.marketingTestMessages.push(message); }, error(message) { globalThis.marketingTestMessages.push(message); } };
export const SegmentWorkspace = 'SegmentWorkspace', TopicWorkspace = 'TopicWorkspace', WorkflowWorkspace = 'WorkflowWorkspace';
export const AnalyticsWorkspace = 'AnalyticsWorkspace', CampaignAnalyticsPanel = 'CampaignAnalyticsPanel';
