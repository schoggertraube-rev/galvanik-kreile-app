import dynamic from 'next/dynamic';
export type {
  ConvertQuoteInput,
  CreateQuoteInput,
  CreateQuoteResult,
  PrepareQuoteConversionResult,
  QuoteConversionReceipt,
  QuoteCreateReceipt,
  QuoteOrderInput,
  QuotePosition,
  QuotePositionInput,
  QuoteReadback,
  QuoteUpdateReceipt,
  UpdateQuoteInput,
  UpdateQuoteResult,
  ListOpenQuotesResult,
  ReadQuoteConversionReceiptResult,
  ReadQuoteCreateReceiptResult,
  ReadQuoteUpdateReceiptResult,
  ReadQuoteResult,
} from "./server/types";

export {scaleQuoteCalculation} from "./quoteCalculation";
export type {QuoteCalculation} from "./quoteCalculation";

export {scaleQuotePositions} from "./quoteCalculation";
export type {QuoteQuantityLine} from "./quoteCalculation";

export const QuoteCard=dynamic(()=>import('./ui/QuoteCard').then(module=>module.QuoteCard));
export type {QuoteCardPorts,QuoteMailDraft} from "./ui/QuoteCard";

export {quoteForUi,hasQuoteFinancials} from './quotePresentation';
export type {QuoteUiReadback} from './quotePresentation';

export const QuoteReplyPicker=dynamic(()=>import('./ui/QuoteReplyPicker').then(module=>module.QuoteReplyPicker));
export type {QuoteReplyPickerPorts} from './ui/QuoteReplyPicker';
