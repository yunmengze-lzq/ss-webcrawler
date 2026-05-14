export type MainWindowTarget = {
  mode: 'url' | 'file'
  value: string
  openDevTools: boolean
}

export const resolveMainWindowTarget = ({
  isPackaged,
  viteDevServerUrl,
  distIndexPath,
}: {
  isPackaged: boolean
  viteDevServerUrl?: string
  distIndexPath: string
}): MainWindowTarget => {
  if (!isPackaged && viteDevServerUrl && /^https?:\/\//i.test(viteDevServerUrl)) {
    return { mode: 'url', value: viteDevServerUrl, openDevTools: true }
  }

  return { mode: 'file', value: distIndexPath, openDevTools: false }
}
