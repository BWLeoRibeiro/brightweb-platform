// Presentation-only substitutes: the production sheets own state and submissions.
export const StyledSelect='StyledSelect',Button='Button',Input='Input',Field='Field',FieldContent='FieldContent',FieldGroup='FieldGroup',FieldLabel='FieldLabel',Popover='Popover',PopoverContent='PopoverContent',PopoverTrigger='PopoverTrigger',Sheet='Sheet',SheetContent='SheetContent',SheetFooter='SheetFooter',AppSheetHeader='AppSheetHeader',SheetSection='SheetSection',ProjectCalendar='Calendar';
export function useShellAction() {}
export function useRouter() { return { refresh() { globalThis.projectsFormRefreshes = (globalThis.projectsFormRefreshes ?? 0) + 1; } }; }
export const toast={success(message) { globalThis.projectsFormMessages?.push(message); },error(message) { globalThis.projectsFormMessages?.push(message); }};
export const sheetBodyClassName='',sheetFooterClassName='',sheetHeaderClassName='',sheetShellClassName='';
export const sheetAccentTextareaClassName='',sheetDatePickerButtonClassName='',sheetEditControlClassName='',sheetFieldLabelClassName='',sheetSectionClassName='',sheetSectionEditingClassName='',sheetSectionHeaderClassName='',sheetSectionHeaderEditingClassName='',sheetSectionTitleClassName='',sheetViewControlClassName='';
