import {
  arSA,
  deDE,
  enUS,
  esES,
  frFR,
  hiIN,
  idID,
  itIT,
  jaJP,
  koKR,
  nlNL,
  plPL,
  ptBR,
  ruRU,
  trTR,
  viVN,
  zhCN,
} from "@clerk/localizations"

const clerkLocalizationByLocale = {
  ar: arSA,
  de: deDE,
  en: enUS,
  es: esES,
  fr: frFR,
  hi: hiIN,
  id: idID,
  it: itIT,
  ja: jaJP,
  ko: koKR,
  nl: nlNL,
  pl: plPL,
  pt: ptBR,
  ru: ruRU,
  tr: trTR,
  vi: viVN,
  "zh-CN": zhCN,
} as const

export function getClerkLocalization(locale: string) {
  return (
    clerkLocalizationByLocale[
      locale as keyof typeof clerkLocalizationByLocale
    ] ?? enUS
  )
}
