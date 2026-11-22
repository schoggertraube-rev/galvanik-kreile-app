const units = {
  stk: { dimension: 'piece', factor: BigInt(1) },
  paar: { dimension: 'pair', factor: BigInt(1) },
  ml: { dimension: 'volume', factor: BigInt(1) },
  l: { dimension: 'volume', factor: BigInt(1000) },
  g: { dimension: 'mass', factor: BigInt(1) },
  kg: { dimension: 'mass', factor: BigInt(1000) },
  mm: { dimension: 'length', factor: BigInt(1) },
  cm: { dimension: 'length', factor: BigInt(10) },
  m: { dimension: 'length', factor: BigInt(1000) },
} as const;

export type LagerUnit = keyof typeof units;
export type LagerQuantity = { amount: string; unit: LagerUnit };
export type LagerPackageCount = {
  unopened: string;
  contentPerPackage: LagerQuantity | null;
  verifiedBaseContent?: { quantity: LagerQuantity; documentId: string };
  openedRemainders: readonly (LagerQuantity | null)[];
};
export type LagerCountResult = {
  knownAmount: string;
  totalAmount: string | null;
  unit: LagerUnit;
};

function scaledAmount(value: string, wholeOnly = false): bigint {
  const parts = /^(0|[1-9][0-9]{0,10})(?:\.([0-9]{1,3}))?$/.exec(value);
  if (!parts || parts[0] !== value || (wholeOnly && parts[2])) {
    throw new RangeError('INVALID_LAGER_AMOUNT');
  }
  return BigInt(parts[1]) * BigInt(1000) + BigInt((parts[2] ?? '').padEnd(3, '0'));
}

function convert(value: LagerQuantity, target: LagerUnit): bigint {
  const source = Object.hasOwn(units, value.unit) ? units[value.unit] : undefined;
  const destination = Object.hasOwn(units, target) ? units[target] : undefined;
  if (!source || !destination || source.dimension !== destination.dimension) {
    throw new RangeError('INCOMPATIBLE_LAGER_UNIT');
  }
  const wholeOnly = source.dimension === 'piece' || source.dimension === 'pair';
  const numerator = scaledAmount(value.amount, wholeOnly) * source.factor;
  if (numerator % destination.factor !== BigInt(0)) {
    throw new RangeError('LAGER_AMOUNT_PRECISION_LOSS');
  }
  return numerator / destination.factor;
}

function decimalString(value: bigint): string {
  if (value > BigInt(99999999999999)) throw new RangeError('LAGER_AMOUNT_OVERFLOW');
  const fraction = (value % BigInt(1000)).toString().padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${value / BigInt(1000)}.${fraction}` : String(value / BigInt(1000));
}

/** Jede Gruppe bezeichnet eine konkrete Gebindeversion. Lose Reste erscheinen einmal. */
export function countLagerPackageGroups(
  groups: readonly LagerPackageCount[],
  target: LagerUnit,
): LagerCountResult {
  if (!Object.hasOwn(units, target)) throw new RangeError('INCOMPATIBLE_LAGER_UNIT');
  let known = BigInt(0);
  let complete = true;
  for (const group of groups) {
    const unopened = scaledAmount(group.unopened, true) / BigInt(1000);
    const conversion = group.verifiedBaseContent;
    if (conversion && (!conversion.documentId.trim() || conversion.quantity.unit !== target || group.contentPerPackage === null)) {
      throw new RangeError('INVALID_LAGER_CONVERSION_EVIDENCE');
    }
    if (group.contentPerPackage && scaledAmount(group.contentPerPackage.amount) === BigInt(0)) {
      throw new RangeError('INVALID_LAGER_PACKAGE_CONTENT');
    }
    const content = conversion?.quantity ?? group.contentPerPackage;
    const packageAmount = content === null ? null : convert(content, target);
    if (packageAmount === BigInt(0)) throw new RangeError('INVALID_LAGER_PACKAGE_CONTENT');
    known += unopened * (packageAmount ?? BigInt(0));
    if (unopened > BigInt(0) && packageAmount === null) complete = false;
    for (const remainder of group.openedRemainders) {
      if (remainder === null) {
        complete = false;
      } else {
        known += convert(remainder, target);
      }
    }
  }

  const knownAmount = decimalString(known);
  return { knownAmount, totalAmount: complete ? knownAmount : null, unit: target };
}

export function countLagerPackages(input: LagerPackageCount, target: LagerUnit): LagerCountResult {
  return countLagerPackageGroups([input], target);
}
