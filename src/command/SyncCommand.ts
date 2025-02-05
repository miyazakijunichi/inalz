import { LocaleItemParser } from '../convert/LocaleItemParser'
import { parseMarkdownTexts } from '../convert/Markdown'
import { mergeLocaleItems } from '../convert/mergeLocaleItems'
import { LocaleItem } from '../core/LocaleItem'
import { InalzConfigComponent, Lang } from '../types/InalzConfig'
import { fileExists, readFile, writeFile } from '../util/fsUtil'
import { deepEquals } from '../util/objectUtil'

export class SyncCommand {
  lang: Lang
  options: InalzConfigComponent.SyncOptions

  static constructOptions = ({
    paragraphIgnorePatterns = [],
  }: Partial<
    InalzConfigComponent.SyncOptions
  >): InalzConfigComponent.SyncOptions => ({
    paragraphIgnorePatterns,
  })

  constructor(
    lang: Lang,
    options: Partial<InalzConfigComponent.SyncOptions> = {},
  ) {
    this.lang = lang
    this.options = SyncCommand.constructOptions(options)
  }

  async sync(sourcePath: string, localePath: string) {
    const { lang } = this

    const srcText = await readFile(sourcePath)
    const texts = parseMarkdownTexts(srcText, {
      paragraphIgnorePatterns: this.options.paragraphIgnorePatterns,
    })

    const parser = new LocaleItemParser(lang)
    const items: LocaleItem[] = texts.map((text) => parser.parseFromSrc(text))

    let yaml: string
    if (await fileExists(localePath)) {
      const oldItems = await parser.load(localePath)
      const mergedItems = mergeLocaleItems(oldItems, items)
      if (deepEquals(oldItems, mergedItems)) {
        return
      }
      yaml = parser.stringify(mergedItems)
    } else {
      yaml = parser.stringify(items)
    }

    await writeFile(localePath, yaml, { mkdirp: true })
  }
}
