/** Shared Euro presentation; Intl keeps the nonbreaking currency separator. */
export function formatEuro(cents:number):string{
 return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
}
