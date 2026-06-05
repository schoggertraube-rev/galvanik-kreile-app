/**
 * Minimaler Customer-Typ, der sowohl mit echten `Customer`-Objekten
 * als auch mit `MockCustomer`-Objekten kompatibel ist.
 * Wird überall verwendet, wo UI-Komponenten nur Anzeige-Felder benötigen.
 */
export type CustomerLike = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customerNumber?: string;
  type?: string;
  city?: string;
  trustLevel?: string;
};
