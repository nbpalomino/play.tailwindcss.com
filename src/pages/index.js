import { useState, useRef, useEffect, useCallback } from 'react'
import Worker from 'worker-loader?publicPath=/_next/&filename=static/[name].[hash].js&chunkFilename=static/chunks/[id].[contenthash].worker.js!../workers/postcss.worker.js'
import CompressWorker from 'worker-loader?filename=static/[name].[hash].js!../workers/compress.worker.js'
import dynamic from 'next/dynamic'
import LZString from 'lz-string'
import { createWorkerQueue, requestResponse } from '../utils/workers'
import { debounce } from 'debounce'
import SplitPane from 'react-split-pane'
import { Logo } from '../components/Logo'
import useMedia from 'react-use/lib/useMedia'
import defaultContent from '../preval/defaultContent'

const Editor = dynamic(
  import(/* webpackChunkName: 'monaco-editor' */ '../components/Editor'),
  { ssr: false }
)

function TabButton({ isActive, onClick, children }) {
  return (
    <button
      type="button"
      className={`rounded-md text-sm leading-6 font-medium px-2 focus:outline-none transition-colors duration-150 ${
        isActive
          ? 'text-black bg-gray-100 focus:bg-gray-200 dark:text-white dark:bg-gray-900'
          : 'text-gray-500 hover:text-black focus:text-black dark:text-gray-400 dark:hover:text-white'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function App() {
  const previewRef = useRef()
  const worker = useRef()
  const compressWorker = useRef()
  const [initialContent, setInitialContent] = useState()
  const [size, setSize] = useState({ percentage: 0.5 })
  const [resizing, setResizing] = useState(false)
  const [activeTab, setActiveTab] = useState('html')
  const [activePane, setActivePane] = useState('editor')
  const isMd = useMedia('(min-width: 768px)')
  const [renderEditor, setRenderEditor] = useState(false)

  const injectHtml = useCallback((html) => {
    previewRef.current.contentWindow.postMessage({
      html,
    })
  }, [])

  const compileNow = useCallback(async (content) => {
    const { css, canceled, error } = await requestResponse(worker.current, {
      config: content.config,
      css: content.css,
    })
    if (canceled || error) {
      return
    }
    if (css) {
      previewRef.current.contentWindow.postMessage({ css })
    }
  }, [])

  const compile = useCallback(debounce(compileNow, 200), [])

  const updateUrl = useCallback(async (content) => {
    let { compressed, canceled, error } = await compressWorker.current.emit({
      string: JSON.stringify(content),
    })
    if (canceled || error) {
      return
    }
    if (compressed) {
      window.history.replaceState({}, '', `#${compressed}`)
    }
  }, [])

  const onChange = useCallback(
    (document, content) => {
      if (document === 'html') {
        injectHtml(content.html)
      } else {
        compile({ css: content.css, config: content.config })
      }
      updateUrl(content)
    },
    [injectHtml, compile, updateUrl]
  )

  useEffect(() => {
    worker.current = new Worker()
    compressWorker.current = createWorkerQueue(CompressWorker)

    const content = { ...defaultContent }

    if (window.location.hash) {
      try {
        Object.assign(
          content,
          JSON.parse(
            LZString.decompressFromEncodedURIComponent(
              window.location.hash.substr(1)
            )
          )
        )
      } catch (_) {}
    }

    setInitialContent({
      html: content.html,
      css: content.css,
      config: content.config,
    })

    return () => {
      worker.current.terminate()
      compressWorker.current.terminate()
    }
  }, [compileNow, injectHtml])

  useEffect(() => {
    function updateSize() {
      setSize((size) => {
        const windowWidth = window.innerWidth

        if (isMd) {
          const min = 320
          const max = windowWidth - min

          return {
            ...size,
            min,
            max,
            current: Math.max(
              Math.min(Math.round(windowWidth * size.percentage), max),
              320
            ),
          }
        }

        const newSize = activePane === 'editor' ? windowWidth : 0

        return {
          ...size,
          current: newSize,
          min: newSize,
          max: newSize,
        }
      })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
    }
  }, [isMd, setSize, activePane])

  useEffect(() => {
    if (isMd) {
      setRenderEditor(true)
    } else if (activePane === 'editor') {
      setRenderEditor(true)
    } else {
      previewRef.current.focus()
    }
  }, [activePane, isMd])

  useEffect(() => {
    if (resizing) {
      document.body.classList.add('cursor-col-resize')
    } else {
      document.body.classList.remove('cursor-col-resize')
    }
  }, [resizing])

  const updateCurrentSize = useCallback((newSize) => {
    setSize((size) => {
      const percentage = newSize / window.innerWidth
      return {
        ...size,
        current: newSize,
        percentage:
          percentage === 1 || percentage === 0 ? size.percentage : percentage,
      }
    })
  }, [])

  function toggleTheme() {
    const $html = document.querySelector('html')
    $html.classList.add('disable-transitions')
    if ($html.classList.contains('dark')) {
      $html.classList.remove('dark')
      try {
        window.localStorage.setItem('theme', 'light')
      } catch (_) {}
    } else {
      $html.classList.add('dark')
      try {
        window.localStorage.setItem('theme', 'dark')
      } catch (_) {}
    }
    window.setTimeout(() => {
      $html.classList.remove('disable-transitions')
    }, 0)
  }

  const isDefaultContent =
    initialContent &&
    initialContent.html === defaultContent.html &&
    initialContent.css === defaultContent.css &&
    initialContent.config === defaultContent.config

  return (
    <>
      <header className="relative z-10 flex-none py-5 px-5 sm:px-8 shadow dark:shadow-white flex items-center">
        <Logo />
        <button type="button" className="ml-auto" onClick={toggleTheme}>
          <svg
            className="w-5 h-5 block dark:hidden"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
              clipRule="evenodd"
            />
          </svg>
          <svg
            className="w-5 h-5 hidden dark:block"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </button>
      </header>
      <main className="flex-auto relative">
        {initialContent && typeof size.current !== 'undefined' ? (
          <>
            <div className="flex flex-none px-5 sm:px-8 py-2 space-x-3 absolute z-10 top-0 left-0">
              <TabButton
                isActive={
                  (isMd || activePane === 'editor') && activeTab === 'html'
                }
                onClick={() => {
                  setActivePane('editor')
                  setActiveTab('html')
                }}
              >
                HTML
              </TabButton>
              <TabButton
                isActive={
                  (isMd || activePane === 'editor') && activeTab === 'css'
                }
                onClick={() => {
                  setActivePane('editor')
                  setActiveTab('css')
                }}
              >
                CSS
              </TabButton>
              <TabButton
                isActive={
                  (isMd || activePane === 'editor') && activeTab === 'config'
                }
                onClick={() => {
                  setActivePane('editor')
                  setActiveTab('config')
                }}
              >
                Config
              </TabButton>
              {!isMd && (
                <TabButton
                  isActive={activePane === 'preview'}
                  onClick={() => {
                    setActivePane('preview')
                  }}
                >
                  Preview
                </TabButton>
              )}
            </div>
            <SplitPane
              split="vertical"
              minSize={size.min}
              maxSize={size.max}
              size={size.current}
              onChange={updateCurrentSize}
              pane1Style={{ display: 'flex', flexDirection: 'column' }}
              onDragStarted={() => setResizing(true)}
              onDragFinished={() => setResizing(false)}
              allowResize={isMd}
            >
              <div className="border-t border-gray-200 dark:border-gray-600 mt-10 flex-auto flex">
                {renderEditor && (
                  <Editor
                    initialContent={initialContent}
                    onChange={onChange}
                    worker={worker}
                    activeTab={activeTab}
                  />
                )}
              </div>
              <iframe
                ref={previewRef}
                title="Preview"
                className={`absolute inset-0 w-full h-full bg-white ${
                  resizing ? 'pointer-events-none' : ''
                } ${
                  isMd
                    ? ''
                    : 'mt-10 border-t border-gray-200 dark:border-gray-600'
                }`}
                onLoad={() => {
                  injectHtml(initialContent.html)
                  compileNow(initialContent)
                }}
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="utf-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1">
                      <style id="_style">${
                        isDefaultContent ? defaultContent.compiledCss : ''
                      }</style>
                      <script>
                      var hasHtml = false
                      var hasCss = ${isDefaultContent ? 'true' : 'false'}
                      var visible = false
                      window.addEventListener('message', (e) => {
                        if ('css' in e.data) {
                          const style = document.getElementById('_style')
                          const newStyle = document.createElement('style')
                          newStyle.id = '_style'
                          newStyle.innerHTML = e.data.css
                          style.parentNode.replaceChild(newStyle, style)
                          hasCss = true
                        }
                        if ('html' in e.data) {
                          document.body.innerHTML = e.data.html
                          hasHtml = true
                        }
                        if (!visible && hasHtml && hasCss) {
                          visible = true
                          document.body.style.display = ''
                        }
                      })
                      </script>
                    </head>
                    <body style="display:none">
                    </body>
                  </html>
                `}
              />
            </SplitPane>
          </>
        ) : null}
      </main>
    </>
  )
}
