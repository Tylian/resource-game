interface I18nMapping {
  [from: string]: string;
}

export default function i18n(locale: string) {
  let dictionary: I18nMapping = require(`./${locale}.json`);
  return function translate(key: string, ...args: any) {
    let result = dictionary[key] !== undefined ? dictionary[key] : key;
    return result.replace(/\$\{(\d+)\}/, (_, n) => {
      return args[parseInt(n, 10)];
    })
  }
}