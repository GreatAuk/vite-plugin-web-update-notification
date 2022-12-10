import type { LocaleData, Options } from './type'
import { CUSTOM_UPDATE_EVENT_NAME, DIRECTORY_NAME, JSON_FILE_NAME, LOCAL_STORAGE_PREFIX, NOTIFICATION_ANCHOR_CLASS_NAME, NOTIFICATION_DISMISS_BTN_CLASS_NAME, NOTIFICATION_REFRESH_BTN_CLASS_NAME } from './constant'
import presetLocaleData from './locale'

let hasShowSystemUpdateNotice = false
let latestVersion = ''
let currentLocale = ''

/**
 * limit function
 * @param {Function} fn - The function to be called.
 * @param {number} delay - The amount of time to wait before calling the function.
 * @returns A function that called limit
 */
function limit(fn: Function, delay: number) {
  let pending = false
  return function (this: any, ...args: any[]) {
    if (pending)
      return
    pending = true
    fn.apply(this, args)
    setTimeout(() => {
      pending = false
    }, delay)
  }
}

/**
 * It checks whether the system has been updated and if so, it shows a notification.
 * @param {Options} options - Options
 */
function checkUpdate(options: Options) {
  const { injectFileBase = '', checkInterval, hiddenDefaultNotification } = options
  const checkSystemUpdate = () => {
    window
      .fetch(`${injectFileBase}${DIRECTORY_NAME}/${JSON_FILE_NAME}.json?t=${performance.now()}`)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Failed to fetch ${JSON_FILE_NAME}.json`)

        return response.json()
      })
      .then(({ version: versionFromServer }: { version: string }) => {
        latestVersion = versionFromServer
        if (window.pluginWebUpdateNotice_version !== versionFromServer) {
          // dispatch custom event
          document.body.dispatchEvent(new CustomEvent(CUSTOM_UPDATE_EVENT_NAME, {
            detail: options,
            bubbles: true,
          }))

          const dismiss = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${versionFromServer}`) === 'true'
          if (!hasShowSystemUpdateNotice && !hiddenDefaultNotification && !dismiss)
            handleShowNotification(options)
        }
      })
      .catch((err) => {
        console.error('[pluginWebUpdateNotice] Failed to check system update', err)
      })
  }

  // check system update after page loaded
  checkSystemUpdate()

  // polling check system update
  setInterval(checkSystemUpdate, checkInterval || 10 * 60 * 1000)

  const limitCheckSystemUpdate = limit(checkSystemUpdate, 5000)

  // when page visibility change, check system update
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      limitCheckSystemUpdate()
  })

  // when page focus, check system update
  window.addEventListener('focus', () => {
    limitCheckSystemUpdate()
  })

  // listener script resource loading error
  window.addEventListener(
    'error',
    (err) => {
      const errTagName = (err?.target as any)?.tagName
      if (errTagName === 'SCRIPT')
        checkSystemUpdate()
    },
    true,
  )
}
window.pluginWebUpdateNotice_ = {
  checkUpdate,
  setLocale: (locale: string) => {
    window.pluginWebUpdateNotice_.locale = locale
    currentLocale = locale
  },
}

/**
 * Bind the refresh button click event to refresh the page, and bind the dismiss button click event to
 * hide the notification and dismiss the system update.
 */
function bindBtnEvent() {
  // bind refresh button click event, click to refresh page
  const refreshBtn = document.querySelector(`.${NOTIFICATION_REFRESH_BTN_CLASS_NAME}`)
  refreshBtn?.addEventListener('click', () => {
    window.location.reload()
  })

  // bind dismiss button click event, click to hide notification
  const dismissBtn = document.querySelector(`.${NOTIFICATION_DISMISS_BTN_CLASS_NAME}`)
  dismissBtn?.addEventListener('click', () => {
    try {
      hasShowSystemUpdateNotice = false
      document.querySelector(`.${NOTIFICATION_ANCHOR_CLASS_NAME} .plugin-web-update-notice`)?.remove()
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${latestVersion}`, 'true')
    }
    catch (err) {
      console.error(err)
    }
  })
}

/**
 * It returns the value of the key in the localeData object, or the value of the key in the
 * presetLocaleData object, or the value of the key in the presetLocaleData.zh_CN object
 * @param {string} locale - The locale to be used, such as zh_CN, en_US, etc.
 * @param key - The key of the text to be obtained in the locale data.
 * @param {LocaleData} localeData - The locale data object that you passed in.
 * @returns The value of the key in the localeData object.
 */
function getLocaleText(locale: string, key: keyof LocaleData[string], localeData: LocaleData) {
  return localeData[locale]?.[key] ?? presetLocaleData[locale]?.[key] ?? presetLocaleData.zh_CN[key]
}

/**
 * show update notification
 */
function handleShowNotification(options: Options) {
  try {
    hasShowSystemUpdateNotice = true

    const { notificationProps, customNotificationHTML, hiddenDismissButton, locale = 'zh_CN', localeData: localeData_ } = options
    const localeData = Object.assign({}, presetLocaleData, localeData_)
    if (!currentLocale) {
      currentLocale = locale
      window.pluginWebUpdateNotice_.locale = locale
    }

    const notification = document.createElement('div')
    let notificationInnerHTML = ''

    if (customNotificationHTML) {
      notificationInnerHTML = customNotificationHTML
    }
    else {
      const title = notificationProps?.title ?? getLocaleText(currentLocale, 'title', localeData)
      const description = notificationProps?.description ?? getLocaleText(currentLocale, 'description', localeData)
      const buttonText = notificationProps?.buttonText ?? getLocaleText(currentLocale, 'buttonText', localeData)
      const dismissButtonText = notificationProps?.dismissButtonText ?? getLocaleText(currentLocale, 'dismissButtonText', localeData)
      const dismissButtonHtml = hiddenDismissButton ? '' : `<a class="plugin-web-update-notice-btn plugin-web-update-notice-dismiss-btn">${dismissButtonText}</a>`
      notification.classList.add('plugin-web-update-notice')
      notificationInnerHTML = `
    <div class="plugin-web-update-notice-content" data-cy="notification-content">
      <div class="plugin-web-update-notice-content-title">
        ${title}
      </div>
      <div class="plugin-web-update-notice-content-desc">
        ${description}
      </div>
      <div class="plugin-web-update-notice-tools">
        ${dismissButtonHtml}
        <a class="plugin-web-update-notice-btn plugin-web-update-notice-refresh-btn">
          ${buttonText}
        </a>
      </div>
    </div>`
    }

    notification.innerHTML = notificationInnerHTML
    document
      .querySelector(`.${NOTIFICATION_ANCHOR_CLASS_NAME}`)!
      .appendChild(notification)

    bindBtnEvent()
  }
  catch (err) {
    console.error('[pluginWebUpdateNotice] Failed to show notification', err)
  }
}

// meaningless export, in order to let tsup bundle these functions
export {
  checkUpdate,
}