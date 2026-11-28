export const TASK_TAG_COPY = {
  oeffnen: 'Aufgabe öffnen',
} as const;

export const GOODS_OUT_NOTICE_TASK_COPY = {
  taskText(kind: 'versandbescheid' | 'abholbescheid', customerName: string) {
    const prefix = kind === 'versandbescheid' ? 'Versandbescheid an ' : 'Abholbescheid an ';
    const suffix = ' erneut senden';
    const customer = customerName.trim();
    const fullTitle = prefix + customer + suffix;
    if (fullTitle.length <= 120) return {title: fullTitle, note: null};
    const maximum = 120 - prefix.length - suffix.length - 1;
    let shortened = '';
    for (const letter of customer) {
      if (shortened.length + letter.length > maximum) break;
      shortened += letter;
    }
    return {title: prefix + shortened + '…' + suffix, note: fullTitle};
  },
  requiresReceipt: 'Sende den Bescheid, um die Aufgabe abzuschließen.',
  unavailable: 'Der Bescheid gehört zu keiner belegten Herausgabe.',
  sent: 'Bescheid versendet.',
} as const;
