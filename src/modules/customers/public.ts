export { CustomerCardView } from "./ui/CustomerCardView";
export { kundeVollstaendigkeit } from "./orderReadiness";
export { CUSTOMER_COUNTRIES, EMPTY_CUSTOMER_FORM, customerCountryLabel, customerDisplayName, customerContactLabel, customerFieldError, kundeValidierung } from "./customerFormContract";
export { KundeFormular } from "./ui/KundeFormular";
export type { CustomerFormValue, CustomerFormType } from "./customerFormContract";
export type { CustomerAddressInput, CustomerAddressResult } from "./customerAddress";
export { normaliseCustomerName, normaliseCustomerPhone, customerDuplicateMatch, customerSortKey } from "./customerComparison";
export type { CustomerComparisonValue } from "./customerComparison";
export type {
  OrderReadiness,
  OrderReadinessCustomer,
  OrderReadinessField,
  OrderReadinessIssue,
} from "./orderReadiness";
export type {
  CreateCustomerInput,
  CustomerCreateCommandResult,
  CustomerCreateReceipt,
  CustomerStoredProfile,
  ReadCustomerCreateReceiptResult,
  UpdateCustomerInput,
  EnableCustomerInvoiceTermsInput,
} from "./server/types";
export type {
  CustomerCardModel,
  CustomerCardState,
  CustomerListItem,
  CustomersViewState,
} from "./server/types";
