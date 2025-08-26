import { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface MainLayoutProps {
  children?: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vibegrapher</h1>
        <DarkModeToggle />
      </header>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

interface ProjectLayoutProps {
  vibecodePanel: ReactNode
  codePanel: ReactNode
  testPanel: ReactNode
  projectName?: string
}

export function ProjectLayout({ vibecodePanel, codePanel, testPanel }: ProjectLayoutProps) {
  return (
    <div className="h-full flex gap-4 p-4">
      <div className="w-1/3 min-w-[300px]">
        <Card className="h-full" data-testid="vibecode-panel">
          {vibecodePanel}
        </Card>
      </div>
      <div className="flex-1 flex flex-col gap-4">
        <Card className="flex-1" data-testid="code-panel">
          {codePanel}
        </Card>
        <Card className="h-1/3 min-h-[200px]" data-testid="test-panel">
          {testPanel}
        </Card>
      </div>
    </div>
  )
}

import { Switch } from '@/components/ui/switch'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true' || 
      (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setIsDark(isDarkMode)
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = (checked: boolean) => {
    setIsDark(checked)
    localStorage.setItem('darkMode', checked.toString())
    if (checked) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={isDark}
        onCheckedChange={toggleDarkMode}
        aria-label="Toggle dark mode"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}