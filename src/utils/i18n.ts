import { I18nMeta, getMetadata, DataType } from './data';

export default function i18n(locale: string) {
  let dictionary: I18nMeta = getMetadata(DataType.I18n, locale);
  delete dictionary.key;
  return function translate(key: string, ...args: any) {
    key = key.replace(/\//g, '.');
    let result = dictionary[key] !== undefined ? dictionary[key] : key;
    return result.replace(/\$\{(\d+)\}/, (_, n) => {
      return args[parseInt(n, 10)];
    })
  }
}