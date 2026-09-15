export interface TaxRate {
  id: string;
  name: string;
  /** GST / sales tax percent, e.g. 18 */
  percent: number;
  appliesToRoom: boolean;
  appliesToFood: boolean;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}
