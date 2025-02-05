import { BUILTIN_ACTIONS } from '../Constants'
import { LocaleItemParser } from '../convert/LocaleItemParser'
import { Locale } from '../core/Locale'
import { InalzConfigComponent, Lang } from '../types/InalzConfig'
import { LocaleComponent } from '../types/Locale'
import { readFile, writeFile } from '../util/fsUtil'
import { BuildFailedError } from '../util/InalzError'
import { replaceAll } from '../util/stringUtil'

export class BuildCommand {
  lang: Lang
  sourcePath: string
  targetPaths: { [lang: string]: string }
  localePath: string
  strict: boolean = false

  constructor(
    { lang }: { lang: Lang },
    {
      sourcePath,
      targetPaths,
      localePath,
    }: InalzConfigComponent.SingleDocument,
  ) {
    this.lang = lang
    this.sourcePath = sourcePath
    this.targetPaths = targetPaths
    this.localePath = localePath
  }

  /**
   * Build tranlration document
   */
  async build() {
    const { lang, sourcePath, localePath, targetPaths } = this
    const markdown = await readFile(sourcePath)
    const localeItems = await new LocaleItemParser(lang).load(localePath)
    const locale = new Locale(lang, localeItems)
    for (const [targetlang, targetPath] of Object.entries(targetPaths)) {
      const content = this.replaceContent(targetlang, markdown, locale)
      await writeFile(targetPath, content, { mkdirp: true, mode: 0o644 })
    }
  }

  replace(
    text: string,
    sourceText: string,
    targetText: string,
    meta: LocaleComponent.ItemMeta,
  ): string {
    if (targetText === BUILTIN_ACTIONS.COPY) {
      // Don't replace
      return text
    }
    const { result, replaceCount } = replaceAll(text, sourceText, targetText)
    // 使われているはずなのに置換されていない
    if (replaceCount === 0 && !meta.unused) {
      const message = `Source text is not used. Do you forget to "inalz sync" before build? Or did you edit the source text?
  file: ${this.localePath}
  source text: "${sourceText}"
`
      if (this.strict) {
        throw new BuildFailedError(message)
      } else {
        console.warn('[WARNING] ' + message)
      }
    }
    return result
  }

  private replaceContent(
    targetLang: string,
    markdown: string,
    locale: Locale,
  ): string {
    const translated = locale.items.reduce((text, item) => {
      const sourceText = item.getSourceText()
      let targetText = item.getText(targetLang)
      if (typeof targetText !== 'string') {
        targetText = BUILTIN_ACTIONS.COPY
      }
      return this.replace(text, sourceText, targetText, item.meta || {})
    }, markdown)
    return translated
  }
}
