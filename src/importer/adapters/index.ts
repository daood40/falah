import type { Adapter } from '../types.ts';
import { jamiKamilAdapter } from './jami_kamil.ts';
import { jamiKamilShamelaAdapter } from './jami_kamil_shamela.ts';
import { genericJsonAdapter } from './generic_json.ts';
import { genericCsvAdapter } from './generic_csv.ts';
import { genericHtmlAdapter } from './generic_html.ts';

export const adapters: Record<string, Adapter> = {
  [jamiKamilAdapter.name]: jamiKamilAdapter,
  [jamiKamilShamelaAdapter.name]: jamiKamilShamelaAdapter,
  [genericJsonAdapter.name]: genericJsonAdapter,
  [genericCsvAdapter.name]: genericCsvAdapter,
  [genericHtmlAdapter.name]: genericHtmlAdapter,
};

export function getAdapter(name: string): Adapter {
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`unknown adapter "${name}". Available: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}
