export function capitalize(val: any): string {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
