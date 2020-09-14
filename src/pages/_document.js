import NextDocument, { Html, Head, Main, NextScript } from 'next/document'
import * as fs from 'fs'
import * as path from 'path'
import glob from 'glob'

class InlineStylesHead extends Head {
  getCssLinks(files) {
    return files.sharedFiles
      .filter((file) => /\.css$/.test(file))
      .map((file) => (
        <style
          key={file}
          nonce={this.props.nonce}
          data-href={`${this.context.assetPrefix}/_next/${file}`}
          dangerouslySetInnerHTML={{
            __html: fs.readFileSync(
              path.join(process.cwd(), '.next', file),
              'utf-8'
            ),
          }}
        />
      ))
  }
  getPreloadDynamicChunks() {
    const [file] = glob.sync('static/chunks/monaco-editor*', {
      cwd: path.resolve(process.cwd(), '.next'),
    })
    this.context.dynamicImports.push({ file })
    return super.getPreloadDynamicChunks()
  }
}

export default class Document extends NextDocument {
  static async getInitialProps(ctx) {
    const initialProps = await NextDocument.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html lang="en" className="h-full">
        <InlineStylesHead>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  if (!('theme' in localStorage)) {
                    localStorage.theme = window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'dark'
                      : 'light'
                  }
                  if (localStorage.theme === 'dark') {
                    document.querySelector('html').classList.add('dark')
                  }
                } catch (_) {}
              `
                .replace(/\s+/g, '')
                .replace("'inlocal", "' in local"),
            }}
          />
        </InlineStylesHead>
        <body className="min-h-full flex text-gray-700 dark:text-white bg-white dark:bg-gray-800">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
